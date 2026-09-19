import { checkEmailConfig, sendTestEmail } from "@/lib/email.functions";
import { Copy, Download, GraduationCap, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

import { useAdmin, type AdminModalKey } from "@/lib/use-admin";
import { DEFAULT_CONFIG } from "@/config/site-config";
import { useSiteConfig } from "@/lib/use-site-config";
import { getUtmPayload } from "@/lib/utm-hub";
import {
  clearLeads,
  clearAnalytics,
  ANALYTICS_UPDATED_EVENT,
  LEAD_CREATED_EVENT,
  exportLeadsCsv,
  exportConfigFile,
  loadAnalytics,
  loadCloudAnalytics,
  loadCloudLeads,
  loadLocalBackupSnapshots,
  saveConfigWithCredentials,
  loadLeads,
  migrateLocalDataToSupabase,
  exportSupabaseSql,
  saveLead,
  syncLeadsToSupabase,
  testSupabaseConnection,
  type ConfigBackupSnapshot,
  type LeadSyncSummary,
  type SupabaseConnectionStatus,
  type AnalyticsState,
  type LeadRecord,
} from "@/services/dataAdapter";
import { fireTestEvent, type TestEventLog } from "@/lib/tracking";
import {
  testWebhookEndpoint,
  webhookConfigurationWarning,
  type WebhookResult,
} from "@/services/webhooks";
import { getVariant, resetVariant } from "@/lib/ab";
import {
  AdminModal,
  Field,
  Stat,
  TextArea,
  TextInput,
  Toggle,
} from "./adminUi";
import {
  getExitIntentTemplate,
  templateMap,
} from "@/components/ExitIntentPopup";
import { buildVisitorBehaviorPayload } from "@/lib/behavior";

export function AdminModals() {
  const { activeModal, closeModal } = useAdmin();
  if (!activeModal) return null;
  const Body = REGISTRY[activeModal];
  return <Body onClose={closeModal} />;
}

type ModalProps = { onClose: () => void };

/* ------------------------------- FOMO ------------------------------------ */
function ExitIntentModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const e = config.exitIntent;
  const status = getStorageStatus(config);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function uploadExitImage(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      window.alert("Ảnh popup cần là PNG, JPG hoặc WebP và tối đa 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      update((d) => (d.exitIntent.imageUrl = reader.result as string));
    };
    reader.readAsDataURL(file);
  }

  return (
    <AdminModal
      title="Exit Intent Popup"
      subtitle="Hiển thị popup khi người dùng sắp rời trang"
      onClose={onClose}
    >
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.className}`}
          >
            {status.label}
          </span>
          <span className="text-[10px] text-neutral-500">{status.detail}</span>
        </div>
      </div>
      <Toggle
        checked={e.enabled}
        onChange={(v) => update((d) => (d.exitIntent.enabled = v))}
        label="Bật popup exit intent"
      />
      <Toggle
        checked={e.showImage}
        onChange={(v) => update((d) => (d.exitIntent.showImage = v))}
        label="Hiển thị ảnh trong popup"
      />
      {e.showImage && (
        <>
          <Field label="URL hình ảnh">
            <div className="flex gap-2">
              <TextInput
                value={e.imageUrl}
                onChange={(event) =>
                  update((d) => (d.exitIntent.imageUrl = event.target.value))
                }
              />
              <button
                type="button"
                onClick={() => update((d) => (d.exitIntent.imageUrl = ""))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
              >
                Xoá
              </button>
            </div>
          </Field>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadExitImage(file);
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
          >
            Tải ảnh popup lên
          </button>
          <Field label="Alt text ảnh">
            <TextInput
              value={e.imageAlt}
              onChange={(event) =>
                update((d) => (d.exitIntent.imageAlt = event.target.value))
              }
            />
          </Field>
          <Field label="Vị trí ảnh trong popup">
            <div className="flex gap-2">
              {(["left", "right"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() =>
                    update((d) => (d.exitIntent.imagePosition = pos))
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    e.imagePosition === pos
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300"
                  }`}
                >
                  {pos === "left" ? "Trái" : "Phải"}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
      <Field label="Mẫu popup">
        <div className="flex flex-wrap gap-2">
          {(["offer", "urgency", "trust", "premium", "limited"] as const).map(
            (template) => (
              <button
                key={template}
                type="button"
                onClick={() =>
                  update((d) => (d.exitIntent.templateId = template))
                }
                className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${
                  e.templateId === template
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300"
                }`}
              >
                {template === "offer"
                  ? "Ưu đãi"
                  : template === "urgency"
                    ? "Khẩn cấp"
                    : template === "trust"
                      ? "Tin cậy"
                      : template === "premium"
                        ? "Premium"
                        : "Giới hạn"}
              </button>
            ),
          )}
        </div>
      </Field>
      <Field label="Badge">
        <TextInput
          value={e.badge}
          onChange={(event) =>
            update((d) => (d.exitIntent.badge = event.target.value))
          }
        />
      </Field>
      <Field label="Tiêu đề">
        <TextInput
          value={e.title}
          onChange={(event) =>
            update((d) => (d.exitIntent.title = event.target.value))
          }
        />
      </Field>
      <Field label="Mô tả">
        <TextArea
          value={e.description}
          onChange={(event) =>
            update((d) => (d.exitIntent.description = event.target.value))
          }
        />
      </Field>
      <Field label="Nút CTA">
        <TextInput
          value={e.ctaLabel}
          onChange={(event) =>
            update((d) => (d.exitIntent.ctaLabel = event.target.value))
          }
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Delay (s)">
          <TextInput
            type="number"
            value={e.triggerDelaySec}
            onChange={(event) =>
              update(
                (d) => (d.exitIntent.triggerDelaySec = +event.target.value),
              )
            }
          />
        </Field>
        <Field label="Thời gian (s)">
          <TextInput
            type="number"
            value={e.minTimeOnPageSec}
            onChange={(event) =>
              update(
                (d) => (d.exitIntent.minTimeOnPageSec = +event.target.value),
              )
            }
          />
        </Field>
        <Field label="Scroll %">
          <TextInput
            type="number"
            value={e.minScrollPercent}
            onChange={(event) =>
              update(
                (d) => (d.exitIntent.minScrollPercent = +event.target.value),
              )
            }
          />
        </Field>
      </div>
      <Toggle
        checked={e.allowMobile}
        onChange={(v) => update((d) => (d.exitIntent.allowMobile = v))}
        label="Hiển thị trên mobile"
      />
      <Toggle
        checked={e.showCloseButton}
        onChange={(v) => update((d) => (d.exitIntent.showCloseButton = v))}
        label="Hiển thị nút đóng"
      />
      <Toggle
        checked={e.respectReducedMotion}
        onChange={(v) => update((d) => (d.exitIntent.respectReducedMotion = v))}
        label="Tắt chuyển động khi người dùng yêu cầu giảm motion"
      />
      <Field label="Vị trí hiển thị">
        <div className="flex gap-2">
          {(["center", "bottom-right", "bottom-left"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => update((d) => (d.exitIntent.position = pos))}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                e.position === pos
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {pos === "center"
                ? "Giữa"
                : pos === "bottom-right"
                  ? "Góc phải"
                  : "Góc trái"}
            </button>
          ))}
        </div>
      </Field>

      <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Xem trước
          </span>
          <span className="text-[10px] text-neutral-500">
            {e.enabled ? "Popup sẽ hiển thị" : "Popup tắt"}
          </span>
        </div>

        <div className="mx-auto max-w-md overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950 shadow-[0_25px_80px_rgba(15,23,42,0.25)]">
          <div className="bg-gradient-to-r from-primary via-amber-500 to-[#f59e0b] px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-white">
            {getExitIntentTemplate(e).badge}
          </div>
          <div
            className={
              e.showImage && e.imageUrl
                ? "grid md:grid-cols-[0.9fr_1.1fr]"
                : "grid grid-cols-1"
            }
          >
            {e.showImage && e.imageUrl && (
              <div className="relative min-h-[180px] overflow-hidden border-b border-white/10 md:border-b-0 md:border-r md:border-white/10">
                <img
                  src={e.imageUrl}
                  alt={e.imageAlt || getExitIntentTemplate(e).title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/20 via-transparent to-transparent" />
              </div>
            )}

            <div className="p-4">
              <h3 className="text-base font-black leading-snug text-white">
                {getExitIntentTemplate(e).title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-200/90">
                {getExitIntentTemplate(e).description}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-3 py-2.5 text-xs font-black text-primary-foreground shadow-[0_10px_24px_rgba(251,191,36,0.3)]"
                >
                  {getExitIntentTemplate(e).cta}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white"
                >
                  Để sau
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SaveHint />
    </AdminModal>
  );
}

function FomoModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const f = config.fomo;
  const previewFomo = () => {
    window.dispatchEvent(
      new CustomEvent("funnel:fomo-preview", {
        detail: {
          name: f.names[0] || "Khách hàng",
          city: f.cities[0] || "Việt Nam",
          at: new Date().toISOString(),
          preview: true,
        },
      }),
    );
  };
  return (
    <AdminModal
      title="Thông Báo FOMO"
      subtitle="Popup 'khách vừa đăng ký' kích thích tâm lý đám đông"
      onClose={onClose}
    >
      <Toggle
        checked={f.enabled}
        onChange={(v) => update((d) => (d.fomo.enabled = v))}
        label="Bật thông báo FOMO"
      />
      <Field
        label="Nguồn dữ liệu"
        hint="Khuyến nghị dùng lead thật để tránh hiển thị thông tin gây hiểu nhầm."
      >
        <div className="flex gap-2">
          {(["recentLeads", "sample"] as const).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => update((d) => (d.fomo.source = source))}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                f.source === source
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {source === "recentLeads" ? "Lead thật" : "Mẫu minh họa"}
            </button>
          ))}
        </div>
      </Field>
      <Toggle
        checked={f.respectReducedMotion}
        onChange={(v) => update((d) => (d.fomo.respectReducedMotion = v))}
        label="Tắt chuyển động khi người dùng yêu cầu giảm motion"
      />
      <Field label="Mẫu nội dung" hint="Dùng {name}, {city}, {mins}">
        <TextInput
          value={f.template}
          onChange={(e) => update((d) => (d.fomo.template = e.target.value))}
        />
      </Field>
      <Field label="Danh sách tên khách (mỗi dòng 1 tên)">
        <TextArea
          value={f.names.join("\n")}
          onChange={(e) =>
            update(
              (d) =>
                (d.fomo.names = e.target.value.split("\n").filter(Boolean)),
            )
          }
        />
      </Field>
      <Field label="Danh sách tỉnh/thành (mỗi dòng 1 địa danh)">
        <TextArea
          value={f.cities.join("\n")}
          onChange={(e) =>
            update(
              (d) =>
                (d.fomo.cities = e.target.value.split("\n").filter(Boolean)),
            )
          }
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Trễ tối thiểu (s)">
          <TextInput
            type="number"
            value={f.minDelaySec}
            onChange={(e) =>
              update((d) => (d.fomo.minDelaySec = +e.target.value))
            }
          />
        </Field>
        <Field label="Trễ tối đa (s)">
          <TextInput
            type="number"
            value={f.maxDelaySec}
            onChange={(e) =>
              update((d) => (d.fomo.maxDelaySec = +e.target.value))
            }
          />
        </Field>
        <Field label="Hiển thị (s)">
          <TextInput
            type="number"
            value={f.displaySec}
            onChange={(e) =>
              update((d) => (d.fomo.displaySec = +e.target.value))
            }
          />
        </Field>
      </div>
      <Field label="Vị trí">
        <div className="flex gap-2">
          {(["left", "right"] as const).map((p) => (
            <button
              key={p}
              onClick={() => update((d) => (d.fomo.position = p))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                f.position === p
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {p === "left" ? "Góc trái" : "Góc phải"}
            </button>
          ))}
        </div>
      </Field>
      <button
        type="button"
        onClick={previewFomo}
        className="w-full rounded-lg border border-sky-300 px-3 py-2 text-xs font-bold text-sky-700"
      >
        Hiện thử popup FOMO
      </button>
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------- FORM ------------------------------------ */
function FormModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const form = config.form;
  const [leadTestMessage, setLeadTestMessage] = useState<string | null>(null);
  const storageStatus = getStorageStatus(config);

  return (
    <AdminModal
      title="Form & Webhook"
      subtitle="Tùy chỉnh nội dung form và kết nối gửi lead"
      onClose={onClose}
    >
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${storageStatus.className}`}
          >
            {storageStatus.label}
          </span>
          <span className="text-[10px] text-neutral-500">
            {storageStatus.detail}
          </span>
        </div>
      </div>
      <Field label="Tiêu đề form">
        <TextInput
          value={form.headline}
          onChange={(e) => update((d) => (d.form.headline = e.target.value))}
        />
      </Field>
      <Field label="Chữ trên nút CTA">
        <TextInput
          value={form.ctaLabel}
          onChange={(e) => update((d) => (d.form.ctaLabel = e.target.value))}
        />
      </Field>
      <Field
        label="Webhook URL (Make/Zapier)"
        hint="Giữ nguyên URL đang chạy để không đứt kết nối"
      >
        <TextInput
          value={form.webhookUrl}
          onChange={(e) => update((d) => (d.form.webhookUrl = e.target.value))}
        />
      </Field>
      <Field label="Redirect sau khi gửi (tùy chọn)">
        <TextInput
          value={form.redirectUrl}
          onChange={(e) => update((d) => (d.form.redirectUrl = e.target.value))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Giới hạn số lần gửi">
          <TextInput
            type="number"
            value={form.rateLimitCount}
            onChange={(e) =>
              update((d) => (d.form.rateLimitCount = +e.target.value))
            }
          />
        </Field>
        <Field label="Trong khoảng (phút)">
          <TextInput
            type="number"
            value={form.rateLimitWindowMin}
            onChange={(e) =>
              update((d) => (d.form.rateLimitWindowMin = +e.target.value))
            }
          />
        </Field>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            const sample: LeadRecord = {
              id: `ld_test_${Date.now()}`,
              at: new Date().toISOString(),
              name: "Lead test",
              phone: "0912345678",
              email: "lead.test@example.com",
              city: "Hà Nội",
              major: "Công nghệ ô tô điện",
              aiScore: 68,
              aiRank: "WARM",
              riskLevel: "review",
              utmSource: "admin_test",
              source: "admin_test",
            } as LeadRecord;
            const saved = await saveLead(sample, config);
            setLeadTestMessage(
              saved.storage === "database"
                ? "Lead mẫu đã được lưu local và gửi lên Supabase thành công."
                : "Lead mẫu đã lưu local thành công. Bật Database mode + credentials để sync cloud.",
            );
          }}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold"
        >
          Tạo lead test
        </button>
      </div>
      {leadTestMessage && (
        <p className="mb-3 text-[11px] font-semibold text-sky-700">
          {leadTestMessage}
        </p>
      )}
      <p className="mb-2 text-xs font-semibold text-neutral-700">
        Nhãn & placeholder các trường
      </p>
      {form.fields.map((field, i) => (
        <div
          key={field.name}
          className="mb-2 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-2"
        >
          <TextInput
            value={field.label}
            onChange={(e) =>
              update((d) => (d.form.fields[i]!.label = e.target.value))
            }
            placeholder="Label"
          />
          <TextInput
            value={field.placeholder}
            onChange={(e) =>
              update((d) => (d.form.fields[i]!.placeholder = e.target.value))
            }
            placeholder="Placeholder"
          />
        </div>
      ))}
      <p className="mt-1 text-[11px] text-neutral-400">
        Dropdown 63 tỉnh/thành (phân theo Miền) và danh sách ngành được giữ
        nguyên trong form.
      </p>
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------ THEME ------------------------------------ */
function ThemeModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const t = config.theme;
  return (
    <AdminModal
      title="Style & Theme"
      subtitle="Màu sắc & font hiển thị"
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Màu chính (primary)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={t.primary}
              onChange={(e) =>
                update((d) => (d.theme.primary = e.target.value))
              }
              className="h-9 w-12 rounded border border-neutral-300"
            />
            <TextInput
              value={t.primary}
              onChange={(e) =>
                update((d) => (d.theme.primary = e.target.value))
              }
            />
          </div>
        </Field>
        <Field label="Màu nhấn (gold)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={t.gold}
              onChange={(e) => update((d) => (d.theme.gold = e.target.value))}
              className="h-9 w-12 rounded border border-neutral-300"
            />
            <TextInput
              value={t.gold}
              onChange={(e) => update((d) => (d.theme.gold = e.target.value))}
            />
          </div>
        </Field>
      </div>
      <Field label="Font tiêu đề">
        <select
          value={t.fontHeading}
          onChange={(e) =>
            update((d) => (d.theme.fontHeading = e.target.value))
          }
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
        >
          <option value="Be Vietnam Pro">Be Vietnam Pro</option>
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Nunito">Nunito</option>
          <option value="Lexend">Lexend</option>
          <option value="Manrope">Manrope</option>
          <option value="Sora">Sora</option>
          <option value="system-ui">System UI</option>
        </select>
      </Field>
      <Field label="Font nội dung">
        <select
          value={t.fontBody}
          onChange={(e) => update((d) => (d.theme.fontBody = e.target.value))}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
        >
          <option value="Be Vietnam Pro">Be Vietnam Pro</option>
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Nunito">Nunito</option>
          <option value="Lexend">Lexend</option>
          <option value="Manrope">Manrope</option>
          <option value="Sora">Sora</option>
          <option value="system-ui">System UI</option>
        </select>
      </Field>
      <p className="text-[11px] text-neutral-400">
        Màu và font này được áp dụng chung cho trang chủ, trang phụ và các khối
        nội dung.
      </p>
      <SaveHint />
    </AdminModal>
  );
}

/* ---------------------------- COUNTDOWN ---------------------------------- */
function CountdownModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const c = config.countdown;
  return (
    <AdminModal
      title="Đồng Hồ Đếm Ngược"
      subtitle="Tạo cảm giác khan hiếm & khẩn cấp"
      onClose={onClose}
    >
      <Toggle
        checked={c.enabled}
        onChange={(v) => update((d) => (d.countdown.enabled = v))}
        label="Bật countdown"
      />
      <Field label="Số suất còn lại">
        <TextInput
          type="number"
          value={c.slotsLeft}
          onChange={(e) =>
            update((d) => (d.countdown.slotsLeft = +e.target.value))
          }
        />
      </Field>
      <Toggle
        checked={c.autoDecrement !== false}
        onChange={(v) => update((d) => (d.countdown.autoDecrement = v))}
        label="Tự giảm số suất khi có khách đăng ký"
      />
      <Field label="Giao diện countdown">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { value: "classic", label: "Classic" },
            { value: "premium", label: "Premium" },
            { value: "urgent", label: "Urgent" },
            { value: "minimal", label: "Minimal" },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() =>
                update(
                  (d) =>
                    (d.countdown.template =
                      preset.value as typeof d.countdown.template),
                )
              }
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                c.template === preset.value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Dòng chữ mô tả">
        <TextInput
          value={c.headline}
          onChange={(e) =>
            update((d) => (d.countdown.headline = e.target.value))
          }
        />
      </Field>
      <Field label="Mốc kết thúc">
        <div className="flex gap-2">
          {(["endOfMonth", "fixed"] as const).map((m) => (
            <button
              key={m}
              onClick={() => update((d) => (d.countdown.endMode = m))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                c.endMode === m
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {m === "endOfMonth" ? "Cuối tháng" : "Ngày cố định"}
            </button>
          ))}
        </div>
      </Field>
      {c.endMode === "fixed" && (
        <Field label="Ngày kết thúc">
          <TextInput
            type="datetime-local"
            value={c.endDate}
            onChange={(e) =>
              update((d) => (d.countdown.endDate = e.target.value))
            }
          />
        </Field>
      )}
      <SaveHint />
    </AdminModal>
  );
}

/* ---------------------------- CONTACT ------------------------------------ */
function ContactModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const c = config.floatingContact;
  return (
    <AdminModal
      title="Hotline & Zalo"
      subtitle="Nút liên hệ nổi + thanh CTA mobile"
      onClose={onClose}
    >
      <Toggle
        checked={c.enabled}
        onChange={(v) => update((d) => (d.floatingContact.enabled = v))}
        label="Bật nút liên hệ nổi"
      />
      <Toggle
        checked={c.animateHotline !== false}
        onChange={(v) => update((d) => (d.floatingContact.animateHotline = v))}
        label="Hiệu ứng nút gọi hotline"
      />
      <Toggle
        checked={c.animateMessenger !== false}
        onChange={(v) =>
          update((d) => (d.floatingContact.animateMessenger = v))
        }
        label="Hiệu ứng nút Messenger"
      />
      <Field label="Số hotline">
        <TextInput
          value={c.hotline}
          onChange={(e) =>
            update((d) => (d.floatingContact.hotline = e.target.value))
          }
        />
      </Field>
      <Field label="Link Zalo">
        <TextInput
          value={c.zalo}
          onChange={(e) =>
            update((d) => (d.floatingContact.zalo = e.target.value))
          }
        />
      </Field>
      <Field label="Link Messenger (tùy chọn)">
        <TextInput
          value={c.messenger}
          onChange={(e) =>
            update((d) => (d.floatingContact.messenger = e.target.value))
          }
        />
      </Field>
      <SaveHint />
    </AdminModal>
  );
}

/* ----------------------------- TRACKING / PIXEL --------------------------- */
function PixelModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const t = config.tracking;
  const [logs, setLogs] = useState<TestEventLog[] | null>(null);
  const storageStatus = getStorageStatus(config);

  return (
    <AdminModal
      title="Pixel & Sự Kiện Ads"
      subtitle="Facebook, TikTok, GA4, GTM"
      onClose={onClose}
    >
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${storageStatus.className}`}
          >
            {storageStatus.label}
          </span>
          <span className="text-[10px] text-neutral-500">
            {storageStatus.detail}
          </span>
        </div>
      </div>
      <Field label="Facebook Pixel ID">
        <TextInput
          value={t.facebookPixelId}
          onChange={(e) =>
            update((d) => (d.tracking.facebookPixelId = e.target.value))
          }
        />
      </Field>
      <Field label="TikTok Pixel ID">
        <TextInput
          value={t.tiktokPixelId}
          onChange={(e) =>
            update((d) => (d.tracking.tiktokPixelId = e.target.value))
          }
        />
      </Field>
      <Field
        label="TikTok Events API Access Token"
        hint="Chỉ dùng ở backend/server; không nhúng token vào mã trình duyệt."
      >
        <TextInput
          type="password"
          value={t.tiktokAccessToken}
          autoComplete="new-password"
          onChange={(e) =>
            update((d) => (d.tracking.tiktokAccessToken = e.target.value))
          }
        />
      </Field>
      <Field label="GA4 Measurement ID">
        <TextInput
          value={t.ga4Id}
          onChange={(e) => update((d) => (d.tracking.ga4Id = e.target.value))}
        />
      </Field>
      <Field label="Google Tag Manager ID">
        <TextInput
          value={t.gtmId}
          onChange={(e) => update((d) => (d.tracking.gtmId = e.target.value))}
        />
      </Field>
      <p className="mb-2 text-xs font-semibold text-neutral-700">
        Bật/tắt sự kiện chuyển đổi
      </p>
      <Toggle
        checked={t.events.pageView}
        onChange={(v) => update((d) => (d.tracking.events.pageView = v))}
        label="PageView"
      />
      <Toggle
        checked={t.events.formStart}
        onChange={(v) => update((d) => (d.tracking.events.formStart = v))}
        label="Form Start"
      />
      <Toggle
        checked={t.events.lead}
        onChange={(v) => update((d) => (d.tracking.events.lead = v))}
        label="Lead"
      />
      <Toggle
        checked={t.events.completeRegistration}
        onChange={(v) =>
          update((d) => (d.tracking.events.completeRegistration = v))
        }
        label="CompleteRegistration"
      />
      <Toggle
        checked={t.events.click !== false}
        onChange={(v) => update((d) => (d.tracking.events.click = v))}
        label="Click CTA / Hotline / Zalo / Messenger"
      />
      <Toggle
        checked={t.events.scroll !== false}
        onChange={(v) => update((d) => (d.tracking.events.scroll = v))}
        label="Scroll depth 25 / 50 / 75 / 90%"
      />
      <div className="mt-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <button
          onClick={() => setLogs(fireTestEvent())}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-neutral-900"
        >
          Kiểm tra / Bắn sự kiện thử
        </button>
        <p className="mt-2 text-[11px] text-neutral-400">
          Lưu cấu hình, tải lại trang rồi kiểm tra. Sự kiện thử không phải là
          chuyển đổi thật và không gửi lead.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] text-neutral-500">
          <li>Meta: lấy Pixel ID trong Events Manager.</li>
          <li>
            TikTok: lấy Pixel ID trong Events Manager; Access Token chỉ cấu hình
            ở server.
          </li>
          <li>GA4: dùng Measurement ID dạng G-XXXXXXXXXX.</li>
          <li>GTM: dùng Container ID dạng GTM-XXXXXXX rồi kiểm tra Preview.</li>
          <li>Dùng nút kiểm tra, xem log Admin và DebugView/Test Events.</li>
        </ol>
        {logs && (
          <ul className="mt-3 space-y-1.5">
            {logs.map((l) => (
              <li
                key={l.channel}
                className="flex items-start gap-2 text-[11px]"
              >
                <span className={l.ok ? "text-emerald-500" : "text-red-500"}>
                  {l.ok ? "●" : "○"}
                </span>
                <span>
                  <strong>{l.channel}</strong> — {l.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------- WEBMASTER / SCRIPTS ---------------------------- */
function WebmasterModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const t = config.tracking;
  return (
    <AdminModal
      title="Webmaster & Custom Scripts"
      subtitle="Pixel, tracking, xác minh Google và mã tùy chỉnh"
      onClose={onClose}
    >
      <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
        Cấu hình Pixel, sự kiện quảng cáo và kiểm tra tracking nằm ở mục
        <strong> Pixel &amp; Sự Kiện Ads</strong> trong toolbar. Tránh chỉnh
        trùng lặp ở hai nơi khác nhau.
      </p>
      <Field label="Google Search Console verification">
        <TextInput
          value={t.googleVerification}
          onChange={(e) =>
            update((d) => (d.tracking.googleVerification = e.target.value))
          }
        />
      </Field>
      <Field label="Custom Script — Head">
        <TextArea
          value={t.customHead}
          onChange={(e) =>
            update((d) => (d.tracking.customHead = e.target.value))
          }
        />
      </Field>
      <Field label="Custom Script — Body">
        <TextArea
          value={t.customBody}
          onChange={(e) =>
            update((d) => (d.tracking.customBody = e.target.value))
          }
        />
      </Field>
      <Field label="Custom Script — Footer">
        <TextArea
          value={t.customFooter}
          onChange={(e) =>
            update((d) => (d.tracking.customFooter = e.target.value))
          }
        />
      </Field>
      <SaveHint />
    </AdminModal>
  );
}

/* -------------------------------- SEO ------------------------------------ */
function SeoModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const s = config.seo;
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const titleLength = s.title.trim().length;
  const descriptionLength = s.description.trim().length;
  const ogValue = s.ogImage.trim();
  const faviconValue = s.faviconUrl.trim();
  const hasBadOgImage =
    Boolean(ogValue) && !/^https?:\/\//i.test(ogValue) && !/^\//.test(ogValue);
  const hasBadFavicon =
    Boolean(faviconValue) &&
    !/^https?:\/\//i.test(faviconValue) &&
    !/^\//.test(faviconValue) &&
    !/^data:image\//i.test(faviconValue);
  const hasBadSchema =
    !s.schemaType.trim() || !/^[A-Za-z][A-Za-z0-9]+$/.test(s.schemaType.trim());

  return (
    <AdminModal
      title="SEO Google"
      subtitle="Meta tags & schema"
      onClose={onClose}
    >
      <Field label="Meta Title">
        <TextInput
          value={s.title}
          onChange={(e) => update((d) => (d.seo.title = e.target.value))}
        />
      </Field>
      <p
        className={`text-[11px] ${titleLength > 60 ? "text-amber-600" : "text-neutral-400"}`}
      >
        Meta Title: {titleLength}/60 ký tự
      </p>
      <Field label="Meta Description">
        <TextArea
          value={s.description}
          onChange={(e) => update((d) => (d.seo.description = e.target.value))}
        />
      </Field>
      <p
        className={`text-[11px] ${descriptionLength > 160 ? "text-amber-600" : "text-neutral-400"}`}
      >
        Meta Description: {descriptionLength}/160 ký tự
      </p>
      <Field label="Keywords">
        <TextInput
          value={s.keywords}
          onChange={(e) => update((d) => (d.seo.keywords = e.target.value))}
        />
      </Field>
      <Field
        label="OG Image URL hoặc ảnh tải lên"
        hint="Dùng ảnh 1200x630 để tối ưu SEO/Share social. Tải lên tối đa 1MB."
      >
        <div className="space-y-2">
          <TextInput
            value={s.ogImage}
            placeholder="/og-image.jpg hoặc https://..."
            onChange={(e) => update((d) => (d.seo.ogImage = e.target.value))}
          />
          {hasBadOgImage && (
            <p className="text-[11px] font-medium text-amber-600">
              OG Image nên là đường dẫn tương đối /ảnh.jpg hoặc URL tuyệt đối
              https://...
            </p>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || file.size > 1024 * 1024) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string")
                  update((d) => (d.seo.ogImage = reader.result as string));
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={(event) => {
              const target = event.currentTarget
                .previousElementSibling as HTMLInputElement | null;
              target?.click();
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold"
          >
            Chọn OG Image
          </button>
          {s.ogImage.trim() && (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <img
                src={
                  /^https?:\/\//i.test(s.ogImage.trim()) ||
                  /^\//.test(s.ogImage.trim()) ||
                  /^data:image\//i.test(s.ogImage.trim())
                    ? s.ogImage.trim()
                    : ""
                }
                alt="OG preview"
                className="h-32 w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </Field>
      <Field
        label="Favicon URL hoặc ảnh tải lên"
        hint="Dùng .ico/.png/.svg; ảnh tải lên tối đa 512KB."
      >
        <div className="space-y-2">
          <TextInput
            value={s.faviconUrl}
            placeholder="/favicon.ico hoặc https://..."
            onChange={(e) => update((d) => (d.seo.faviconUrl = e.target.value))}
          />
          {hasBadFavicon && (
            <p className="text-[11px] font-medium text-amber-600">
              Favicon nên là /favicon.ico, https://... hoặc data:image/...
            </p>
          )}
          <input
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || file.size > 512 * 1024) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string")
                  update((d) => (d.seo.faviconUrl = reader.result as string));
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => faviconInputRef.current?.click()}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold"
          >
            Chọn favicon
          </button>
        </div>
      </Field>
      <Field label="Schema Type">
        <TextInput
          value={s.schemaType}
          onChange={(e) => update((d) => (d.seo.schemaType = e.target.value))}
        />
      </Field>
      {hasBadSchema && (
        <p className="-mt-2 text-[11px] font-medium text-amber-600">
          Schema nên là dạng chuẩn Schema.org, ví dụ: EducationalOrganization,
          Organization, WebSite
        </p>
      )}
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------- AI --------------------------------------- */
function AiModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const a = config.aiAdvisor;
  return (
    <AdminModal
      title="AI Sales Advisor"
      subtitle="Ma trận chấm điểm & phân hạng lead"
      onClose={onClose}
    >
      <Toggle
        checked={a.enabled}
        onChange={(v) => update((d) => (d.aiAdvisor.enabled = v))}
        label="Bật gợi ý AI Sales"
      />
      <Field label="Regex nhận diện thiết bị VIP">
        <TextInput
          value={a.vipDeviceRegex}
          onChange={(e) =>
            update((d) => (d.aiAdvisor.vipDeviceRegex = e.target.value))
          }
        />
      </Field>
      <Field label="Tỉnh trọng điểm (phân tách bằng |)">
        <TextInput
          value={a.keyRegions}
          onChange={(e) =>
            update((d) => (d.aiAdvisor.keyRegions = e.target.value))
          }
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Điền nhanh (<s) = bot">
          <TextInput
            type="number"
            value={a.fastFillThresholdSec}
            onChange={(e) =>
              update(
                (d) => (d.aiAdvisor.fastFillThresholdSec = +e.target.value),
              )
            }
          />
        </Field>
        <Field label="VIP: xem web (s)">
          <TextInput
            type="number"
            value={a.vipTimeOnPageSec}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.vipTimeOnPageSec = +e.target.value))
            }
          />
        </Field>
        <Field label="VIP: cuộn (%)">
          <TextInput
            type="number"
            value={a.vipScrollPercent}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.vipScrollPercent = +e.target.value))
            }
          />
        </Field>
      </div>
      <p className="mt-3 mb-1 text-xs font-bold text-neutral-700">
        Trọng số chấm điểm (tổng 100)
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Thiết bị VIP">
          <TextInput
            type="number"
            value={a.weightDevice}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightDevice = +e.target.value))
            }
          />
        </Field>
        <Field label="Tỉnh trọng điểm">
          <TextInput
            type="number"
            value={a.weightRegion}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightRegion = +e.target.value))
            }
          />
        </Field>
        <Field label="Điền nhanh (bot)">
          <TextInput
            type="number"
            value={a.weightFastFill}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightFastFill = +e.target.value))
            }
          />
        </Field>
        <Field label="Thời gian trên trang">
          <TextInput
            type="number"
            value={a.weightTimeOnPage}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightTimeOnPage = +e.target.value))
            }
          />
        </Field>
        <Field label="Độ sâu cuộn">
          <TextInput
            type="number"
            value={a.weightScroll}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightScroll = +e.target.value))
            }
          />
        </Field>
        <Field label="Quay lại nhiều lần">
          <TextInput
            type="number"
            value={a.weightReturnVisit}
            onChange={(e) =>
              update((d) => (d.aiAdvisor.weightReturnVisit = +e.target.value))
            }
          />
        </Field>
      </div>
      <Field
        label="Mẫu kịch bản gọi"
        hint="Dùng {name} {city} {major} {ai_rank} {ai_score} {sale_advice}"
      >
        <TextArea
          value={a.callScriptTemplate}
          onChange={(e) =>
            update((d) => (d.aiAdvisor.callScriptTemplate = e.target.value))
          }
        />
      </Field>
      <SaveHint />
    </AdminModal>
  );
}

const TEMPLATE_VARIABLES = [
  {
    key: "rank",
    example: "VIP",
    meaning:
      "Xếp hạng lead do AI chấm từ mức độ quan tâm và hành vi trên trang.",
  },
  {
    key: "recommendation",
    example: "Gọi tư vấn ngay",
    meaning:
      "Khuyến nghị hành động cho sales: gọi, nhắn Zalo, hẹn tư vấn, hoặc xác minh lead.",
  },
  {
    key: "details",
    example: "Khách xem kỹ phần lương thực tập và đầu ra nghề nghiệp.",
    meaning:
      "Mô tả chi tiết lý do AI đánh giá, thường là gợi ý hành vi / trải nghiệm trên trang.",
  },
  {
    key: "timeOnPage",
    example: "142 giây",
    meaning: "Thời gian khách lưu lại trên trang, cho biết mức độ quan tâm.",
  },
  {
    key: "firstInteraction",
    example: "3 giây",
    meaning:
      "Thời gian tới lần tương tác đầu tiên: càng nhanh thì lead càng có tín hiệu quyết định sớm.",
  },
  {
    key: "scrollDepth",
    example: "74%",
    meaning:
      "Mức độ cuộn trang; khi cao và kéo dài cho thấy người dùng đã đọc nội dung sâu.",
  },
  {
    key: "focusSection",
    example: "lương_thuc_tap",
    meaning:
      "Phần nội dung mà khách dừng lâu nhất như ngành học, học phí, lương thực tập.",
  },
  {
    key: "device",
    example: "iPhone 15",
    meaning:
      "Thiết bị đang dùng giúp nhận diện mức độ mobile-first hoặc niềm tin sản phẩm.",
  },
  {
    key: "os",
    example: "iOS 17",
    meaning: "Hệ điều hành của thiết bị.",
  },
  {
    key: "browser",
    example: "Safari",
    meaning: "Trình duyệt, dùng để hiểu trải nghiệm và cách lead tương tác.",
  },
  {
    key: "network",
    example: "5G",
    meaning:
      "Mạng đang truy cập, giúp đánh giá mức độ ổn định và sự chú ý khi dùng điện thoại.",
  },
  {
    key: "battery",
    example: "78% · đang sạc",
    meaning:
      "Mức pin và trạng thái sạc cho biết lead có đang thao tác nhanh hay cần nhắn lại sau.",
  },
  {
    key: "screen",
    example: "390×844px",
    meaning: "Kích thước màn hình, hỗ trợ phân tích trải nghiệm mobile.",
  },
  {
    key: "source",
    example: "Facebook",
    meaning: "Nguồn tiếp cận, như Facebook, Google, TikTok, Zalo, Direct.",
  },
  {
    key: "medium",
    example: "cpc",
    meaning: "Kênh quảng cáo: cpc, social, organic, email, referral...",
  },
  {
    key: "campaign",
    example: "duhoc_q4_2026",
    meaning:
      "Tên chiến dịch quảng cáo, rất quan trọng để so sánh hiệu quả từng chiến dịch.",
  },
  {
    key: "content",
    example: "ads_variant_a",
    meaning:
      "Biến thể nội dung quảng cáo; dùng để biết bài nào hoạt động tốt hơn.",
  },
  {
    key: "term",
    example: "du học nghề trung quốc",
    meaning: "Từ khóa tìm kiếm được dùng, rất hữu ích cho campañas tìm kiếm.",
  },
  {
    key: "city",
    example: "Nghệ An",
    meaning:
      "Tỉnh / thành phố người dùng đã điền trên form, dùng để cá nhân hóa call script.",
  },
  {
    key: "major",
    example: "Điện tử công nghiệp",
    meaning:
      "Ngành quan tâm, dùng để đưa ra gợi ý phù hợp với nhu cầu thật của khách.",
  },
  {
    key: "score",
    example: "86",
    meaning: "Điểm đánh giá tổng hợp AI, giúp ưu tiên lead cần gỡ nhất.",
  },
  {
    key: "risk",
    example: "low",
    meaning:
      "Mức độ rủi ro: low, review, high. Có thể dùng để xác định mức độ xác minh trước khi gọi.",
  },
  {
    key: "reasons",
    example: "Thời gian điền form dưới 4 giây; cuộn 74%",
    meaning:
      "Cụm lý do AI đánh giá lead, thường dùng để giải thích vì sao lead được xếp hạng như vậy.",
  },
] as const;

const SALE_ADVICE_PRESET_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "industry", label: "Theo ngành" },
  { key: "traffic", label: "Theo kênh" },
  { key: "premium", label: "VIP / cao cấp" },
] as const;

const SALE_ADVICE_PRESET_GROUPS = [
  {
    title: "Khởi động lead mới",
    description:
      "Mẫu dùng cho lead vừa tiếp cận, cần định hướng nhanh và giữ nhịp tư vấn.",
    filter: "industry",
    presets: [
      {
        label: "Sales Premium",
        description:
          "Tổng hợp tín hiệu lead bằng ngôn ngữ chuyên nghiệp, rõ trọng tâm.",
        saleAdvice:
          "⭐ {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n📱 {device} · {os} · {browser}\n📡 {network} · {battery}\n🎯 {source} / {medium} / {campaign}",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth} · {focusSection}\n🧠 {details}\n📌 {city} · {major}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}\n📐 {screen}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🧩 {content}\n🔍 {term}",
      },
      {
        label: "CRM Simple",
        description: "Dạng tối giản cho CRM, dễ lưu, dễ đọc và dễ chuyển sale.",
        saleAdvice: "{rank} · {recommendation}\n{city} · {major}\n{details}",
        behaviorSummary:
          "{timeOnPage} · {firstInteraction} · {scrollDepth} · {focusSection}\n{details}",
        deviceTechInfo:
          "{device}\n{os}\n{browser}\n{network}\n{battery}\n{screen}",
        trafficAdsSource: "{source}\n{medium}\n{campaign}\n{content}\n{term}",
      },
      {
        label: "Call Script",
        description: "Ngắn, rõ, gọn cho nhân viên gọi lại trên điện thoại.",
        saleAdvice:
          "⭐ {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n👉 Gọi: {device} · {network} · {source}",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n{details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource:
          "🎯 {source} / {medium} / {campaign}\n🧩 {content} / {term}",
      },
    ],
  },
  {
    title: "Lo lắng / đối kháng",
    description:
      "Dành cho lead sợ chi phí, lo tiếng Trung, hoặc đang so sánh giữa nhiều lựa chọn.",
    filter: "industry",
    presets: [
      {
        label: "Ngân sách lo lắng",
        description:
          "Chốt vào chi phí thực tế và giá trị đầu ra để gỡ tâm lý nghi ngờ.",
        saleAdvice:
          "💸 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n⚠️ Khách đang tập trung vào học phí, chi phí sinh hoạt và lợi ích thực tế của khóa học.\n👉 Nên giải thích rõ học phí 0Đ, lộ trình chi tiết, lương thực tập và đầu ra nghề nghiệp.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
      {
        label: "Sợ tiếng Trung",
        description:
          "Giải quyết nỗi lo ngôn ngữ và khiến khách cảm thấy được hỗ trợ từ đầu.",
        saleAdvice:
          "🗣️ {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n✅ Khách đang lo ngại về điều kiện tiếng Trung.\n👉 Nên nhấn mạnh lộ trình học từ cơ bản, hỗ trợ từ đầu, không cần giỏi ngay.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🧩 {content}",
      },
      {
        label: "Đang so sánh ngành",
        description:
          "Khi khách đang cân nhắc giữa 2–3 lựa chọn, cần so sánh dữ liệu rõ ràng.",
        saleAdvice:
          "📊 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n🔁 Khách đang so sánh ngành và đang cân nhắc giữa 2–3 lựa chọn.\n👉 Nên so sánh thu nhập, thời gian học, lộ trình và cơ hội việc làm thực tế.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n📐 {screen}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
    ],
  },
  {
    title: "Theo nguồn tiếp cận",
    description:
      "Nội dung nhắn ngắn phù hợp với từng kênh khách đến từ Facebook, Google, mobile hoặc desktop.",
    filter: "traffic",
    presets: [
      {
        label: "Lead từ Facebook",
        description:
          "Ngắn gọn, trực tiếp, thân thiện để chuyển lead từ social thành cuộc gọi nhanh.",
        saleAdvice:
          "📘 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n📲 Khách đến từ Facebook, nên ưu tiên nhắn tin ngắn, trực tiếp và dễ hiểu.\n👉 Gửi Zalo + ưu đãi rõ ràng + lịch tư vấn 1:1.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🧩 {content}\n🔍 {term}",
      },
      {
        label: "Lead từ Google Ads",
        description:
          "Dùng khi khách đã có nhu cầu cụ thể và cần tạo cảm giác thuyết phục thực tế.",
        saleAdvice:
          "🔎 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n🎯 Khách đến từ Google Ads, đã tìm kiếm theo nhu cầu cụ thể.\n👉 Nên tập trung vào lợi ích thực tế, đầu ra, chi phí và kế hoạch học.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}\n🧩 {content}",
      },
      {
        label: "Lead mobile",
        description:
          "Phù hợp với lead đang dùng điện thoại, cần ngắn, dễ nhắn, dễ chốt lịch.",
        saleAdvice:
          "📱 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n📲 Khách đang dùng điện thoại, nên ưu tiên nội dung ngắn gọn và CTA rõ.\n👉 Gửi Zalo, ảnh minh họa và hẹn gọi ngắn trong 1–2 phút.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n📐 {screen}\n🔋 {battery}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
      {
        label: "Lead desktop",
        description:
          "Phù hợp lead đọc kỹ, cần tư vấn chuyên sâu và hình ảnh tin cậy hơn.",
        saleAdvice:
          "💻 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n🖥️ Khách đang dùng desktop, có xu hướng đọc kỹ và yêu cầu thông tin sâu.\n👉 Nêu rõ quy trình, đầu ra, môi trường học và độ tin cậy của chương trình.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "💻 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n📐 {screen}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
    ],
  },
  {
    title: "VIP / cao cấp",
    description:
      "Cho lead có tín hiệu rõ và đã sẵn sàng cho tư vấn 1:1, thuyết phục chuẩn sales Việt Nam.",
    filter: "premium",
    presets: [
      {
        label: "Premium Executive",
        description:
          "Mẫu cao cấp cho lead có tín hiệu quan tâm nghiêm túc và cần chốt lịch ngay.",
        saleAdvice:
          "⭐ {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n🔑 Lead này có tín hiệu quan tâm nghiêm túc, nên ưu tiên tư vấn 1:1 và xây dựng lộ trình rõ ràng ngay trong lần đầu liên hệ.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}\n📐 {screen}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🧩 {content}\n🔍 {term}",
      },
      {
        label: "VIP Sales Việt Nam",
        description:
          "Phong cách chuyên nghiệp, gọn, sát thị trường và dễ dùng cho sales Việt Nam.",
        saleAdvice:
          "🏆 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n✅ Đây là lead có chất lượng cao, phù hợp tư vấn trực tiếp theo hướng chăm sóc và khóa học thực tế, không cần nhắn dài.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource:
          "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🧩 {content}\n🔍 {term}",
      },
      {
        label: "Chốt lịch 1:1",
        description:
          "Mẫu cao cấp cho lead đã sẵn sàng và cần hướng dẫn chốt lịch trực tiếp.",
        saleAdvice:
          "📌 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n🎯 Lead đã thể hiện nhu cầu rõ ràng, nên ưu tiên tư vấn trực tiếp, ngắn gọn, đúng trọng tâm và không lan man.\n👉 Mời đặt lịch tư vấn 1:1 ngay trong ngày để có lộ trình rõ ràng.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n🔋 {battery}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
      {
        label: "Tư vấn chuyên sâu",
        description:
          "Cho nhu cầu cần giải thích kỹ về ngành, lộ trình và đầu ra để tạo niềm tin.",
        saleAdvice:
          "🧭 {rank} · {recommendation}\n📍 {city} · {major}\n🧠 {details}\n📘 Khách đang cần tư vấn chi tiết về ngành, đầu ra và lộ trình học. Hãy giải thích dựa trên thực tế, không dùng lời quá quảng cáo.",
        behaviorSummary:
          "⏱️ {timeOnPage} · {firstInteraction} · {scrollDepth}\n🎯 {focusSection}\n🧠 {details}",
        deviceTechInfo:
          "📱 {device}\n🧩 {os}\n🌐 {browser}\n📡 {network}\n📐 {screen}",
        trafficAdsSource: "🎯 {source}\n📣 {medium}\n🏷️ {campaign}\n🔍 {term}",
      },
    ],
  },
] as const;

const TOTAL_PRESET_COUNT = SALE_ADVICE_PRESET_GROUPS.reduce(
  (total, group) => total + group.presets.length,
  0,
);

function PreviewTemplateCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "sky" | "slate";
  children: React.ReactNode;
}) {
  const toneClasses = {
    emerald:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    sky: "border-sky-200 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10",
    slate:
      "border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-900",
  };
  const headingClasses = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    sky: "text-sky-700 dark:text-sky-300",
    slate: "text-neutral-500",
  };

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneClasses[tone]}`}>
      <p
        className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${headingClasses[tone]}`}
      >
        {title}
      </p>
      <div className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

function SalesAdviceModal({ onClose }: ModalProps) {
  const { config, update, save, dirty } = useSiteConfig();
  const salesAdvice = config.salesAdvice;
  const [saveMessage, setSaveMessage] = useState("Chưa lưu lần cuối");
  const [saving, setSaving] = useState(false);
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);
  const [presetFilter, setPresetFilter] =
    useState<(typeof SALE_ADVICE_PRESET_FILTERS)[number]["key"]>("all");

  const filteredPresetGroups = SALE_ADVICE_PRESET_GROUPS.filter(
    (group) => presetFilter === "all" || group.filter === presetFilter,
  );

  const handleSaveAndSync = async () => {
    setSaving(true);
    try {
      const ok = await save();
      if (ok) {
        const modeText =
          config.admin.storageMode === "database"
            ? "đã lưu và đồng bộ lên Supabase"
            : "đã lưu local thành công";
        setSaveMessage(`Cấu hình ${modeText}.`);
      } else {
        setSaveMessage(
          "Lưu cục bộ thành công, nhưng đồng bộ dữ liệu chưa hoàn tất.",
        );
      }
    } catch {
      setSaveMessage("Không thể lưu cấu hình lúc này. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreset = async (preset: {
    label: string;
    saleAdvice: string;
    behaviorSummary: string;
    deviceTechInfo: string;
    trafficAdsSource: string;
  }) => {
    const copyText = [
      `=== ${preset.label} ===`,
      "",
      "sale_advice:",
      preset.saleAdvice,
      "",
      "behavior_summary:",
      preset.behaviorSummary,
      "",
      "device_tech_info:",
      preset.deviceTechInfo,
      "",
      "traffic_ads_source:",
      preset.trafficAdsSource,
    ].join("\n");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const helper = document.createElement("textarea");
        helper.value = copyText;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }
      setCopiedPreset(preset.label);
      window.setTimeout(
        () =>
          setCopiedPreset((current) =>
            current === preset.label ? null : current,
          ),
        1200,
      );
    } catch {
      setCopiedPreset("copy-failed");
      window.setTimeout(() => setCopiedPreset(null), 1200);
    }
  };

  const handleCopyAllTemplates = async () => {
    const copyText = [
      "=== sale_advice ===",
      salesAdvice.saleAdviceTemplate,
      "",
      "=== behavior_summary ===",
      salesAdvice.behaviorSummaryTemplate,
      "",
      "=== device_tech_info ===",
      salesAdvice.deviceTechInfoTemplate,
      "",
      "=== traffic_ads_source ===",
      salesAdvice.trafficAdsSourceTemplate,
    ].join("\n");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const helper = document.createElement("textarea");
        helper.value = copyText;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }
      setCopiedPreset("all-templates");
      window.setTimeout(
        () =>
          setCopiedPreset((current) =>
            current === "all-templates" ? null : current,
          ),
        1200,
      );
    } catch {
      setCopiedPreset("copy-failed");
      window.setTimeout(() => setCopiedPreset(null), 1200);
    }
  };

  return (
    <AdminModal
      title="Webhook Tracking Studio"
      subtitle="Tùy biến thông điệp theo hành vi khách trước khi gửi webhook"
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
            Webhook payload đang gửi
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
            Các trường <strong>sale_advice</strong>,{" "}
            <strong>behavior_summary</strong>, <strong>device_tech_info</strong>
            , <strong>traffic_ads_source</strong> đã được đính kèm vào lead
            submit và sẽ đi ra webhook theo nhịp real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveAndSync()}
            disabled={saving}
            className="rounded-lg border border-amber-700 bg-amber-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu + Sync"}
          </button>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
              dirty
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-neutral-200 bg-white text-neutral-600 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            {dirty ? "Có thay đổi" : "Đã lưu"}
          </span>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
          Trạng thái lưu & đồng bộ
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-200">
          {saveMessage}
        </p>
      </div>

      <Toggle
        checked={salesAdvice.enabled}
        onChange={(v) => update((d) => (d.salesAdvice.enabled = v))}
        label="Bật bộ kịch bản sale advice"
      />

      <div className="space-y-3">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Cài đặt template webhook
          </p>
          <Field label="Template sale_advice">
            <TextArea
              value={salesAdvice.saleAdviceTemplate}
              onChange={(e) =>
                update(
                  (d) => (d.salesAdvice.saleAdviceTemplate = e.target.value),
                )
              }
            />
          </Field>
          <Field label="Template behavior_summary">
            <TextArea
              value={salesAdvice.behaviorSummaryTemplate}
              onChange={(e) =>
                update(
                  (d) =>
                    (d.salesAdvice.behaviorSummaryTemplate = e.target.value),
                )
              }
            />
          </Field>
          <Field label="Template device_tech_info">
            <TextArea
              value={salesAdvice.deviceTechInfoTemplate}
              onChange={(e) =>
                update(
                  (d) =>
                    (d.salesAdvice.deviceTechInfoTemplate = e.target.value),
                )
              }
            />
          </Field>
          <Field label="Template traffic_ads_source">
            <TextArea
              value={salesAdvice.trafficAdsSourceTemplate}
              onChange={(e) =>
                update(
                  (d) =>
                    (d.salesAdvice.trafficAdsSourceTemplate = e.target.value),
                )
              }
            />
          </Field>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Thành phần biến hỗ trợ
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <div
                  key={variable.key}
                  className="rounded-lg border border-amber-200 bg-white p-2 dark:border-white/10 dark:bg-neutral-900"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                    {"{"}
                    {variable.key}
                    {"}"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    {variable.example}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {variable.meaning}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-200">
              Mục tiêu: dùng biến để mô tả hành vi thật của khách, chuyển đổi
              data tracking thành câu văn phục vụ call script, nhắn tin, hoặc
              webhook CRM. Mỗi biến nên được dùng đúng mục đích:{" "}
              <span className="font-semibold">rank / recommendation</span> cho
              quyết định,{" "}
              <span className="font-semibold">
                timeOnPage / scrollDepth / focusSection
              </span>{" "}
              cho hành vi,{" "}
              <span className="font-semibold">
                device / os / browser / network
              </span>{" "}
              cho bối cảnh kỹ thuật,{" "}
              <span className="font-semibold">
                source / medium / campaign / content / term
              </span>{" "}
              cho traffic.
            </p>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  Template mẫu đẹp sẵn
                </p>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {TOTAL_PRESET_COUNT} mẫu
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SALE_ADVICE_PRESET_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setPresetFilter(filter.key)}
                    className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] transition ${
                      presetFilter === filter.key
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleCopyAllTemplates()}
                  className="ml-auto rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
                >
                  {copiedPreset === "all-templates"
                    ? "Copied"
                    : "Copy all 4 template"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredPresetGroups.map((group) => (
                <div key={group.title} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-100/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                        {group.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                        {group.description}
                      </p>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                      {group.presets.length}
                    </span>
                  </div>

                  <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                    {group.presets.map((preset) => {
                      const leadTarget =
                        preset.label.includes("Facebook") ||
                        preset.label.includes("Google")
                          ? "Social / Search"
                          : preset.label.includes("mobile") ||
                              preset.label.includes("desktop")
                            ? "Device UX"
                            : preset.label.includes("VIP") ||
                                preset.label.includes("Premium") ||
                                preset.label.includes("Executive")
                              ? "VIP / Premium"
                              : preset.label.includes("Ngân sách") ||
                                  preset.label.includes("tiếng Trung") ||
                                  preset.label.includes("so sánh")
                                ? "Giải quyết tâm lý"
                                : "Lead tổng quát";

                      const brandStyle =
                        preset.label.includes("VIP") ||
                        preset.label.includes("Premium") ||
                        preset.label.includes("Executive")
                          ? "Brand Premium"
                          : preset.label.includes("Facebook") ||
                              preset.label.includes("Google")
                            ? "Brand Social"
                            : preset.label.includes("mobile") ||
                                preset.label.includes("desktop")
                              ? "Brand Mobile"
                              : "Brand Sales";

                      return (
                        <div
                          key={preset.label}
                          className="group flex h-full min-h-[132px] flex-col rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/30"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                              preset
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                {brandStyle}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {preset.label}
                          </p>
                          <p className="mt-2 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                            {preset.description}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                              {group.title}
                            </span>
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                              {leadTarget}
                            </span>
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                              {brandStyle}
                            </span>
                          </div>

                          <div className="mt-auto pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                                Kịch bản 4 phần
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleCopyPreset(preset);
                                }}
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-white/30"
                              >
                                {copiedPreset === preset.label
                                  ? "Copied"
                                  : "Copy"}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                update((draft) => {
                                  draft.salesAdvice.saleAdviceTemplate =
                                    preset.saleAdvice;
                                  draft.salesAdvice.behaviorSummaryTemplate =
                                    preset.behaviorSummary;
                                  draft.salesAdvice.deviceTechInfoTemplate =
                                    preset.deviceTechInfo;
                                  draft.salesAdvice.trafficAdsSourceTemplate =
                                    preset.trafficAdsSource;
                                })
                              }
                              className="mt-2 w-full rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-neutral-700 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                            >
                              Apply template
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(() => {
          const preview = buildVisitorBehaviorPayload(
            { city: "Nghệ An", major: "Điện tử công nghiệp" },
            config.aiAdvisor,
            "facebook",
            config.salesAdvice,
          );
          return (
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  Preview webhook trước khi gửi
                </p>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                  Live
                </span>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <PreviewTemplateCard title="sale_advice" tone="emerald">
                  <pre className="whitespace-pre-wrap font-medium">
                    {preview.visitorBehaviorPayload.saleAdvice}
                  </pre>
                </PreviewTemplateCard>

                <PreviewTemplateCard title="behavior_summary" tone="sky">
                  <pre className="whitespace-pre-wrap font-medium">
                    {preview.visitorBehaviorPayload.behaviorSummary}
                  </pre>
                </PreviewTemplateCard>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <PreviewTemplateCard title="device_tech_info" tone="slate">
                  <pre className="whitespace-pre-wrap font-medium">
                    {preview.visitorBehaviorPayload.deviceTechInfo}
                  </pre>
                </PreviewTemplateCard>

                <PreviewTemplateCard title="traffic_ads_source" tone="slate">
                  <pre className="whitespace-pre-wrap font-medium">
                    {preview.visitorBehaviorPayload.trafficAdsSource}
                  </pre>
                </PreviewTemplateCard>
              </div>
            </div>
          );
        })()}

        {salesAdvice.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="rounded-xl border border-neutral-200 p-3 dark:border-white/10"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {scenario.title}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  {scenario.id}
                </p>
              </div>
              <Toggle
                checked={scenario.enabled}
                onChange={(v) =>
                  update((d) => {
                    const target = d.salesAdvice.scenarios.find(
                      (item) => item.id === scenario.id,
                    );
                    if (target) target.enabled = v;
                  })
                }
                label=""
              />
            </div>

            <Field label="Trigger / điều kiện">
              <TextInput
                value={scenario.trigger}
                onChange={(e) =>
                  update((d) => {
                    const target = d.salesAdvice.scenarios.find(
                      (item) => item.id === scenario.id,
                    );
                    if (target) target.trigger = e.target.value;
                  })
                }
              />
            </Field>

            <Field label="Khi nào dùng">
              <TextInput
                value={scenario.whenToUse}
                onChange={(e) =>
                  update((d) => {
                    const target = d.salesAdvice.scenarios.find(
                      (item) => item.id === scenario.id,
                    );
                    if (target) target.whenToUse = e.target.value;
                  })
                }
              />
            </Field>

            <Field label="Script">
              <TextArea
                value={scenario.script}
                onChange={(e) =>
                  update((d) => {
                    const target = d.salesAdvice.scenarios.find(
                      (item) => item.id === scenario.id,
                    );
                    if (target) target.script = e.target.value;
                  })
                }
              />
            </Field>

            <Field label="Tips nội dung / cài đặt">
              <TextArea
                value={scenario.tips}
                onChange={(e) =>
                  update((d) => {
                    const target = d.salesAdvice.scenarios.find(
                      (item) => item.id === scenario.id,
                    );
                    if (target) target.tips = e.target.value;
                  })
                }
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
          Preview kịch bản
        </p>
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-neutral-900">
          {salesAdvice.scenarios
            .filter((s) => s.enabled)
            .slice(0, 2)
            .map((scenario) => (
              <div
                key={scenario.id}
                className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60"
              >
                <p className="mb-1 font-bold text-slate-900 dark:text-slate-100">
                  {scenario.title}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Trigger: {scenario.trigger}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
                  {scenario.script}
                </p>
              </div>
            ))}
        </div>
      </div>

      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------ EMAIL ------------------------------------- */
function EmailModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const e = config.emailAutomation;
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [testTo, setTestTo] = useState("");
  const validFrom = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.fromEmail);
  const canUseServerFrom = e.provider === "resend" && !e.fromEmail.trim();
  const fromDomain = e.fromEmail.split("@").pop()?.toLowerCase() || "";
  const blockedFromDomain = [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
  ].includes(fromDomain);

  const sampleLead = {
    name: "Nguyễn Thảo",
    phone: "0901 234 567",
    city: "Hà Nội",
    major: "Điện tử công nghiệp",
    source: "Google Ads",
    ai_score: "92",
    timestamp: "18/09/2026 14:30",
  };
  const brandPalette = {
    primary: "#0b1f3a",
    accent: "#d4af37",
    soft: "#f7f3e8",
    panel: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    line: "#e2e8f0",
  };
  const fillTemplate = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  const saleNotificationTemplates = [
    {
      id: "vip-alert",
      label: "VIP Alert",
      accent: "#0f172a",
      subject: "[Lead ưu tiên] {name} • {city} • {major} • {phone}",
      body: "Lead chất lượng vừa đăng ký trên website.\n\nKhách hàng: {name}\nSĐT: {phone}\nKhu vực: {city}\nNgành quan tâm: {major}\nNguồn: {source}\nAI score: {ai_score}\nThời điểm: {timestamp}\n\nVui lòng gọi lại trong 10 phút để chốt lịch tư vấn, ưu tiên xử lý theo mức độ phù hợp và không bỏ lỡ cơ hội tốt nhất.",
    },
    {
      id: "executive-brief",
      label: "Executive Brief",
      accent: "#1d4ed8",
      subject: "Lead mới – {name} | {major} | {source}",
      body: "Một lead tiềm năng mới vừa đăng ký.\n\nTên: {name}\nĐiện thoại: {phone}\nKhu vực: {city}\nNgành: {major}\nNguồn: {source}\nMức độ phù hợp: {ai_score}/100\nThời gian: {timestamp}\n\nƯu tiên contact ngay để chốt lịch tư vấn 1:1 và gợi ý lộ trình phù hợp nhất.",
    },
    {
      id: "warm-hand-off",
      label: "Warm Handoff",
      accent: "#0f766e",
      subject: "🚀 {name} đang quan tâm {major}",
      body: "Chào team tư vấn,\n\n{name} vừa để lại thông tin và đang quan tâm lĩnh vực {major}.\n\nThông tin nhanh:\n- SĐT: {phone}\n- Tỉnh thành: {city}\n- Nguồn: {source}\n- AI score: {ai_score}\n- Thời gian: {timestamp}\n\nHãy nhắn tin chào mời và chốt lịch tư vấn trong ngày để tối ưu tỷ lệ chuyển đổi.",
    },
    {
      id: "sales-priority",
      label: "Sales Priority",
      accent: "#dc2626",
      subject: "⚡ Priority lead – {name} | {city} | {ai_score}/100",
      body: "Lead ưu tiên vừa đăng ký trên website.\n\nKhách hàng: {name}\nSĐT: {phone}\nTỉnh/Thành: {city}\nNgành: {major}\nNguồn: {source}\nĐiểm phù hợp: {ai_score}/100\n\nGọi ngay trong 10 phút, ưu tiên chốt lịch tư vấn và trao đổi lộ trình phù hợp.",
    },
    {
      id: "daily-sync",
      label: "Daily Sync",
      accent: "#c2410c",
      subject: "Daily sync • {name} • {major} • {city}",
      body: "Chào team,\n\n{name} vừa đăng ký trên website với nhu cầu {major} ở {city}.\n\nThông tin nhanh:\n• SĐT: {phone}\n• Nguồn: {source}\n• AI score: {ai_score}\n• Thời gian: {timestamp}\n\nHãy xử lý trong ca làm việc hiện tại để không mất lead chất lượng.",
    },
  ] as const;

  const customerTemplates = [
    {
      id: "luxury-welcome",
      label: "Luxury Welcome",
      accent: "#0b1f3a",
      subject: "Cảm ơn {name} – Chúng tôi đã nhận được yêu cầu tư vấn của bạn",
      body: "Kính chào {name},\n\nCảm ơn anh/chị đã dành thời gian để lại thông tin trên website.\n\nChúng tôi đã nhận được nhu cầu tư vấn về ngành {major} tại {city}. Đội ngũ tư vấn của chúng tôi sẽ liên hệ qua số {phone} trong thời gian sớm nhất để tư vấn lộ trình phù hợp với mục tiêu nghề nghiệp và ngân sách của anh/chị.\n\nNếu anh/chị muốn được hỗ trợ nhanh hơn, vui lòng phản hồi email này hoặc giữ điện thoại sẵn sàng để tư vấn viên liên hệ trực tiếp.\n\nTrân trọng,\nĐội ngũ tư vấn chuyên nghiệp",
    },
    {
      id: "premium-guide",
      label: "Premium Guide",
      accent: "#1d4ed8",
      subject: "Thông tin của bạn đã được ghi nhận – {name}",
      body: "Xin chào {name},\n\nCảm ơn anh/chị đã dành thời gian để lại thông tin.\n\nChúng tôi đã nhận được nhu cầu về ngành {major} và đang chuẩn bị kết nối anh/chị với tư vấn viên phù hợp nhất.\n\nMọi thông tin trong quá trình tư vấn sẽ được hỗ trợ trực tiếp bởi đội ngũ chuyên nghiệp với quy trình rõ ràng, nhanh chóng và thân thiện.\n\nAnh/chị chỉ cần giữ điện thoại và email sẵn sàng; chúng tôi sẽ liên hệ trong thời gian sớm nhất.\n\nTrân trọng,\nĐội ngũ hỗ trợ khách hàng",
    },
    {
      id: "trust-closer",
      label: "Trust Closer",
      accent: "#0f766e",
      subject: "Tư vấn viên sẽ liên hệ ngay với {name}",
      body: "Chào anh/chị {name},\n\nCảm ơn anh/chị đã quan tâm đến chương trình du học nghề Trung Quốc.\n\nChúng tôi đã ghi nhận thông tin: {city}, {major}, nguồn {source}. Team tư vấn của chúng tôi sẽ liên hệ đến số {phone} trong thời gian sớm nhất để tư vấn miễn phí, hỗ trợ lựa chọn lộ trình phù hợp và giải đáp các băn khoăn về học phí, điều kiện và thời gian nhập học.\n\nĐội ngũ tư vấn của chúng tôi luôn đồng hành cùng anh/chị từ khâu định hướng đến khi bắt đầu khóa học.\n\nTrân trọng,\nĐội ngũ tư vấn chuyên nghiệp",
    },
    {
      id: "action-fast",
      label: "Action Fast",
      accent: "#d97706",
      subject: "Bạn đã hoàn tất bước đầu tiên – {name}",
      body: "Xin chào {name},\n\nCảm ơn anh/chị đã để lại thông tin trên website.\n\nChúng tôi đã nhận được yêu cầu và đang chuẩn bị liên hệ sớm nhất để tư vấn chi tiết theo nhu cầu của anh/chị.\n\nBạn chỉ cần giữ điện thoại sẵn sàng; tư vấn viên sẽ gọi tới {phone} trong thời gian ngắn nhất.\n\nNếu cần hỗ trợ ngay, hãy trả lời email này hoặc gọi hotline của chúng tôi để được hỗ trợ tức thì.\n\nTrân trọng,\nĐội ngũ tư vấn chuyên nghiệp",
    },
    {
      id: "vip-roadmap",
      label: "VIP Roadmap",
      accent: "#7c3aed",
      subject: "Lộ trình phù hợp cho {name} đã được ghi nhận",
      body: "Kính chào {name},\n\nCảm ơn anh/chị đã để lại thông tin trên website để được tư vấn về ngành {major}.\n\nChúng tôi đã ghi nhận nhu cầu của anh/chị và sẽ sớm liên hệ để chia sẻ lộ trình học, điều kiện và cơ hội việc làm phù hợp nhất với mục tiêu nghề nghiệp của anh/chị.\n\nVới sự đồng hành của đội ngũ tư vấn chuyên nghiệp, anh/chị sẽ có cái nhìn rõ ràng hơn về hướng đi và quyết định phù hợp nhất cho tương lai.\n\nTrân trọng,\nĐội ngũ tư vấn",
    },
  ] as const;

  const customerTemplate =
    customerTemplates.find(
      (tpl) => tpl.subject === e.subject && tpl.body === e.body,
    ) || customerTemplates[0];
  const saleTemplate =
    saleNotificationTemplates.find(
      (tpl) => tpl.subject === e.notifySubject && tpl.body === e.notifyBody,
    ) || saleNotificationTemplates[0];

  const applyCustomerTemplate = (tpl: (typeof customerTemplates)[number]) => {
    update((d) => {
      d.emailAutomation.subject = tpl.subject;
      d.emailAutomation.body = tpl.body;
    });
  };
  const applySaleTemplate = (
    tpl: (typeof saleNotificationTemplates)[number],
  ) => {
    update((d) => {
      d.emailAutomation.notifySubject = tpl.subject;
      d.emailAutomation.notifyBody = tpl.body;
    });
  };

  const renderPreviewHtml = (
    subject: string,
    body: string,
    accent: string,
    type: "customer" | "sale",
  ) => {
    const filledSubject = fillTemplate(subject, {
      ...sampleLead,
      ai_score: sampleLead.ai_score,
      timestamp: sampleLead.timestamp,
    });
    const filledBody = fillTemplate(body, {
      ...sampleLead,
      ai_score: sampleLead.ai_score,
      timestamp: sampleLead.timestamp,
    });
    const leadBrand =
      e.brandName?.trim() || e.headerText?.trim() || "Funnel Builder";
    const leadLogo = e.brandLogoUrl?.trim();
    const leadBadge =
      type === "customer" ? "Lead khách hàng" : "Lead sales team";
    const previewCtaLabel =
      type === "customer"
        ? e.customerCtaLabel || e.ctaLabel || "Nhận tư vấn ngay"
        : e.salesCtaLabel || "Mở lead trong CRM";
    const previewCtaUrl =
      type === "customer"
        ? e.customerCtaUrl || e.ctaUrl || "#dang-ky"
        : e.salesCtaUrl || e.ctaUrl || "#dang-ky";
    const badgeStyle =
      type === "customer"
        ? "background:rgba(255,255,255,0.16);color:#fff;"
        : "background:rgba(15,23,42,0.08);color:#0f172a;";
    return `
      <div style="max-width:620px;margin:0 auto;border:1px solid ${brandPalette.line};border-radius:20px;overflow:hidden;background:#ffffff;font-family:Arial,sans-serif;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
        <div style="padding:18px 22px;background:linear-gradient(135deg, ${accent}, ${accent}dd);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${leadLogo ? `<img src="${leadLogo}" alt="${leadBrand}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,0.4);background:#fff;" />` : ""}
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">${leadBrand}</div>
          </div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;padding:6px 10px;border-radius:999px;${badgeStyle}">${leadBadge}</div>
        </div>
        <div style="padding:16px 20px;background:${brandPalette.soft};border-bottom:1px solid ${brandPalette.line};">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span style="font-size:11px;color:#0f172a;background:#fff;padding:6px 8px;border-radius:999px;border:1px solid ${brandPalette.line};">${sampleLead.name}</span>
            <span style="font-size:11px;color:#0f172a;background:#fff;padding:6px 8px;border-radius:999px;border:1px solid ${brandPalette.line};">${sampleLead.phone}</span>
            <span style="font-size:11px;color:#0f172a;background:#fff;padding:6px 8px;border-radius:999px;border:1px solid ${brandPalette.line};">${sampleLead.city}</span>
            <span style="font-size:11px;color:#0f172a;background:#fff;padding:6px 8px;border-radius:999px;border:1px solid ${brandPalette.line};">${sampleLead.major}</span>
          </div>
        </div>
        <div style="padding:24px 22px;background:#ffffff;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;">Email mẫu</div>
          <div style="font-size:24px;line-height:1.35;color:#0f172a;font-weight:700;margin-bottom:16px;">${filledSubject}</div>
          <div style="font-size:14px;line-height:1.8;color:#334155;white-space:pre-wrap;">${filledBody.replace(/\n/g, "<br />")}</div>
          <div style="margin-top:18px;border-top:1px solid ${brandPalette.line};padding-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:${brandPalette.muted};font-size:12px;">
            <span>Hoàn tất trong 10 phút</span>
            <a href="${previewCtaUrl}" style="display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:${brandPalette.soft};border:1px solid ${brandPalette.line};font-weight:700;color:${accent};text-decoration:none;">${previewCtaLabel}</a>
          </div>
        </div>
      </div>
    `;
  };

  const customerPreviewHtml = renderPreviewHtml(
    e.subject || customerTemplate.subject,
    e.body || customerTemplate.body,
    customerTemplate.accent,
    "customer",
  );
  const salePreviewHtml = renderPreviewHtml(
    e.notifySubject || saleNotificationTemplates[0].subject,
    e.notifyBody || saleNotificationTemplates[0].body,
    saleTemplate.accent,
    "sale",
  );

  return (
    <AdminModal
      title="Tự Động Hóa Email"
      subtitle="Gửi email cảm ơn ngay khi có lead"
      onClose={onClose}
    >
      <Toggle
        checked={e.enabled}
        onChange={(v) => update((d) => (d.emailAutomation.enabled = v))}
        label="Bật auto email"
      />
      <Field label="Nhà cung cấp">
        <div className="flex gap-2">
          {(["resend", "gmail"] as const).map((p) => (
            <button
              key={p}
              onClick={() => update((d) => (d.emailAutomation.provider = p))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold uppercase ${
                e.provider === p
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {p === "gmail" ? "Gmail OAuth2" : "Resend"}
            </button>
          ))}
        </div>
      </Field>
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
          Branding email
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên thương hiệu / header">
            <TextInput
              value={e.brandName || e.headerText || "Funnel Builder"}
              onChange={(ev) =>
                update((d) => {
                  d.emailAutomation.brandName = ev.target.value;
                  d.emailAutomation.headerText = ev.target.value;
                })
              }
            />
          </Field>
          <Field label="Logo URL (tùy chọn)">
            <TextInput
              value={e.brandLogoUrl}
              onChange={(ev) =>
                update(
                  (d) => (d.emailAutomation.brandLogoUrl = ev.target.value),
                )
              }
              placeholder="https://.../logo.png"
            />
          </Field>
          <Field label="CTA mặc định trong email">
            <TextInput
              value={e.ctaLabel}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.ctaLabel = ev.target.value))
              }
              placeholder="Nhận tư vấn ngay"
            />
          </Field>
          <Field label="Link CTA mặc định">
            <TextInput
              value={e.ctaUrl}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.ctaUrl = ev.target.value))
              }
              placeholder="https://example.com/booking"
            />
          </Field>
          <Field label="CTA khách hàng">
            <TextInput
              value={e.customerCtaLabel || e.ctaLabel}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.customerCtaLabel = ev.target.value))
              }
              placeholder="Nhận tư vấn ngay"
            />
          </Field>
          <Field
            label="Deeplink CTA khách"
            hint="Hỗ trợ {name} {phone} {city} {major} {source} {landing_url}"
          >
            <TextInput
              value={e.customerCtaUrl || e.ctaUrl}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.customerCtaUrl = ev.target.value))
              }
              placeholder="{landing_url}#dang-ky"
            />
          </Field>
          <Field label="CTA sale">
            <TextInput
              value={e.salesCtaLabel || "Mở lead trong CRM"}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.salesCtaLabel = ev.target.value))
              }
              placeholder="Mở lead trong CRM"
            />
          </Field>
          <Field
            label="Deeplink CTA sale"
            hint="Hỗ trợ {name} {phone} {city} {major} {source} {landing_url}"
          >
            <TextInput
              value={e.salesCtaUrl || "{landing_url}#dang-ky"}
              onChange={(ev) =>
                update((d) => (d.emailAutomation.salesCtaUrl = ev.target.value))
              }
              placeholder="https://crm.example.com/leads/{phone}"
            />
          </Field>
        </div>
      </div>
      <Field label="Email gửi đi (From)">
        <TextInput
          value={e.fromEmail}
          onChange={(ev) =>
            update((d) => (d.emailAutomation.fromEmail = ev.target.value))
          }
        />
      </Field>
      <p
        className={`mb-3 text-xs ${validFrom ? "text-emerald-600" : "text-amber-600"}`}
      >
        {blockedFromDomain
          ? "Resend không cho dùng Gmail/Yahoo/Outlook làm From. Dùng onboarding@resend.dev hoặc domain đã xác minh."
          : validFrom
            ? "Địa chỉ From hợp lệ."
            : canUseServerFrom
              ? "Sẽ dùng RESEND_FROM_EMAIL hoặc BACKUP_FROM_EMAIL trên server."
              : "Cần nhập email From hợp lệ."}
      </p>
      {e.provider === "resend" ? (
        <Field
          label="Resend API Key"
          hint="Tạo tại resend.com/api-keys. Dán vào đây hoặc đặt RESEND_API_KEY trên server."
        >
          <TextInput
            type="password"
            autoComplete="new-password"
            value={e.resendApiKey}
            onChange={(ev) =>
              update((d) => (d.emailAutomation.resendApiKey = ev.target.value))
            }
            placeholder="re_..."
          />
        </Field>
      ) : (
        <>
          <Field label="Gmail Client ID">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={e.gmailClientId}
              onChange={(ev) =>
                update(
                  (d) => (d.emailAutomation.gmailClientId = ev.target.value),
                )
              }
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </Field>
          <Field label="Gmail Client Secret">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={e.gmailClientSecret}
              onChange={(ev) =>
                update(
                  (d) =>
                    (d.emailAutomation.gmailClientSecret = ev.target.value),
                )
              }
              placeholder="GOCSPX-..."
            />
          </Field>
          <Field label="Gmail Refresh Token">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={e.gmailRefreshToken}
              onChange={(ev) =>
                update(
                  (d) =>
                    (d.emailAutomation.gmailRefreshToken = ev.target.value),
                )
              }
              placeholder="1//0e..."
            />
          </Field>
        </>
      )}
      <Field
        label="Email nhận test"
        hint="Chỉ dùng để gửi email kiểm tra, không lưu secret."
      >
        <TextInput
          type="email"
          value={testTo}
          onChange={(event) => setTestTo(event.target.value)}
          placeholder="ban@example.com"
        />
      </Field>
      <Field
        label="Email nhận thông báo lead mới"
        hint="Email mặc định / fallback. Dùng {name} {phone} {city} {major} {source} {ai_score} {timestamp}"
      >
        <TextInput
          type="email"
          value={e.notifyEmail}
          onChange={(ev) =>
            update((d) => (d.emailAutomation.notifyEmail = ev.target.value))
          }
          placeholder="tu-van@congty.com"
        />
      </Field>
      <Field
        label="Danh sách sale nhận lead"
        hint="Ngăn cách bằng dấu phẩy, xuống dòng hoặc ;. Ví dụ: sale1@company.com, sale2@company.com"
      >
        <TextArea
          value={e.salesEmailList.join("\n")}
          onChange={(ev) =>
            update((d) => {
              d.emailAutomation.salesEmailList = ev.target.value
                .split(/[;\n,]/)
                .map((item) => item.trim())
                .filter(Boolean);
            })
          }
        />
      </Field>
      <Field label="Chế độ phân phối lead cho sale">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["random", "Random"],
              ["daily_round_robin", "Daily round robin"],
              ["weighted_percent", "Theo % trọng số"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                update((d) => (d.emailAutomation.salesDistributionMode = mode))
              }
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                e.salesDistributionMode === mode
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field
        label="Tỉ lệ phân phối theo sale (đối với mode % trọng số)"
        hint="Ví dụ: sale1@company.com=60; sale2@company.com=40"
      >
        <TextArea
          value={
            Object.entries(e.salesDistributionWeights || {})
              .map(([email, value]) => `${email}=${value}`)
              .join("\n") || ""
          }
          onChange={(ev) => {
            const next: Record<string, number> = {};
            for (const line of ev.target.value.split(/\n|;/)) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const [email, rawValue] = trimmed.split("=");
              const cleanedEmail = (email || "").trim();
              const parsed = Number(rawValue || 0);
              if (!cleanedEmail || Number.isNaN(parsed) || parsed <= 0)
                continue;
              next[cleanedEmail] = parsed;
            }
            update((d) => (d.emailAutomation.salesDistributionWeights = next));
          }}
        />
      </Field>
      <Field label="Gửi webhook khi gán sale nhận lead">
        <Toggle
          checked={Boolean(e.salesSendWebhook)}
          onChange={(v) =>
            update((d) => (d.emailAutomation.salesSendWebhook = v))
          }
          label="Bật webhook gán sale"
        />
      </Field>
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Mẫu email khách hàng
          </p>
          <span className="text-[10px] text-neutral-500">
            {customerTemplate.label}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {customerTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyCustomerTemplate(tpl)}
              className={`rounded-xl border p-2 text-left transition ${
                customerTemplate.id === tpl.id
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100"
              }`}
            >
              <div
                className="mb-2 h-2.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${tpl.accent}, ${tpl.accent}cc)`,
                }}
              />
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]">
                {tpl.label}
              </div>
              <div className="mt-1 text-[10px] opacity-80">
                Brand style · Premium
              </div>
            </button>
          ))}
        </div>
      </div>
      <Field
        label="Tiêu đề email khách"
        hint="Dùng {name} {phone} {city} {major} {source} {ai_score} {timestamp}"
      >
        <TextInput
          value={e.subject}
          onChange={(ev) =>
            update((d) => (d.emailAutomation.subject = ev.target.value))
          }
        />
      </Field>
      <Field label="Nội dung email khách">
        <TextArea
          value={e.body}
          onChange={(ev) =>
            update((d) => (d.emailAutomation.body = ev.target.value))
          }
        />
      </Field>
      <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
        <strong>Resend:</strong> tạo API key tại resend.com/api-keys, xác thực
        domain rồi đặt <code>RESEND_API_KEY</code> trên server.
        <br />
        <strong>Gmail:</strong> tạo OAuth Client trong Google Cloud, bật Gmail
        API và lấy refresh token; đặt <code>GMAIL_CLIENT_ID</code>,{" "}
        <code>GMAIL_CLIENT_SECRET</code>, <code>GMAIL_REFRESH_TOKEN</code> trên
        server. Runtime Cloudflare dùng Gmail API OAuth2, không dùng SMTP TCP
        trực tiếp.
      </div>
      <div className="mb-3 rounded-lg border border-sky-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-sky-800">
            Email thông báo cho đội ngũ tư vấn
          </p>
          <span className="text-[10px] text-sky-700">{saleTemplate.label}</span>
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {saleNotificationTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applySaleTemplate(tpl)}
              className={`rounded-xl border p-2 text-left transition ${
                saleTemplate.id === tpl.id
                  ? "border-sky-800 bg-sky-800 text-white shadow-sm"
                  : "border-sky-200 bg-white text-sky-900 hover:border-sky-400"
              }`}
            >
              <div
                className="mb-2 h-2.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${tpl.accent}, ${tpl.accent}cc)`,
                }}
              />
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]">
                {tpl.label}
              </div>
              <div className="mt-1 text-[10px] opacity-80">Sales alert</div>
            </button>
          ))}
        </div>
        <Field
          label="Tiêu đề thông báo"
          hint="Dùng {name} {phone} {city} {major} {source} {ai_score} {timestamp}"
        >
          <TextInput
            value={e.notifySubject}
            onChange={(ev) =>
              update((d) => (d.emailAutomation.notifySubject = ev.target.value))
            }
          />
        </Field>
        <Field label="Nội dung thông báo">
          <TextArea
            value={e.notifyBody}
            onChange={(ev) =>
              update((d) => (d.emailAutomation.notifyBody = ev.target.value))
            }
          />
        </Field>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Preview email khách
          </p>
          <div dangerouslySetInnerHTML={{ __html: customerPreviewHtml }} />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Preview email sale
          </p>
          <div dangerouslySetInnerHTML={{ __html: salePreviewHtml }} />
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800 dark:text-amber-300">
          Checklist phát hành doanh nghiệp
        </p>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
          <li>
            • Dùng domain đã xác minh trên Resend, không dùng
            Gmail/Yahoo/Outlook làm From.
          </li>
          <li>
            • Thiết lập biến môi trường: RESEND_API_KEY, RESEND_FROM_EMAIL,
            VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
            VITE_SUPABASE_ADMIN_EMAIL.
          </li>
          <li>
            • Kiểm tra Supabase Auth admin và quyền admin_users trước khi bật
            công khai.
          </li>
          <li>
            • Test email thật với một địa chỉ nhận ngoài trước khi mở rộng lưu
            lượng.
          </li>
          <li>
            • Chạy webhook và check CRM sync trong production trước khi quảng
            cáo mạnh.
          </li>
        </ul>
      </div>

      <button
        type="button"
        disabled={
          ((!validFrom || blockedFromDomain) && !canUseServerFrom) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo) ||
          testState === "testing"
        }
        onClick={() => {
          setTestState("testing");
          void checkEmailConfig()
            .then((result) => {
              const configured =
                e.provider === "gmail"
                  ? result.gmailConfigured
                  : result.resendConfigured || Boolean(e.resendApiKey.trim());
              if (!configured)
                throw new Error(
                  e.provider === "gmail"
                    ? "Thiếu GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET hoặc GMAIL_REFRESH_TOKEN."
                    : "Thiếu RESEND_API_KEY. Hãy đặt key trên server hoặc nhập key trong ô Resend API Key.",
                );
              return sendTestEmail({
                data: {
                  provider: e.provider,
                  to: testTo,
                  from: e.fromEmail,
                  subject: "Email test từ Funnel Builder",
                  text: "Đây là email kiểm tra cấu hình tự động hóa email.",
                  resendApiKey: e.resendApiKey,
                  gmailClientId: e.gmailClientId,
                  gmailClientSecret: e.gmailClientSecret,
                  gmailRefreshToken: e.gmailRefreshToken,
                },
              });
            })
            .then((result) => {
              setTestState(result.sent ? "ok" : "error");
              setTestMessage(
                result.sent
                  ? "Đã gửi email test thành công."
                  : `Gửi email test thất bại: ${result.reason}${"status" in result && result.status ? ` (${result.status})` : ""}${"detail" in result && result.detail ? ` — ${result.detail}` : ""}`,
              );
            })
            .catch((error: unknown) => {
              setTestState("error");
              setTestMessage(
                error instanceof Error
                  ? error.message
                  : "Không gọi được email server.",
              );
            });
        }}
        className="w-full rounded-lg border border-neutral-300 py-2.5 text-xs font-bold disabled:opacity-40"
      >
        {testState === "testing"
          ? "Đang kiểm tra..."
          : "Kiểm tra cấu hình email"}
      </button>
      {testState !== "idle" && testState !== "testing" && (
        <p
          className={`mt-2 text-xs font-semibold ${testState === "ok" ? "text-emerald-600" : "text-red-600"}`}
        >
          {testMessage}
        </p>
      )}
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------ WEBHOOK HUB ------------------------------- */
function WebhookModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const list = config.webhooks;
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, WebhookResult>>({});
  const enabledCount = list.filter(
    (endpoint) => endpoint.enabled && endpoint.url.trim(),
  ).length;
  const storageStatus = getStorageStatus(config);

  return (
    <AdminModal
      title="Cổng Webhook & Đa Kênh"
      subtitle="Gửi lead tới nhiều nơi cùng lúc"
      onClose={onClose}
    >
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${storageStatus.className}`}
          >
            {storageStatus.label}
          </span>
          <span className="text-[10px] text-neutral-500">
            {storageStatus.detail}
          </span>
        </div>
      </div>
      <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
        Tiêu đề form, nhãn nút CTA, webhook chính và giới hạn gửi nằm ở mục
        <strong> Form &amp; Webhook</strong> trong toolbar. UTM được đọc tự động
        từ URL quảng cáo và gửi trong các trường
        <strong> traffic_ads_source</strong>, <strong>utm_source</strong>,
        <strong> utm_campaign</strong> của lead.
      </p>
      <div className="mb-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
        <p className="font-bold text-neutral-800">Cách vận hành</p>
        <p className="mt-1">
          Mỗi lead được gửi song song tới {enabledCount} endpoint đang bật. Một
          endpoint lỗi không làm mất lead trong Mini-CRM.
        </p>
        <p className="mt-1">
          Hãy bấm test sau khi nhập URL. Trình duyệt có thể chặn endpoint không
          bật CORS; khi đó nên dùng Make/Zapier làm cổng trung gian.
        </p>
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="mb-1 text-xs font-bold text-neutral-800">
          AI Sales Advisor & kịch bản gọi
        </p>
        <p className="mb-3 text-[11px] text-neutral-500">
          AI dùng hành vi tracking đã thu thập để chấm điểm, phân loại và gợi ý
          cách gọi. Kết quả được gửi cùng payload webhook và lưu trong Mini-CRM.
          Cấu hình chi tiết (regex VIP, tỉnh trọng điểm, ngưỡng) nằm ở mục
          <strong> AI Sales Advisor</strong> trong toolbar.
        </p>
        <Toggle
          checked={config.aiAdvisor.enabled}
          onChange={(value) =>
            update((draft) => (draft.aiAdvisor.enabled = value))
          }
          label="Bật AI Sales Advisor"
        />
      </div>
      {list.length === 0 && (
        <p className="mb-3 text-xs text-neutral-400">
          Chưa có endpoint nào. Thêm mới bên dưới.
        </p>
      )}
      {list.map((w, i) => (
        <div
          key={w.id}
          className="mb-2 rounded-lg border border-neutral-200 p-2"
        >
          <div className="mb-2 flex items-center gap-2">
            <TextInput
              value={w.label}
              placeholder="Tên"
              onChange={(e) =>
                update((d) => (d.webhooks[i]!.label = e.target.value))
              }
            />
            <select
              value={w.type}
              onChange={(e) =>
                update(
                  (d) =>
                    (d.webhooks[i]!.type = e.target.value as typeof w.type),
                )
              }
              className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
            >
              <option value="make">Make/Zapier</option>
              <option value="telegram">Telegram</option>
              <option value="sheets">Google Sheets</option>
              <option value="supabase">Supabase</option>
              <option value="custom">Custom</option>
            </select>
            <button
              onClick={() => update((d) => d.webhooks.splice(i, 1))}
              className="rounded-md p-2 text-red-500 hover:bg-red-50"
              aria-label="Xóa"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <TextInput
            value={w.url}
            placeholder="https://..."
            onChange={(e) =>
              update((d) => (d.webhooks[i]!.url = e.target.value))
            }
          />
          {webhookConfigurationWarning(w, config) && (
            <p className="mt-1 text-[11px] font-semibold text-amber-600">
              Cảnh báo: {webhookConfigurationWarning(w, config)}
            </p>
          )}
          <div className="mt-2">
            <Toggle
              checked={w.enabled}
              onChange={(v) => update((d) => (d.webhooks[i]!.enabled = v))}
              label="Kích hoạt"
            />
          </div>
          <button
            type="button"
            disabled={!w.url.trim() || testingId === w.id}
            onClick={() => {
              setTestingId(w.id);
              void testWebhookEndpoint(w, config)
                .then((result) =>
                  setResults((current) => ({ ...current, [w.id]: result })),
                )
                .finally(() => setTestingId(null));
            }}
            className="mt-2 w-full rounded-lg border border-neutral-300 py-2 text-xs font-bold disabled:opacity-40"
          >
            {testingId === w.id ? "Đang gửi test..." : "Gửi test endpoint"}
          </button>
          {results[w.id] && (
            <p
              className={`mt-1 text-[11px] font-semibold ${results[w.id]!.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {results[w.id]!.ok
                ? `OK sau ${results[w.id]!.attempts} lần thử`
                : `Lỗi: ${results[w.id]!.detail}`}
            </p>
          )}
          <p className="mt-1 text-[10px] text-neutral-400">
            {w.type === "telegram" && "Telegram: dùng URL Bot API kèm chat_id."}
            {w.type === "supabase" &&
              "Supabase: dùng tên bảng trong URL, ví dụ leads."}
            {(w.type === "make" ||
              w.type === "sheets" ||
              w.type === "custom") &&
              "Endpoint phải nhận POST JSON và cho phép CORS từ landing page."}
          </p>
        </div>
      ))}
      <button
        onClick={() =>
          update((d) =>
            d.webhooks.push({
              id: `wh_${Date.now()}`,
              label: "Endpoint mới",
              url: "",
              enabled: true,
              type: "make",
            }),
          )
        }
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-semibold text-neutral-600"
      >
        <Plus className="h-4 w-4" /> Thêm Webhook
      </button>
      <SaveHint />
    </AdminModal>
  );
}

/* ------------------------------ ANALYTICS --------------------------------- */
function AnalyticsModal({ onClose }: ModalProps) {
  const { logout } = useAdmin();
  const { config, ready: configReady } = useSiteConfig();
  const [a, setA] = useState<AnalyticsState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  useEffect(() => {
    if (!configReady) return;
    if (config.admin.storageMode === "database") {
      setLoadingCloud(true);
      void loadCloudAnalytics(config).then((result) => {
        if (result.data) {
          setA(result.data);
          setLoadError(null);
        } else {
          setLoadError(result.error || "unknown_error");
        }
        setLoadingCloud(false);
      });
    }
    const refresh = () => {
      if (config.admin.storageMode !== "database") {
        setA(loadAnalytics());
      }
    };
    if (config.admin.storageMode !== "database") setA(loadAnalytics());
    window.addEventListener(ANALYTICS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ANALYTICS_UPDATED_EVENT, refresh);
  }, [config, configReady]);
  const cr =
    a && a.visits > 0 ? ((a.leads / a.visits) * 100).toFixed(1) : "0.0";
  return (
    <AdminModal
      title="Thống Kê & Analytics"
      subtitle={
        config.admin.storageMode === "database"
          ? "Số liệu Analytics từ Supabase"
          : "Số liệu thời gian thực (local)"
      }
      onClose={onClose}
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (
              window.confirm(
                config.admin.storageMode === "database"
                  ? "Xóa lượt truy cập và lượt đăng ký test trên Supabase?"
                  : "Xóa toàn bộ số liệu Analytics trên thiết bị này?",
              )
            ) {
              const cleared = await clearAnalytics(config);
              if (cleared)
                setA({
                  visits: 0,
                  leads: 0,
                  bySource: {},
                  bySourceStats: {},
                  byVariant: {},
                });
              setActionMessage(
                cleared
                  ? "Đã xóa và reset Analytics Supabase về 0."
                  : "Không thể reset analytics. Kiểm tra quyền Supabase.",
              );
            }
          }}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600"
        >
          Xóa dữ liệu Analytics cloud
        </button>
        {actionMessage && (
          <p className="mb-2 text-center text-[11px] font-semibold text-sky-700">
            {actionMessage}
          </p>
        )}
      </div>
      {loadError && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Chưa đọc được Analytics cloud ({loadError}).
          {loadError === "admin_session_missing" ? (
            <>
              Hãy đăng nhập lại Admin để làm mới phiên Supabase.
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.assign("/admin");
                }}
                className="ml-1 font-bold underline"
              >
                Đăng nhập lại
              </button>
            </>
          ) : (
            <>
              Kiểm tra migration
              <code className="mx-1 font-bold">
                supabase/visitor_tracking.sql
              </code>
              và tải lại.
            </>
          )}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Lượt truy cập"
          value={a ? a.visits : loadingCloud ? "..." : "--"}
        />
        <Stat
          label="Lượt đăng ký"
          value={a ? a.leads : loadingCloud ? "..." : "--"}
          tone="text-emerald-600"
        />
        <Stat
          label="Tỷ lệ CR"
          value={a ? `${cr}%` : "--"}
          tone="text-red-600"
        />
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold text-neutral-700">
        Nguồn traffic (UTM)
      </p>
      <div className="space-y-1">
        {a && Object.keys(a.bySourceStats).length > 0 ? (
          Object.entries(a.bySourceStats).map(([s, stats]) => (
            <div
              key={s}
              className="flex justify-between rounded-lg bg-neutral-100 px-3 py-1.5 text-xs dark:bg-white/5"
            >
              <span className="font-medium">{s}</span>
              <span className="tabular-nums">
                {stats.visits} visits · {stats.leads} leads ·{" "}
                {stats.visits
                  ? ((stats.leads / stats.visits) * 100).toFixed(1)
                  : "0.0"}
                % CR
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-neutral-400">Chưa có dữ liệu.</p>
        )}
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold text-neutral-700">
        So sánh A/B
      </p>
      {a && Object.keys(a.byVariant).length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(a.byVariant).map(([v, s]) => (
            <div
              key={v}
              className="rounded-lg border border-neutral-200 p-2 text-xs dark:border-white/10"
            >
              <div className="font-bold">{v}</div>
              <div>Visits: {s.visits}</div>
              <div>Leads: {s.leads}</div>
              <div>
                CR: {s.visits ? ((s.leads / s.visits) * 100).toFixed(1) : "0"}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">
          A/B chưa có dữ liệu. Hãy bật A/B Testing, lưu cấu hình, mở landing ở
          tab mới rồi tải lại Analytics.
        </p>
      )}
    </AdminModal>
  );
}

/* ------------------------------- LEADS ------------------------------------ */
function LeadsModal({ onClose }: ModalProps) {
  const { config } = useSiteConfig();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [q, setQ] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<LeadSyncSummary | null>(null);
  const [syncingLeads, setSyncingLeads] = useState(false);

  useEffect(() => {
    const refresh = () => {
      if (config.admin.storageMode === "database") {
        void loadCloudLeads(config).then(setLeads);
      } else {
        setLeads(loadLeads());
      }
    };
    refresh();
    window.addEventListener(LEAD_CREATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEAD_CREATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [config]);

  const cloud =
    config.admin.storageMode === "database" && !!config.admin.supabaseUrl;
  const key = q.trim().toLowerCase();
  const filtered = key
    ? leads.filter((l) =>
        [l.name, l.phone, l.city, l.major, l.utmSource].some((v) =>
          (v || "").toLowerCase().includes(key),
        ),
      )
    : leads;

  const addTestLead = async () => {
    const n = leads.length + 1;
    const saved = await saveLead(
      {
        id: `ld_test_${Date.now()}`,
        at: new Date().toISOString(),
        name: `Lead thử nghiệm ${n}`,
        phone: `09${String(Date.now()).slice(-8)}`,
        city: "Hà Nội",
        major: "Công nghệ ô tô điện",
        aiScore: 72,
        aiRank: "WARM",
        utmSource: "test",
      },
      config,
    );
    setActionMessage(
      saved.storage === "database"
        ? "Lead thử đã lưu local và đồng bộ lên cloud."
        : "Lead thử đã lưu local trên trình duyệt.",
    );
    if (config.admin.storageMode === "database") {
      setLeads(await loadCloudLeads(config));
    } else {
      setLeads(loadLeads());
    }
  };

  const syncLeadsNow = async () => {
    if (config.admin.storageMode !== "database") {
      setActionMessage("Chế độ Local: lead chỉ được lưu trên trình duyệt.");
      setSyncSummary({
        total: leads.length,
        synced: 0,
        failed: 0,
        skipped: 0,
        localSaved: leads.length,
        cloudSynced: 0,
        cloudFailed: 0,
        status: "local_only",
      });
      return;
    }

    setSyncingLeads(true);
    setActionMessage("Đang đồng bộ lead local lên Supabase...");
    const result = await syncLeadsToSupabase(config);
    setSyncSummary(result);
    setActionMessage(
      result.status === "cloud_synced"
        ? `Local saved: ${result.localSaved}. Cloud synced: ${result.cloudSynced}/${result.total}.`
        : result.status === "cloud_failed"
          ? `Local saved: ${result.localSaved}. Cloud failed: ${result.cloudFailed}/${result.total}.`
          : result.status === "mixed"
            ? `Local saved: ${result.localSaved}. Cloud synced: ${result.cloudSynced}/${result.total}. Cloud failed: ${result.cloudFailed}/${result.total}.`
            : "Lead chỉ ở chế độ local; chưa có Supabase để đồng bộ.",
    );
    setLeads(
      config.admin.storageMode === "database"
        ? await loadCloudLeads(config)
        : loadLeads(),
    );
    setSyncingLeads(false);
  };

  const syncStatusText =
    syncSummary?.status === "cloud_synced"
      ? "Cloud synced"
      : syncSummary?.status === "cloud_failed"
        ? "Cloud failed"
        : syncSummary?.status === "mixed"
          ? "Mixed"
          : "Local saved";

  return (
    <AdminModal
      title="Quản Lý Lead (Mini-CRM)"
      subtitle={`${leads.length} lead đã ghi nhận`}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            cloud
              ? "bg-sky-100 text-sky-700"
              : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {cloud ? "Supabase Cloud" : "LocalStorage"}
        </span>
        {cloud && (
          <button
            onClick={syncLeadsNow}
            disabled={syncingLeads}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncingLeads ? "Đang đồng bộ..." : "Sync leads now"}
          </button>
        )}
        <button
          onClick={() => exportLeadsCsv(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Xuất CSV/Excel
        </button>
        <button
          onClick={addTestLead}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700"
        >
          + Lead thử
        </button>
        <button
          onClick={async () => {
            if (
              window.confirm(
                config.admin.storageMode === "database"
                  ? "Xóa toàn bộ lead trên Supabase?"
                  : "Xoá toàn bộ lead đã lưu trên máy này?",
              )
            ) {
              const cleared = await clearLeads(config);
              setActionMessage(
                cleared
                  ? "Đã xóa dữ liệu lead trên Supabase."
                  : "Không thể xóa lead. Kiểm tra quyền Supabase.",
              );
              if (cleared) setLeads([]);
            }
          }}
          disabled={leads.length === 0}
          className="ml-auto rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40"
        >
          Xoá tất cả
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Trạng thái lưu
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              syncSummary?.status === "cloud_synced"
                ? "bg-emerald-100 text-emerald-700"
                : syncSummary?.status === "cloud_failed"
                  ? "bg-red-100 text-red-700"
                  : syncSummary?.status === "mixed"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {syncStatusText}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold">
          <div className="rounded-lg bg-white px-2 py-2 text-neutral-700 dark:bg-neutral-900">
            <div className="text-neutral-500">Local saved</div>
            <div className="mt-1 text-base font-black text-neutral-900 dark:text-white">
              {syncSummary?.localSaved ?? leads.length}
            </div>
          </div>
          <div className="rounded-lg bg-white px-2 py-2 text-neutral-700 dark:bg-neutral-900">
            <div className="text-neutral-500">Cloud synced</div>
            <div className="mt-1 text-base font-black text-emerald-600">
              {syncSummary?.cloudSynced ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-white px-2 py-2 text-neutral-700 dark:bg-neutral-900">
            <div className="text-neutral-500">Cloud failed</div>
            <div className="mt-1 text-base font-black text-red-600">
              {syncSummary?.cloudFailed ?? 0}
            </div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <p className="mb-2 text-center text-[11px] font-semibold text-sky-700">
          {actionMessage}
        </p>
      )}
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo tên, SĐT, tỉnh, ngành..."
      />

      {filtered.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-400">
          {leads.length === 0
            ? "Chưa có lead nào. Lead sẽ xuất hiện tại đây sau khi khách gửi form."
            : "Không tìm thấy lead phù hợp."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 dark:border-white/10">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-neutral-100 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-white/5">
              <tr>
                <th className="px-2 py-2 text-left">Khách</th>
                <th className="px-2 py-2 text-left">SĐT</th>
                <th className="px-2 py-2 text-left">Tỉnh</th>
                <th className="px-2 py-2 text-left">Ngành</th>
                <th className="px-2 py-2 text-left">Thời gian</th>
                <th className="px-2 py-2 text-left">Nguồn</th>
                <th className="px-2 py-2 text-left">Lưu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-neutral-200 align-top dark:border-white/10"
                >
                  <td className="max-w-[170px] px-2 py-2 font-semibold">
                    <div className="truncate" title={l.name}>
                      {l.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {l.aiRank && (
                        <span className="rounded bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                          {l.aiRank}
                        </span>
                      )}
                      {l.riskLevel && l.riskLevel !== "low" && (
                        <span
                          title={
                            l.riskReasons?.join("; ") ||
                            l.recommendedAction ||
                            "Cần kiểm tra thêm"
                          }
                          className={`rounded px-1.5 text-[9px] font-bold ${
                            l.riskLevel === "high"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {l.riskLevel === "high" ? "CẦN XÁC MINH" : "XEM LẠI"}
                        </span>
                      )}
                    </div>
                    {l.saleAdvice && (
                      <p className="mt-1 line-clamp-2 text-[10px] font-normal leading-snug text-neutral-500 dark:text-neutral-300">
                        {l.saleAdvice}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums text-neutral-700 dark:text-neutral-200">
                    {l.phone}
                  </td>
                  <td
                    className="max-w-[90px] truncate px-2 py-2 text-neutral-700 dark:text-neutral-200"
                    title={l.city || ""}
                  >
                    {l.city || "—"}
                  </td>
                  <td
                    className="max-w-[120px] truncate px-2 py-2 text-neutral-700 dark:text-neutral-200"
                    title={l.major || ""}
                  >
                    {l.major || "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-[10px] text-neutral-500">
                    {new Date(l.at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-2 py-2 text-[10px] text-neutral-500">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                      {l.utmSource || "direct"}
                    </div>
                    <div className="mt-1 leading-tight">
                      P{l.currentSession || 1} · H{l.visitsToday || 0} · T
                      {l.visitsMonth || 0}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        l.storage === "database"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {l.storage === "database" ? "Cloud" : "Local"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminModal>
  );
}

/* ------------------------------ STORAGE ----------------------------------- */
function StorageModal({ onClose }: ModalProps) {
  const { config, update, importConfig, reset } = useSiteConfig();
  const a = config.admin;
  const importRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState<SupabaseConnectionStatus | null>(null);
  const [migration, setMigration] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [savingConnection, setSavingConnection] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  return (
    <AdminModal
      title="Storage Mode"
      subtitle="Kết nối Supabase và xác thực quản trị"
      onClose={onClose}
    >
      <Field label="Chế độ lưu trữ">
        <div className="flex gap-2">
          {(["local", "database"] as const).map((m) => (
            <button
              key={m}
              onClick={() => update((d) => (d.admin.storageMode = m))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                a.storageMode === m
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {m === "local" ? "Local (localStorage)" : "Database (Supabase)"}
            </button>
          ))}
        </div>
      </Field>
      {a.storageMode === "database" && (
        <>
          <Field label="Supabase URL">
            <TextInput
              value={a.supabaseUrl}
              onChange={(e) =>
                update((d) => (d.admin.supabaseUrl = e.target.value))
              }
            />
          </Field>
          <Field label="Supabase Anon Key">
            <TextInput
              type="password"
              autoComplete="off"
              value={a.supabaseAnonKey}
              onChange={(e) =>
                update((d) => (d.admin.supabaseAnonKey = e.target.value))
              }
            />
          </Field>
          <Field
            label="Email tài khoản Supabase Auth"
            hint="Tài khoản này phải tồn tại trong Supabase → Authentication → Users."
          >
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              value={a.supabaseAdminEmail}
              onChange={(e) =>
                update((d) => (d.admin.supabaseAdminEmail = e.target.value))
              }
            />
          </Field>
          <Field
            label="Mật khẩu Supabase Auth (chỉ dùng để xác thực lần lưu đầu tiên)"
            hint="Mật khẩu không được lưu vào cấu hình hoặc Supabase."
          >
            <TextInput
              type="password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </Field>
          <button
            type="button"
            disabled={
              savingConnection || !a.supabaseAdminEmail || !adminPassword
            }
            onClick={async () => {
              setSavingConnection(true);
              setSaveMessage(null);
              const result = await saveConfigWithCredentials(
                config,
                adminPassword,
              );
              setSaveMessage(
                result.ok
                  ? "Đã xác thực và lưu cấu hình vào Supabase."
                  : `Chưa lưu được: ${result.reason || "lỗi không xác định"}. Kiểm tra email/mật khẩu Supabase Auth và RLS.`,
              );
              setSavingConnection(false);
              if (result.ok) setAdminPassword("");
            }}
            className="mb-3 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingConnection
              ? "Đang xác thực và lưu..."
              : "Lưu cấu hình Supabase"}
          </button>
          {saveMessage && (
            <p className="mb-3 text-xs font-semibold text-sky-700">
              {saveMessage}
            </p>
          )}
          <button
            onClick={async () => {
              setTesting(null);
              setTesting(
                await testSupabaseConnection(a.supabaseUrl, a.supabaseAnonKey),
              );
            }}
            className="mb-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
          >
            Kiểm tra kết nối
          </button>
          {testing !== null && (
            <p
              className={`text-xs font-semibold ${testing.ok && testing.schemaReady ? "text-emerald-600" : testing.ok ? "text-amber-600" : "text-red-600"}`}
            >
              {testing.ok && testing.schemaReady
                ? "Kết nối và schema Supabase đã sẵn sàng."
                : testing.ok
                  ? "Đã kết nối Supabase, nhưng chưa có schema. Hãy chạy supabase/funnel_configs.sql và supabase/visitor_tracking.sql trong SQL Editor."
                  : testing.reason === "unauthorized"
                    ? "URL tới được nhưng key không được Supabase chấp nhận. Hãy dùng publishable/anon key đúng project."
                    : testing.reason === "invalid_url"
                      ? "URL Supabase không đúng định dạng https://<project>.supabase.co."
                      : "Không thể kết nối Supabase. Kiểm tra mạng, URL và CORS."}
            </p>
          )}
          <button
            type="button"
            disabled={migrating || !testing?.ok || !testing.schemaReady}
            onClick={async () => {
              setMigrating(true);
              setMigration(null);
              try {
                const result = await migrateLocalDataToSupabase(config);
                setMigration(
                  `Config: ${result.configSynced ? "đã đồng bộ" : "lỗi"}; Analytics: ${result.analyticsSynced ? "đã đồng bộ" : "lỗi"}; lead tải lên: ${result.leadsUploaded}; đã có trên cloud: ${result.leadsSkipped}; lỗi: ${result.leadsFailed}. Dữ liệu local đã được dọn.`,
                );
              } catch {
                setMigration(
                  "Đồng bộ thất bại. Kiểm tra RLS và schema Supabase.",
                );
              } finally {
                setMigrating(false);
              }
            }}
            className="mb-3 rounded-lg border border-sky-600 px-3 py-2 text-xs font-bold text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {migrating
              ? "Đang đồng bộ..."
              : "Đồng bộ LocalStorage lên Supabase"}
          </button>
          {migration && (
            <p className="mb-3 text-xs font-semibold text-sky-700">
              {migration}
            </p>
          )}
        </>
      )}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => exportConfigFile(config)}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-700"
        >
          Xuất config local
        </button>
        <button
          type="button"
          onClick={() => exportSupabaseSql(config)}
          className="rounded-lg border border-sky-700 px-3 py-2 text-xs font-bold text-sky-700"
        >
          Xuất SQL Supabase
        </button>
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".js,.json,application/json,text/javascript"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const imported = importConfig(await file.text());
          window.alert(
            imported
              ? "Đã nhập và lưu cấu hình. Secret Supabase/email vẫn được giữ local."
              : "File cấu hình không hợp lệ.",
          );
        }}
      />
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-700"
        >
          Nhập config local
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Khôi phục cấu hình mặc định? Dữ liệu Supabase không bị xóa.",
              )
            )
              reset();
          }}
          className="rounded-lg border border-amber-600 px-3 py-2 text-xs font-bold text-amber-700"
        >
          Khôi phục mặc định
        </button>
      </div>
      <SaveHint />
    </AdminModal>
  );
}

/* --------------------------- ADMIN LINK ----------------------------------- */
function AdminLinkModal({ onClose }: ModalProps) {
  const { config, update, save } = useSiteConfig();
  const a = config.admin;
  const [confirm, setConfirm] = useState(a.password);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const path = a.adminPath.trim().replace(/^\/+|\/+$/g, "");

  function handleSave() {
    if (!/^[a-z0-9-]{3,40}$/i.test(path)) {
      setMsg({
        ok: false,
        text: "Đường dẫn chỉ gồm chữ, số và dấu gạch ngang (3-40 ký tự).",
      });
      return;
    }
    if (a.password.length < 4) {
      setMsg({ ok: false, text: "Mật khẩu cần tối thiểu 4 ký tự." });
      return;
    }
    if (a.password !== confirm) {
      setMsg({ ok: false, text: "Hai ô mật khẩu chưa khớp nhau." });
      return;
    }
    update((d) => (d.admin.adminPath = path));
    save();
    setMsg({
      ok: true,
      text: `Đã lưu. Đăng nhập tại /${path} với mật khẩu mới.`,
    });
  }

  return (
    <AdminModal
      title="Đổi Link & Mật Khẩu Admin"
      subtitle="Bảo mật trang quản trị"
      onClose={onClose}
    >
      <Field label="Đường dẫn admin" hint={`Truy cập tại /${path || "..."}`}>
        <TextInput
          value={a.adminPath}
          onChange={(e) => {
            setMsg(null);
            update((d) => (d.admin.adminPath = e.target.value));
          }}
        />
      </Field>
      <Field label="Mật khẩu quản trị">
        <TextInput
          type="text"
          value={a.password}
          onChange={(e) => {
            setMsg(null);
            update((d) => (d.admin.password = e.target.value));
          }}
        />
      </Field>
      <Field label="Nhập lại mật khẩu">
        <TextInput
          type="text"
          value={confirm}
          onChange={(e) => {
            setMsg(null);
            setConfirm(e.target.value);
          }}
        />
      </Field>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-white"
        >
          LƯU & ÁP DỤNG
        </button>
        <button
          onClick={() => window.open(`/${path}`, "_blank", "noopener")}
          className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-sm font-bold dark:border-white/20"
        >
          Kiểm tra link
        </button>
      </div>

      {msg && (
        <p
          className={`mt-3 text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-red-500"}`}
        >
          {msg.text}
        </p>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">
        Lưu ý: đây là mật khẩu phía client cho tiện chỉnh sửa nhanh. Với dữ liệu
        nhạy cảm hãy dùng Supabase Row Level Security.
      </p>
    </AdminModal>
  );
}

/* ------------------------------ A/B TEST ---------------------------------- */
function AbTestModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const ab = config.abTest;
  const currentVariant = getVariant(ab.enabled, ab.split);
  return (
    <AdminModal
      title="A/B Split Testing"
      subtitle="Phân phối traffic giữa 2 biến thể"
      onClose={onClose}
    >
      <Toggle
        checked={ab.enabled}
        onChange={(v) => update((d) => (d.abTest.enabled = v))}
        label="Bật A/B testing"
      />
      <Field label={`% traffic vào Variant B: ${ab.split}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={ab.split}
          onChange={(e) => update((d) => (d.abTest.split = +e.target.value))}
          className="w-full"
        />
      </Field>
      <div className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs dark:bg-white/5">
        Thiết bị này đang ở{" "}
        <strong>
          Variant {ab.enabled ? currentVariant : "A (A/B đang tắt)"}
        </strong>
        .
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nhãn Variant A">
          <TextInput
            value={ab.variantALabel}
            onChange={(e) =>
              update((d) => (d.abTest.variantALabel = e.target.value))
            }
          />
        </Field>
        <Field label="Nhãn Variant B">
          <TextInput
            value={ab.variantBLabel}
            onChange={(e) =>
              update((d) => (d.abTest.variantBLabel = e.target.value))
            }
          />
        </Field>
      </div>
      <Field label="Headline Variant A" hint="Để trống để dùng headline gốc">
        <TextInput
          value={ab.variantAHeadline}
          onChange={(e) =>
            update((d) => (d.abTest.variantAHeadline = e.target.value))
          }
        />
      </Field>
      <Field label="Headline Variant B" hint="Để trống để dùng headline gốc">
        <TextInput
          value={ab.variantBHeadline}
          onChange={(e) =>
            update((d) => (d.abTest.variantBHeadline = e.target.value))
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CTA Variant A">
          <TextInput
            value={ab.variantACta}
            onChange={(e) =>
              update((d) => (d.abTest.variantACta = e.target.value))
            }
          />
        </Field>
        <Field label="CTA Variant B">
          <TextInput
            value={ab.variantBCta}
            onChange={(e) =>
              update((d) => (d.abTest.variantBCta = e.target.value))
            }
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={() => {
          resetVariant(ab.split);
          window.sessionStorage.removeItem(
            `funnel_visit_counted_v2_ab_${ab.split}`,
          );
          window.alert(
            "Đã reset phân bổ A/B trên thiết bị này. Mở lại landing để được chia lại nhóm.",
          );
        }}
        className="mt-2 w-full rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700"
      >
        Reset phân bổ A/B trên thiết bị này
      </button>
      <SaveHint />
    </AdminModal>
  );
}

/* -------------------------------- UTM ------------------------------------- */
function UtmModal({ onClose }: ModalProps) {
  const [currentParams, setCurrentParams] = useState<Record<
    string,
    string
  > | null>(null);
  const [testUrl, setTestUrl] = useState("");
  const [builtUrl, setBuiltUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Hiển thị đúng dữ liệu mà Hub UTM đã chuẩn hoá & lưu lại
      const first = getUtmPayload("first");
      const last = getUtmPayload("last");
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(last)) {
        if (value) params[key] = value;
      }
      if (first["utm_source"] && first["utm_source"] !== last["utm_source"]) {
        params["first_touch_source"] = first["utm_source"];
      }
      setCurrentParams(params);
    } catch {
      setCurrentParams({});
    }
  }, []);

  function buildUrl() {
    try {
      const base =
        testUrl.trim() || window.location.origin + window.location.pathname;
      const u = new URL(base);
      const sources: Record<string, string> = {
        facebook: "facebook",
        tiktok: "tiktok",
        zalo: "zalo",
        google: "google",
        instagram: "instagram",
      };
      const medium =
        (document.getElementById("utm-medium") as HTMLInputElement)?.value ||
        "";
      const campaign =
        (document.getElementById("utm-campaign") as HTMLInputElement)?.value ||
        "";
      const content =
        (document.getElementById("utm-content") as HTMLInputElement)?.value ||
        "";
      const term =
        (document.getElementById("utm-term") as HTMLInputElement)?.value || "";
      const sourceSelect =
        (document.getElementById("utm-source") as HTMLSelectElement)?.value ||
        "";
      if (sourceSelect) u.searchParams.set("utm_source", sourceSelect);
      if (medium) u.searchParams.set("utm_medium", medium);
      if (campaign) u.searchParams.set("utm_campaign", campaign);
      if (content) u.searchParams.set("utm_content", content);
      if (term) u.searchParams.set("utm_term", term);
      setBuiltUrl(u.toString());
    } catch {
      setBuiltUrl("URL không hợp lệ");
    }
  }

  return (
    <AdminModal
      title="UTM Hub"
      subtitle="Kiểm tra & tạo link UTM cho chiến dịch quảng cáo"
      onClose={onClose}
    >
      <div className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-white/5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          UTM trên URL hiện tại
        </p>
        {currentParams === null ? (
          <p className="text-[11px] text-neutral-400">Đang đọc…</p>
        ) : Object.keys(currentParams).length === 0 ? (
          <p className="text-[11px] text-neutral-400">
            Không có tham số UTM — truy cập trực tiếp.
          </p>
        ) : (
          <ul className="space-y-0.5 text-[11px]">
            {Object.entries(currentParams).map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong>: {v}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-2 rounded-lg border border-neutral-200 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Tạo link UTM
        </p>
        <Field label="URL đích (để trống = trang hiện tại)">
          <TextInput
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://your-site.com/"
          />
        </Field>
        <Field label="Nguồn (utm_source)">
          <select
            id="utm-source"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-800"
            defaultValue=""
          >
            <option value="">— Chọn —</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="zalo">Zalo</option>
            <option value="google">Google</option>
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
            <option value="youtube">YouTube</option>
            <option value="telegram">Telegram</option>
          </select>
        </Field>
        <Field label="Kênh (utm_medium)">
          <TextInput id="utm-medium" placeholder="cpc, paid_social, email…" />
        </Field>
        <Field label="Chiến dịch (utm_campaign)">
          <TextInput id="utm-campaign" placeholder="khoahoc_2026_hk1" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nội dung (utm_content)">
            <TextInput id="utm-content" placeholder="banner_top" />
          </Field>
          <Field label="Từ khoá (utm_term)">
            <TextInput id="utm-term" placeholder="hoc_phi_0_dong" />
          </Field>
        </div>
        <button
          type="button"
          onClick={buildUrl}
          className="mt-2 w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-neutral-900"
        >
          Tạo link UTM
        </button>
        {builtUrl && (
          <div className="mt-2 space-y-1">
            <p className="break-all rounded-lg bg-neutral-100 px-3 py-2 text-[11px] dark:bg-white/5">
              {builtUrl}
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(builtUrl);
              }}
              className="text-[11px] font-bold text-sky-600"
            >
              Sao chép link
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Khi khách bấm vào link UTM, hệ thống tự động ghi nhận nguồn và đính kèm
        vào lead. Nếu không có UTM, hệ thống nhận diện qua referrer (Facebook,
        TikTok, Zalo, Google…) hoặc ghi "direct".
      </p>
    </AdminModal>
  );
}

/* ------------------------------- CRON ------------------------------------- */
function CronModal({ onClose }: ModalProps) {
  const { config, update, importConfig } = useSiteConfig();
  const a = config.admin;
  const [testingBackup, setTestingBackup] = useState(false);
  const [backupTestMessage, setBackupTestMessage] = useState<string | null>(
    null,
  );
  const [snapshots, setSnapshots] = useState<ConfigBackupSnapshot[]>([]);
  const databaseReady = a.storageMode === "database" && Boolean(a.supabaseUrl);
  const scheduleReady =
    a.cronSchedule === "off" ||
    (databaseReady && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.backupEmail));

  useEffect(() => {
    if (a.storageMode === "local") setSnapshots(loadLocalBackupSnapshots());
  }, [a.storageMode]);
  return (
    <AdminModal
      title="Cloud Cron & Backup"
      subtitle="Gửi backup .json định kỳ qua email"
      onClose={onClose}
    >
      <Field label="Email nhận backup">
        <TextInput
          value={a.backupEmail}
          onChange={(e) =>
            update((d) => (d.admin.backupEmail = e.target.value))
          }
        />
      </Field>
      <Field
        label="Token test backup"
        hint="Phải trùng BACKUP_CRON_TOKEN trên Vercel; token chỉ lưu trên máy này."
      >
        <TextInput
          type="password"
          value={a.backupCronToken}
          onChange={(e) =>
            update((d) => (d.admin.backupCronToken = e.target.value))
          }
        />
      </Field>
      <Field label="Lịch chạy">
        <div className="flex gap-2">
          {(["off", "daily", "weekly"] as const).map((s) => (
            <button
              key={s}
              onClick={() => update((d) => (d.admin.cronSchedule = s))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                a.cronSchedule === s
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {s === "off" ? "Tắt" : s === "daily" ? "Hàng ngày" : "Hàng tuần"}
            </button>
          ))}
        </div>
      </Field>
      <p className="text-[11px] text-neutral-400">
        Ở Database Mode: Vercel Cron gọi <code>/api/backup</code> theo lịch
        trong <code>vercel.json</code>, xuất dữ liệu Supabase và gửi qua Resend.
        Ở Local Mode: mỗi lần LƯU sẽ tạo snapshot cấu hình tự động (giữ tối đa
        10 bản gần nhất) trên trình duyệt này.
      </p>
      {a.cronSchedule !== "off" && (
        <p
          className={`mt-2 text-xs font-semibold ${scheduleReady ? "text-amber-600" : "text-red-600"}`}
        >
          {scheduleReady
            ? "Đã có cấu hình lịch/email. Cần triển khai Supabase Edge Function hoặc API backup để lịch thực sự gửi email."
            : "Chưa đủ cấu hình: cần Database Mode, Supabase URL và email nhận backup hợp lệ."}
        </p>
      )}
      <button
        type="button"
        disabled={testingBackup || !a.backupCronToken}
        onClick={async () => {
          setTestingBackup(true);
          setBackupTestMessage(null);
          try {
            const response = await fetch("/api/backup?test=1", {
              headers: { "x-backup-token": a.backupCronToken },
            });
            const detail = await response.text();
            setBackupTestMessage(`${response.status}: ${detail}`);
          } catch (error) {
            setBackupTestMessage(
              error instanceof Error
                ? error.message
                : "Không gọi được endpoint backup.",
            );
          } finally {
            setTestingBackup(false);
          }
        }}
        className="mb-3 rounded-lg border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {testingBackup ? "Đang gửi backup thử..." : "Gửi backup thử qua email"}
      </button>
      {backupTestMessage && (
        <p className="mb-3 text-xs font-semibold text-neutral-700">
          {backupTestMessage}
        </p>
      )}

      {a.storageMode === "local" && (
        <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Snapshot backup local ({snapshots.length}/10)
            </span>
            <button
              type="button"
              onClick={() => setSnapshots(loadLocalBackupSnapshots())}
              className="text-[10px] font-bold text-sky-600"
            >
              Làm mới
            </button>
          </div>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-[11px] text-neutral-400">
              Chưa có snapshot nào. Bấm Lưu ở bất kỳ modal nào để tạo bản đầu
              tiên.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {snapshots.map((snap, i) => (
                <li
                  key={snap.at}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px] dark:bg-neutral-900"
                >
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {new Date(snap.at).toLocaleString("vi-VN")}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob(
                          [JSON.stringify(snap.config, null, 2)],
                          { type: "application/json" },
                        );
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `backup-local-${snap.at.slice(0, 19).replace(/[:]/g, "-")}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-300"
                    >
                      Tải .json
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Khôi phục cấu hình từ ${new Date(snap.at).toLocaleString("vi-VN")}? Cấu hình hiện tại sẽ bị ghi đè.`,
                          )
                        ) {
                          importConfig(JSON.stringify(snap.config));
                        }
                      }}
                      className="font-bold text-emerald-700"
                    >
                      Khôi phục #{i + 1}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SaveHint />
    </AdminModal>
  );
}

const SECTION_LIBRARY: Record<
  string,
  { label: string; heading: string; body: string; buttonLabel: string }
> = {
  hero: {
    label: "Hero",
    heading: "Bắt đầu hành trình mới",
    body: "Thông điệp chính của trang và lý do khách hàng nên hành động ngay.",
    buttonLabel: "Nhận tư vấn",
  },
  countdown: {
    label: "Countdown",
    heading: "Ưu đãi có thời hạn",
    body: "Tạo động lực hành động bằng thời hạn rõ ràng và minh bạch.",
    buttonLabel: "Giữ suất ngay",
  },
  pricing: {
    label: "Pricing / Quyền lợi",
    heading: "Quyền lợi chương trình",
    body: "Liệt kê học phí, học bổng và các quyền lợi nổi bật.",
    buttonLabel: "Xem quyền lợi",
  },
  grid: {
    label: "Grid Icons",
    heading: "Điểm nổi bật",
    body: "Trình bày các lợi ích chính theo dạng lưới dễ quét trên mobile.",
    buttonLabel: "Tìm hiểu thêm",
  },
  testimonials: {
    label: "Testimonials",
    heading: "Khách hàng nói gì",
    body: "Thêm bằng chứng xã hội, trải nghiệm thực tế và kết quả đạt được.",
    buttonLabel: "Xem câu chuyện",
  },
  faq: {
    label: "FAQ",
    heading: "Câu hỏi thường gặp",
    body: "Giải đáp các băn khoăn trước khi khách hàng đăng ký.",
    buttonLabel: "Hỏi chuyên viên",
  },
  video: {
    label: "Video",
    heading: "Xem chương trình thực tế",
    body: "Đặt video giới thiệu, phỏng vấn hoặc hướng dẫn ở vị trí nổi bật.",
    buttonLabel: "Xem video",
  },
  guarantee: {
    label: "Guarantee / Cam kết",
    heading: "Cam kết đồng hành",
    body: "Nội dung cam kết, điều kiện và thông tin minh bạch.",
    buttonLabel: "Xem chi tiết",
  },
};

function LandingEditorModal({ onClose }: ModalProps) {
  const { config, update, save, resetLanding } = useSiteConfig();
  const content = config.landing;
  const importRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const heroSliderInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const galleryReplaceRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const graduationInputRef = useRef<HTMLInputElement>(null);
  const expertInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState("");
  const [heroMediaError, setHeroMediaError] = useState("");
  const [graduationError, setGraduationError] = useState("");
  const [templateType, setTemplateType] = useState("promo");
  const updateLines = (
    key: "heroTrustItems" | "pains" | "galleryCaptions",
    value: string,
  ) =>
    update((draft) => {
      draft.landing[key] = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    });
  const applyStudyInChinaHero = () =>
    update((draft) => {
      draft.landing.heroEyebrow =
        "Học THCS, THPT, Trung cấp, Cao đẳng hay Đại học?";
      draft.landing.heroTitle =
        "Tương lai không tự thay đổi nếu hôm nay bạn không dám";
      draft.landing.heroHighlight = "lựa chọn.";
      draft.landing.heroDescription =
        "Bạn đang làm công nhân trong nhà máy, xí nghiệp?\nBạn đang làm công việc thu nhập thấp và chưa thấy tương lai?\nHay bạn vẫn chưa biết nên học gì để có một nghề ổn định?\n\nDu học nghề Trung Quốc - vừa học, vừa thực hành có lương từ 15-30 triệu/tháng.";
      draft.landing.heroTrustItems = [
        "Học bổng lên đến 75%",
        "Không cần chứng chỉ HSK trước khi nhập học",
        "Không chứng minh tài chính",
        "Tốt nghiệp nhận bằng Cao đẳng chính quy, có thể liên thông Đại học",
        "🚁 Drone/Flycam - thực hành với hệ sinh thái DJI",
        "🚗 Công nghệ ô tô điện - định hướng thực hành theo hệ sinh thái BYD",
        "💻 Thương mại điện tử, AI, IoT và Smart Home",
      ];
      draft.landing.heroCtaLabel = "Nhận lộ trình phù hợp";
    });
  const applyStudyInChinaFaqs = () =>
    update((draft) => {
      draft.landing.faqHeading = "Câu hỏi thường gặp";
      draft.landing.faqs = [
        {
          slug: "thoi_gian_hoc",
          question: "Chương trình học bao nhiêu năm?",
          answer:
            "Chương trình học 03 năm hệ Cao đẳng chính quy. Sau khi tốt nghiệp, sinh viên có thể liên thông lên Đại học nếu có nhu cầu.\n\nNăm đầu tiên chủ yếu học tiếng Trung, văn hóa, lịch sử và các kiến thức hội nhập; đồng thời làm quen với môi trường học tập, sinh hoạt tại Trung Quốc.",
        },
        {
          slug: "luong_thuc_hanh",
          question: "Lương thực hành có đủ để trang trải chi phí không?",
          answer:
            "Có. Mỗi năm, sinh viên có khoảng 08 tháng thực hành hưởng lương và chỉ học lý thuyết tại trường khoảng 04 tháng.\n\nMức thu nhập thực hành thường đủ để trang trải chi phí sinh hoạt trong suốt quá trình học. Nếu chi tiêu hợp lý, nhiều bạn còn có thể tích lũy một khoản vốn trước khi tốt nghiệp.",
        },
        {
          slug: "bang_tot_nghiep",
          question: "Sau khi tốt nghiệp sẽ nhận bằng gì?",
          answer:
            "Sinh viên được cấp bằng Cao đẳng chính quy do trường tại Trung Quốc cấp, có thể liên thông lên Đại học và được công nhận tại hơn 30 quốc gia theo quy định, thỏa thuận công nhận văn bằng của từng nước.",
        },
        {
          slug: "ky_nhap_hoc",
          question: "Mỗi năm có bao nhiêu kỳ nhập học?",
          answer:
            "Thông thường chương trình có 02 kỳ nhập học:\n\n• Kỳ tháng 3\n• Kỳ tháng 9",
        },
        {
          slug: "dieu_kien_tuyen_sinh",
          question: "Chương trình nhận độ tuổi và trình độ như thế nào?",
          answer:
            "Học viện Kỹ sư Quế Lâm\n• Độ tuổi: Dưới 35 tuổi\n• Trình độ: Tốt nghiệp THCS trở lên\n\nĐại học Khoa học Kỹ thuật Điện tử Quế Lâm (GUET)\n• Độ tuổi: Dưới 30 tuổi\n• Trình độ: Tốt nghiệp THPT trở lên\n\nĐại học Nghề nghiệp Nam Thông (tỉnh Giang Tô)\n• Độ tuổi: Dưới 25 tuổi\n• Trình độ: Tốt nghiệp THPT trở lên",
        },
      ];
    });
  const applySeptemberOffer = () =>
    update((draft) => {
      const offer = {
        id: "september-2026-offer",
        type: "offer",
        label: "Ưu đãi tháng 9/2026",
        enabled: true,
        order: 1,
        content: {
          heading: "🎉 Ưu đãi đặc biệt - Tháng 9/2026 🎉",
          body: "Đăng ký tham gia chương trình trước ngày 28/09/2026 để nhận ngay:\n\n🎁 ƯU ĐÃI TRỊ GIÁ 2.000.000 ĐỒNG\n\n⏰ Số lượng ưu đãi có hạn. Áp dụng cho hồ sơ đăng ký và hoàn tất thủ tục theo quy định trước ngày 28/09/2026.\n\n👉 Đừng bỏ lỡ cơ hội trở thành du học sinh nghề Trung Quốc với nhiều chính sách hỗ trợ hấp dẫn!",
          imageUrl: "",
          variant: "offer",
          buttonLabel: "Đăng ký nhận ưu đãi 2.000.000đ",
          buttonHref: "#dang-ky",
          backgroundColor: "",
          textColor: "",
          accentColor: "",
        },
      };
      const index = draft.landing.sectionsArray.findIndex(
        (section) => section.id === offer.id,
      );
      if (index === -1) draft.landing.sectionsArray.push(offer);
      else draft.landing.sectionsArray[index] = offer;
    });
  const updateJson = <
    K extends
      | "stats"
      | "benefits"
      | "testimonials"
      | "steps"
      | "galleryImageUrls"
      | "heroSliderImages"
      | "expertImageUrls"
      | "majorDescriptions"
      | "faqs"
      | "majorNames"
      | "majorIcons"
      | "experts",
  >(
    key: K,
    value: string,
  ) => {
    try {
      const parsed = JSON.parse(value) as (typeof content)[K];
      update((draft) => {
        draft.landing[key] = parsed;
      });
    } catch {
      // Keep the textarea editable until the JSON is valid.
    }
  };
  function exportLanding() {
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "landing-page-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function importLanding(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as Partial<
          typeof content
        >;
        const hasString = (value: unknown): value is string =>
          typeof value === "string";
        const hasStringArray = (value: unknown): value is string[] =>
          Array.isArray(value) && value.every(hasString);
        const hasObjectArray = (value: unknown): value is object[] =>
          Array.isArray(value) &&
          value.every((item) => item !== null && typeof item === "object");
        if (
          !imported ||
          typeof imported !== "object" ||
          !hasString(imported.brandName) ||
          !hasString(imported.heroTitle) ||
          !hasStringArray(imported.heroTrustItems) ||
          !hasObjectArray(imported.sectionsArray) ||
          !hasObjectArray(imported.stats) ||
          !hasObjectArray(imported.benefits) ||
          !hasObjectArray(imported.faqs)
        ) {
          throw new Error("invalid landing config");
        }
        update((draft) => {
          draft.landing = {
            ...structuredClone(draft.landing),
            ...imported,
          } as typeof draft.landing;
        });
      } catch {
        window.alert("File landing config không hợp lệ.");
      }
    };
    reader.readAsText(file);
  }
  function readImageDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("invalid image"));
          return;
        }
        if (
          !content.imageOptimization.convertUploadsToWebp ||
          file.type === "image/webp" ||
          file.type === "image/svg+xml"
        ) {
          resolve(reader.result);
          return;
        }
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve(reader.result as string);
            return;
          }
          context.drawImage(image, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(reader.result as string);
                return;
              }
              const webpReader = new FileReader();
              webpReader.onload = () =>
                typeof webpReader.result === "string"
                  ? resolve(webpReader.result)
                  : reject(new Error("invalid webp"));
              webpReader.onerror = () => reject(new Error("webp read failed"));
              webpReader.readAsDataURL(blob);
            },
            "image/webp",
            Math.min(1, Math.max(0.1, content.imageOptimization.quality)),
          );
        };
        image.onerror = () => resolve(reader.result as string);
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  function uploadLogo(file: File) {
    setLogoError("");
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Logo cần là PNG, JPG, WebP hoặc SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo không được vượt quá 2MB.");
      return;
    }
    readImageDataUrl(file)
      .then((image) => {
        update((draft) => {
          draft.landing.logoUrl = image;
          draft.landing.showLogo = true;
        });
      })
      .catch(() => setLogoError("Không thể đọc file logo."));
  }
  function uploadHeroImage(file: File) {
    setHeroMediaError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setHeroMediaError("Ảnh hero cần là PNG, JPG hoặc WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setHeroMediaError("Ảnh hero không được vượt quá 2MB.");
      return;
    }
    readImageDataUrl(file)
      .then((image) => {
        update((draft) => {
          draft.landing.heroMediaMode = "image";
          draft.landing.heroImageUrl = image;
        });
      })
      .catch(() => setHeroMediaError("Không thể đọc ảnh hero."));
  }

  function uploadHeroSlider(files: FileList) {
    setHeroMediaError("");
    const selected = Array.from(files).filter(
      (file) =>
        /^image\/(png|jpeg|webp)$/.test(file.type) &&
        file.size <= 2 * 1024 * 1024,
    );
    if (selected.length === 0) {
      setHeroMediaError("Vui lòng chọn PNG/JPG/WebP tối đa 2MB.");
      return;
    }
    Promise.all(selected.map((file) => readImageDataUrl(file)))
      .then((images) => {
        update((draft) => {
          draft.landing.heroMediaMode = "slider";
          draft.landing.heroSliderImages = images;
          if (!draft.landing.heroImageUrl) {
            draft.landing.heroImageUrl = images[0] || "";
          }
        });
      })
      .catch(() => setHeroMediaError("Không thể đọc slider hero."));
  }

  function uploadGallery(files: FileList) {
    const selected = Array.from(files).filter(
      (file) =>
        /^image\/(png|jpeg|webp)$/.test(file.type) &&
        file.size <= 2 * 1024 * 1024,
    );
    if (selected.length === 0) {
      window.alert("Vui lòng chọn PNG/JPG/WebP tối đa 2MB mỗi ảnh.");
      return;
    }
    Promise.all(selected.map((file) => readImageDataUrl(file))).then(
      (images) => {
        update((draft) => {
          draft.landing.galleryImageUrls = [
            ...draft.landing.galleryImageUrls,
            ...images,
          ];
          draft.landing.galleryCaptions = [
            ...draft.landing.galleryCaptions,
            ...images.map(() => "Ảnh thực tế chương trình"),
          ];
        });
      },
    );
  }
  function replaceGalleryImage(index: number, file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      window.alert("Ảnh gallery cần là PNG, JPG hoặc WebP và tối đa 2MB.");
      return;
    }
    readImageDataUrl(file)
      .then((image) =>
        update((draft) => {
          draft.landing.galleryImageUrls[index] = image;
        }),
      )
      .catch(() => window.alert("Không thể đọc ảnh gallery."));
  }
  const GRADUATION_IMAGE_LIMIT = 25;
  function uploadGraduationImages(files: FileList) {
    setGraduationError("");
    const selected = Array.from(files).filter(
      (file) =>
        /^image\/(png|jpeg|webp)$/.test(file.type) &&
        file.size <= 2 * 1024 * 1024,
    );
    if (selected.length === 0) {
      setGraduationError("Vui lòng chọn PNG/JPG/WebP tối đa 2MB mỗi ảnh.");
      return;
    }
    const remaining =
      GRADUATION_IMAGE_LIMIT - content.graduationImageUrls.length;
    if (remaining <= 0) {
      setGraduationError(
        `Đã đạt giới hạn ${GRADUATION_IMAGE_LIMIT} ảnh. Hãy xóa bớt ảnh cũ trước khi thêm mới.`,
      );
      return;
    }
    Promise.all(
      selected.slice(0, remaining).map((file) => readImageDataUrl(file)),
    ).then((images) => {
      update((draft) => {
        draft.landing.graduationImageUrls = [
          ...draft.landing.graduationImageUrls,
          ...images,
        ];
      });
    });
  }
  function removeGraduationImage(index: number) {
    update((draft) => {
      draft.landing.graduationImageUrls =
        draft.landing.graduationImageUrls.filter((_, i) => i !== index);
    });
  }
  function replaceGraduationImage(index: number, file: File) {
    if (
      !/^image\/(png|jpeg|webp)$/.test(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      return;
    readImageDataUrl(file).then((url) =>
      update((draft) => {
        draft.landing.graduationImageUrls[index] = url;
      }),
    );
  }
  function uploadExpertImages(files: FileList) {
    const selected = Array.from(files).filter(
      (file) =>
        /^image\/(png|jpeg|webp)$/.test(file.type) &&
        file.size <= 2 * 1024 * 1024,
    );
    if (selected.length === 0) return;
    Promise.all(selected.map((file) => readImageDataUrl(file))).then(
      (images) => {
        update((draft) => {
          draft.landing.expertImageUrls = [
            ...draft.landing.expertImageUrls,
            ...images,
          ];
        });
      },
    );
  }
  function removeExpertImage(index: number) {
    update((draft) => {
      draft.landing.expertImageUrls = draft.landing.expertImageUrls.filter(
        (_, i) => i !== index,
      );
    });
  }
  function removeGalleryImage(index: number) {
    update((draft) => {
      draft.landing.galleryImageUrls = draft.landing.galleryImageUrls.filter(
        (_, i) => i !== index,
      );
      draft.landing.galleryCaptions = draft.landing.galleryCaptions.filter(
        (_, i) => i !== index,
      );
    });
  }
  function updateSections(nextSections: typeof content.sectionsArray) {
    update((draft) => {
      draft.landing.sectionsArray = nextSections.map((section, order) => ({
        ...section,
        order,
      }));
    });
  }
  function moveSection(index: number, direction: -1 | 1) {
    const next = [...content.sectionsArray];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateSections(next);
  }
  function duplicateSection(index: number) {
    const source = content.sectionsArray[index];
    if (!source) return;
    const copy = {
      id: `custom-${crypto.randomUUID?.() || Date.now()}`,
      type: "custom",
      label: `${source.label} (bản sao)`,
      enabled: true,
      order: index + 1,
      content: {
        heading: source.label,
        body: `Nội dung bản sao của section ${source.label}. Chỉnh sửa nội dung tại đây.`,
        imageUrl: "",
        buttonLabel: "",
        buttonHref: "#dang-ky",
        backgroundColor: "",
        textColor: "",
        accentColor: "",
      },
    };
    updateSections([
      ...content.sectionsArray.slice(0, index + 1),
      copy,
      ...content.sectionsArray.slice(index + 1),
    ]);
  }
  function addSection() {
    const missing = DEFAULT_CONFIG.landing.sectionsArray.find(
      (defaultSection) =>
        !content.sectionsArray.some(
          (section) => section.id === defaultSection.id,
        ),
    );
    if (missing) {
      updateSections([...content.sectionsArray, structuredClone(missing)]);
      return;
    }
    const templates: Record<
      string,
      { label: string; heading: string; body: string; buttonLabel: string }
    > = {
      promo: {
        label: "Khối quảng bá",
        heading: "Tiêu đề khối quảng bá",
        body: "Mô tả ngắn cho ưu đãi hoặc chương trình.",
        buttonLabel: "Tìm hiểu thêm",
      },
      pricing: {
        label: "Bảng quyền lợi",
        heading: "Quyền lợi chương trình",
        body: "Liệt kê học phí, học bổng và các quyền lợi nổi bật.",
        buttonLabel: "Nhận tư vấn",
      },
      guarantee: {
        label: "Cam kết",
        heading: "Cam kết đồng hành",
        body: "Nội dung cam kết, điều kiện và thông tin minh bạch.",
        buttonLabel: "Xem chi tiết",
      },
      cta: {
        label: "CTA",
        heading: "Sẵn sàng bắt đầu?",
        body: "Để lại thông tin để nhận tư vấn phù hợp.",
        buttonLabel: "Đăng ký ngay",
      },
    };
    const template = templates[templateType] ?? templates["promo"]!;
    updateSections([
      ...content.sectionsArray,
      {
        id: `custom-${Date.now()}`,
        type: "custom",
        label: template.label,
        enabled: true,
        order: content.sectionsArray.length,
        content: {
          heading: template.heading,
          body: template.body,
          imageUrl: "",
          buttonLabel: template.buttonLabel,
          buttonHref: "#dang-ky",
          backgroundColor: "",
          textColor: "",
          accentColor: "",
        },
      },
    ]);
  }
  function updateSectionContent(
    id: string,
    patch: Partial<
      NonNullable<(typeof content.sectionsArray)[number]["content"]>
    >,
  ) {
    update((draft) => {
      const section = draft.landing.sectionsArray.find(
        (item) => item.id === id,
      );
      if (!section) return;
      section.content = {
        heading: section.label,
        body: "",
        imageUrl: "",
        buttonLabel: "",
        buttonHref: "#dang-ky",
        backgroundColor: "",
        textColor: "",
        accentColor: "",
        ...section.content,
        ...patch,
      };
      if (patch.heading) section.label = patch.heading;
    });
  }
  return (
    <AdminModal
      title="Sửa Giao Diện"
      subtitle="Nội dung và hình ảnh landing page được lưu vào cấu hình"
      onClose={onClose}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          onClick={exportLanding}
          className="rounded-lg bg-neutral-900 px-2 py-2 text-xs font-bold text-white"
        >
          Xuất JSON
        </button>
        <button
          onClick={() => importRef.current?.click()}
          className="rounded-lg border border-neutral-300 px-2 py-2 text-xs font-bold"
        >
          Nhập JSON
        </button>
        <button
          onClick={() => {
            if (window.confirm("Khôi phục landing mặc định?")) resetLanding();
          }}
          className="rounded-lg border border-amber-300 px-2 py-2 text-xs font-bold text-amber-700"
        >
          Khôi phục
        </button>
        <button
          onClick={() => save()}
          className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white"
        >
          Lưu ngay
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importLanding(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mb-4 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Bảo vệ & tối ưu ảnh</p>
        <Toggle
          checked={content.imageOptimization.convertUploadsToWebp}
          onChange={(value) =>
            update((draft) => {
              draft.landing.imageOptimization.convertUploadsToWebp = value;
            })
          }
          label="Tự động đổi ảnh upload sang WebP"
        />
        <Toggle
          checked={content.watermark.enabled}
          onChange={(value) =>
            update((draft) => {
              draft.landing.watermark.enabled = value;
            })
          }
          label="Bật watermark trên website"
        />
        {content.watermark.enabled && (
          <TextInput
            value={content.watermark.text}
            onChange={(event) =>
              update((draft) => {
                draft.landing.watermark.text = event.target.value;
              })
            }
            placeholder="Nội dung watermark"
          />
        )}
        <Toggle
          checked={content.copyProtection.enabled}
          onChange={(value) =>
            update((draft) => {
              draft.landing.copyProtection.enabled = value;
            })
          }
          label="Bật bảo vệ copy"
        />
        {content.copyProtection.enabled && (
          <>
            <Toggle
              checked={content.copyProtection.blockContextMenu}
              onChange={(value) =>
                update((draft) => {
                  draft.landing.copyProtection.blockContextMenu = value;
                })
              }
              label="Chặn menu chuột phải"
            />
            <Toggle
              checked={content.copyProtection.blockImageDrag}
              onChange={(value) =>
                update((draft) => {
                  draft.landing.copyProtection.blockImageDrag = value;
                })
              }
              label="Chặn kéo ảnh"
            />
            <Toggle
              checked={content.copyProtection.disableSelection}
              onChange={(value) =>
                update((draft) => {
                  draft.landing.copyProtection.disableSelection = value;
                })
              }
              label="Tắt chọn văn bản"
            />
          </>
        )}
      </div>
      <div className="mb-4 space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">CTA & liên hệ trang chủ</p>
        <Toggle
          checked={config.countdown.enabled}
          onChange={(value) =>
            update((draft) => (draft.countdown.enabled = value))
          }
          label="Hiển thị Countdown"
        />
        {config.countdown.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số suất còn lại">
              <TextInput
                type="number"
                min="0"
                value={config.countdown.slotsLeft}
                onChange={(event) =>
                  update(
                    (draft) =>
                      (draft.countdown.slotsLeft = Math.max(
                        0,
                        Number(event.target.value) || 0,
                      )),
                  )
                }
              />
            </Field>
            <Field label="Mô tả Countdown">
              <TextInput
                value={config.countdown.headline}
                onChange={(event) =>
                  update(
                    (draft) => (draft.countdown.headline = event.target.value),
                  )
                }
              />
            </Field>
          </div>
        )}
        <Toggle
          checked={config.floatingContact.enabled}
          onChange={(value) =>
            update((draft) => (draft.floatingContact.enabled = value))
          }
          label="Hiển thị Hotline / Zalo / Messenger"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số hotline">
            <TextInput
              type="tel"
              value={config.floatingContact.hotline}
              onChange={(event) =>
                update(
                  (draft) =>
                    (draft.floatingContact.hotline = event.target.value),
                )
              }
            />
          </Field>
          <Field label="Link hoặc số Zalo">
            <TextInput
              value={config.floatingContact.zalo}
              onChange={(event) =>
                update(
                  (draft) => (draft.floatingContact.zalo = event.target.value),
                )
              }
            />
          </Field>
          <Field label="Link Messenger">
            <TextInput
              value={config.floatingContact.messenger}
              onChange={(event) =>
                update(
                  (draft) =>
                    (draft.floatingContact.messenger = event.target.value),
                )
              }
            />
          </Field>
        </div>
        <p className="text-[11px] text-neutral-400">
          Countdown và liên hệ dùng chung một nguồn cấu hình với CTA, footer và
          tracking. Bấm LƯU trên thanh Admin để áp dụng.
        </p>
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-bold">Logo & menu footer</p>
        <Field label="Logo footer URL">
          <TextInput
            type="url"
            value={config.footer.logoUrl}
            placeholder="Để trống dùng logo header"
            onChange={(event) =>
              update((draft) => (draft.footer.logoUrl = event.target.value))
            }
          />
        </Field>
        <Field label="Tên menu footer">
          <TextInput
            value={config.footer.menuLabel}
            onChange={(event) =>
              update((draft) => (draft.footer.menuLabel = event.target.value))
            }
          />
        </Field>
        <Field label="Menu footer (JSON: label, href)">
          <TextArea
            value={JSON.stringify(config.footer.menuLinks, null, 2)}
            onChange={(event) => {
              try {
                const links = JSON.parse(event.target.value) as unknown;
                if (Array.isArray(links))
                  update((draft) => (draft.footer.menuLinks = links));
              } catch {
                // Giữ nội dung đang nhập cho tới khi JSON hợp lệ.
              }
            }}
          />
        </Field>
        <p className="text-[11px] text-neutral-400">
          Footer tự xếp cột trên mobile và hai vùng trên tablet/desktop, không
          gây tràn chiều ngang.
        </p>
      </div>
      <div className="mb-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-bold">Thứ tự & trạng thái section</p>
        <Toggle
          checked={config.trafficStats.enabled}
          onChange={(value) =>
            update((draft) => (draft.trafficStats.enabled = value))
          }
          label="Bật khối thống kê truy cập"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vị trí hiển thị">
            <select
              value={config.trafficStats.position}
              onChange={(event) =>
                update(
                  (draft) =>
                    (draft.trafficStats.position = event.target
                      .value as typeof config.trafficStats.position),
                )
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <option value="footer">Chân trang</option>
              <option value="afterHero">Ngay sau Hero</option>
            </select>
          </Field>
          <Field label="Tiêu đề khối thống kê">
            <TextInput
              value={config.trafficStats.title}
              onChange={(event) =>
                update(
                  (draft) => (draft.trafficStats.title = event.target.value),
                )
              }
            />
          </Field>
        </div>
        <Field label="Mô tả hỗ trợ">
          <TextArea
            value={config.trafficStats.helperText}
            onChange={(event) =>
              update(
                (draft) => (draft.trafficStats.helperText = event.target.value),
              )
            }
          />
        </Field>
        <div className="space-y-1.5">
          {content.sectionsArray.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-50 p-1.5 text-xs dark:bg-white/5"
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <button
                onClick={() =>
                  updateSections(
                    content.sectionsArray.map((section) =>
                      section.id === item.id
                        ? { ...section, enabled: !section.enabled }
                        : section,
                    ),
                  )
                }
                className={`rounded px-2 py-1 ${item.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"}`}
              >
                {item.enabled ? "Bật" : "Tắt"}
              </button>
              <button
                onClick={() => moveSection(index, -1)}
                disabled={index === 0}
                className="rounded border px-2 py-1 disabled:opacity-30"
                aria-label="Đưa lên"
              >
                ↑
              </button>
              <button
                onClick={() => moveSection(index, 1)}
                disabled={index === content.sectionsArray.length - 1}
                className="rounded border px-2 py-1 disabled:opacity-30"
                aria-label="Đưa xuống"
              >
                ↓
              </button>
              <button
                onClick={() => duplicateSection(index)}
                className="rounded border px-2 py-1"
                aria-label="Nhân bản"
              >
                +
              </button>
              <button
                onClick={() =>
                  updateSections(
                    content.sectionsArray.filter(
                      (section) => section.id !== item.id,
                    ),
                  )
                }
                className="rounded border border-red-200 px-2 py-1 text-red-600"
                aria-label="Xóa"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <select
            value={templateType}
            onChange={(event) => setTemplateType(event.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs dark:bg-neutral-800"
          >
            <option value="promo">Khối quảng bá</option>
            <option value="pricing">Pricing / Quyền lợi</option>
            <option value="guarantee">Guarantee / Cam kết</option>
            <option value="cta">CTA</option>
          </select>
          <button
            onClick={addSection}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
          >
            + Thêm
          </button>
        </div>
      </div>
      {content.sectionsArray
        .filter((item) => item.type === "custom")
        .map((item) => (
          <div
            key={item.id}
            className="mb-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10"
          >
            <p className="mb-2 text-xs font-bold">{item.label}</p>
            <Field label="Tiêu đề">
              <TextInput
                value={item.content?.heading || ""}
                onChange={(e) =>
                  updateSectionContent(item.id, { heading: e.target.value })
                }
              />
            </Field>
            <Field label="Nội dung">
              <TextArea
                value={item.content?.body || ""}
                onChange={(e) =>
                  updateSectionContent(item.id, { body: e.target.value })
                }
              />
            </Field>
            <Field label="URL hình ảnh">
              <TextInput
                type="url"
                value={item.content?.imageUrl || ""}
                onChange={(e) =>
                  updateSectionContent(item.id, { imageUrl: e.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nhãn nút">
                <TextInput
                  value={item.content?.buttonLabel || ""}
                  onChange={(e) =>
                    updateSectionContent(item.id, {
                      buttonLabel: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Link nút">
                <TextInput
                  value={item.content?.buttonHref || "#dang-ky"}
                  onChange={(e) =>
                    updateSectionContent(item.id, {
                      buttonHref: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Nền">
                <TextInput
                  type="color"
                  value={item.content?.backgroundColor || "#ffffff"}
                  onChange={(e) =>
                    updateSectionContent(item.id, {
                      backgroundColor: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Màu chữ">
                <TextInput
                  type="color"
                  value={item.content?.textColor || "#171717"}
                  onChange={(e) =>
                    updateSectionContent(item.id, { textColor: e.target.value })
                  }
                />
              </Field>
              <Field label="Màu tiêu đề">
                <TextInput
                  type="color"
                  value={item.content?.accentColor || "#c0392b"}
                  onChange={(e) =>
                    updateSectionContent(item.id, {
                      accentColor: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      <Field label="Tên thương hiệu">
        <TextInput
          value={content.brandName}
          onChange={(e) =>
            update((d) => (d.landing.brandName = e.target.value))
          }
        />
      </Field>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold">Logo trên header</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Tự co giãn đẹp trên mobile, tablet và desktop.
            </p>
          </div>
          <Toggle
            checked={content.showLogo}
            onChange={(value) => update((d) => (d.landing.showLogo = value))}
            label=""
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200 dark:bg-white/10 dark:ring-white/10">
            {content.logoUrl ? (
              <img
                src={content.logoUrl}
                alt="Preview logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <GraduationCap className="h-7 w-7 text-neutral-500" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
              >
                Tải logo lên
              </button>
              {content.logoUrl && (
                <button
                  type="button"
                  onClick={() => update((d) => (d.landing.logoUrl = ""))}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600"
                >
                  Xóa logo
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadLogo(file);
                event.target.value = "";
              }}
            />
            {logoError && (
              <p className="text-[11px] font-semibold text-red-600">
                {logoError}
              </p>
            )}
          </div>
        </div>
        <Field label="Hoặc dùng Logo URL">
          <TextInput
            type="url"
            value={content.logoUrl.startsWith("data:") ? "" : content.logoUrl}
            onChange={(e) =>
              update((d) => (d.landing.logoUrl = e.target.value))
            }
            placeholder="https://.../logo.png"
          />
        </Field>
      </div>
      <Field label="Hero: nhãn trên đầu">
        <button
          type="button"
          onClick={applySeptemberOffer}
          className="mb-2 rounded-lg border border-gold/50 bg-gold px-3 py-2 text-xs font-bold text-gold-foreground"
        >
          Áp dụng ưu đãi tháng 9/2026
        </button>
        <button
          type="button"
          onClick={applyStudyInChinaHero}
          className="mb-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          Áp dụng nội dung Du học nghề Trung Quốc
        </button>
        <TextInput
          value={content.heroEyebrow}
          onChange={(e) =>
            update((d) => (d.landing.heroEyebrow = e.target.value))
          }
        />
      </Field>
      <Field label="Hero: tiêu đề">
        <TextInput
          value={content.heroTitle}
          onChange={(e) =>
            update((d) => (d.landing.heroTitle = e.target.value))
          }
        />
      </Field>
      <Field label="Hero: phần nhấn mạnh">
        <TextInput
          value={content.heroHighlight}
          onChange={(e) =>
            update((d) => (d.landing.heroHighlight = e.target.value))
          }
        />
      </Field>
      <Field label="Hero: mô tả">
        <TextArea
          value={content.heroDescription}
          onChange={(e) =>
            update((d) => (d.landing.heroDescription = e.target.value))
          }
        />
      </Field>
      <Field label="Hero: chế độ nền">
        <select
          value={content.heroMediaMode}
          onChange={(e) =>
            update(
              (d) =>
                (d.landing.heroMediaMode = e.target
                  .value as typeof content.heroMediaMode),
            )
          }
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
        >
          <option value="image">Ảnh tĩnh</option>
          <option value="slider">Slider nền</option>
        </select>
      </Field>
      <Field label="Hero: URL ảnh tĩnh (để trống dùng ảnh mặc định)">
        <TextInput
          type="url"
          value={content.heroImageUrl}
          onChange={(e) =>
            update((d) => (d.landing.heroImageUrl = e.target.value))
          }
        />
      </Field>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Tải media cho Hero</p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Ảnh tĩnh hoặc nhiều ảnh slider, tối đa 2MB mỗi tệp, responsive trên
          mobile/tablet/desktop.
        </p>
        <input
          ref={heroImageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadHeroImage(file);
            event.target.value = "";
          }}
        />
        <input
          ref={heroSliderInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadHeroSlider(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => heroImageInputRef.current?.click()}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
          >
            Upload ảnh tĩnh
          </button>
          <button
            onClick={() => heroSliderInputRef.current?.click()}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 dark:border-white/10 dark:text-white"
          >
            Upload slider hero
          </button>
        </div>
        {heroMediaError && (
          <p className="mt-2 text-[11px] font-medium text-red-500">
            {heroMediaError}
          </p>
        )}
      </div>
      <Field label="Hero: danh sách ảnh slider (JSON array)">
        <TextArea
          value={JSON.stringify(content.heroSliderImages, null, 2)}
          onChange={(e) => updateJson("heroSliderImages", e.target.value)}
        />
      </Field>
      <Field label="Hero: thời gian chuyển slide (ms)">
        <TextInput
          type="number"
          min="2500"
          value={content.heroSliderIntervalMs}
          onChange={(e) =>
            update(
              (d) =>
                (d.landing.heroSliderIntervalMs = Math.max(
                  2500,
                  Number(e.target.value) || 2500,
                )),
            )
          }
        />
      </Field>
      <Field label="Hero: các điểm tin tưởng (mỗi dòng một mục)">
        <TextArea
          value={content.heroTrustItems.join("\n")}
          onChange={(e) => updateLines("heroTrustItems", e.target.value)}
        />
      </Field>
      <Field label="Nhãn CTA hero">
        <div className="mb-3 rounded-lg border border-neutral-200 p-3 dark:border-white/10">
          <p className="text-xs font-bold">FAQ chương trình</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Áp dụng bộ câu hỏi về thời gian học, lương thực hành, bằng cấp và
            điều kiện tuyển sinh.
          </p>
          <button
            type="button"
            onClick={applyStudyInChinaFaqs}
            className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            Áp dụng FAQ chương trình
          </button>
        </div>
        <TextInput
          value={content.heroCtaLabel}
          onChange={(e) =>
            update((d) => (d.landing.heroCtaLabel = e.target.value))
          }
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            "painHeading",
            "benefitsHeading",
            "majorsHeading",
            "expertsHeading",
            "galleryHeading",
            "testimonialsHeading",
            "stepsHeading",
            "faqHeading",
            "finalCtaHeading",
          ] as const
        ).map((key) => (
          <Field key={key} label={key}>
            <TextInput
              value={content[key]}
              onChange={(e) => update((d) => (d.landing[key] = e.target.value))}
            />
          </Field>
        ))}
      </div>
      <Field label="Pain points (mỗi dòng một mục)">
        <TextArea
          value={content.pains.join("\n")}
          onChange={(e) => updateLines("pains", e.target.value)}
        />
      </Field>
      <Field label="Mô tả các ngành (JSON array 8 phần tử)">
        <TextArea
          value={JSON.stringify(content.majorDescriptions, null, 2)}
          onChange={(e) => updateJson("majorDescriptions", e.target.value)}
        />
      </Field>
      <Field label="Tên ngành (JSON array)">
        <TextArea
          value={JSON.stringify(content.majorNames, null, 2)}
          onChange={(e) => updateJson("majorNames", e.target.value)}
        />
      </Field>
      <Field label="Icon ngành (JSON array)">
        <TextArea
          value={JSON.stringify(content.majorIcons, null, 2)}
          onChange={(e) => updateJson("majorIcons", e.target.value)}
        />
      </Field>
      <Field label="Caption gallery (mỗi dòng một mục)">
        <TextArea
          value={content.galleryCaptions.join("\n")}
          onChange={(e) => updateLines("galleryCaptions", e.target.value)}
        />
      </Field>
      <Field label="URL ảnh gallery (JSON array)">
        <TextArea
          value={JSON.stringify(content.galleryImageUrls, null, 2)}
          onChange={(e) => updateJson("galleryImageUrls", e.target.value)}
        />
      </Field>
      {content.galleryImageUrls.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {content.galleryImageUrls.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="group relative aspect-square overflow-hidden rounded border border-neutral-200 dark:border-white/10"
            >
              <img
                src={src}
                alt={`Gallery ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeGalleryImage(i)}
                aria-label="Xóa ảnh"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Thêm nhiều ảnh vào slider</p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Chọn nhiều PNG/JPG/WebP, tối đa 2MB mỗi ảnh. Caption tương ứng chỉnh ở
          ô Caption gallery ngay phía trên.
        </p>
        <input
          ref={galleryInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadGallery(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
        >
          Chọn nhiều ảnh
        </button>
      </div>
      <div className="mb-3 rounded-xl border-2 border-sky-200 p-3 dark:border-sky-900">
        <p className="text-xs font-bold text-sky-700">
          Slider ảnh bổ sung (Hình ký kết, Trường ĐH, v.v.)
        </p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Mỗi khối hiển thị một slider riêng. Tải lên nhiều ảnh PNG/JPG/WebP
          (tối đa 2MB). Tất cả nội dung có thể tuỳ chỉnh và lưu vào Supabase.
        </p>
        {content.gallerySliders.map((slider, si) => (
          <div
            key={slider.id}
            className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-white/10"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold">
                Slider {si + 1}: {slider.heading || "(chưa đặt tên)"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    update((d) => {
                      const src = d.landing.gallerySliders[si]!;
                      d.landing.gallerySliders.splice(si + 1, 0, {
                        ...structuredClone(src),
                        id: `slider-${Date.now()}`,
                        heading: `${src.heading} (bản sao)`,
                      });
                    })
                  }
                  className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
                  aria-label="Nhân bản slider"
                  title="Nhân bản slider"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update((d) => {
                      d.landing.gallerySliders.splice(si, 1);
                    })
                  }
                  className="rounded-md p-1 text-red-500 hover:bg-red-50"
                  aria-label="Xóa slider"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Toggle
              checked={slider.enabled}
              onChange={(v) =>
                update((d) => {
                  d.landing.gallerySliders[si]!.enabled = v;
                })
              }
              label="Hiển thị slider này"
            />
            <Field label="Vị trí hiển thị (hiện sau khối nào)">
              <select
                value={slider.insertAfter || "gallery"}
                onChange={(e) =>
                  update((d) => {
                    d.landing.gallerySliders[si]!.insertAfter = e.target.value;
                  })
                }
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-neutral-900"
              >
                {content.sectionsArray.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Sau: {sec.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tiêu đề">
              <TextInput
                value={slider.heading}
                onChange={(e) =>
                  update((d) => {
                    d.landing.gallerySliders[si]!.heading = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Mô tả">
              <TextInput
                value={slider.description}
                onChange={(e) =>
                  update((d) => {
                    d.landing.gallerySliders[si]!.description = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Caption (mỗi dòng một mục, khớp thứ tự ảnh)">
              <TextArea
                value={slider.captions.join("\n")}
                onChange={(e) =>
                  update((d) => {
                    d.landing.gallerySliders[si]!.captions = e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                  })
                }
              />
            </Field>
            <Field label="URL ảnh (JSON array)">
              <TextArea
                value={JSON.stringify(slider.imageUrls, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value) as string[];
                    if (Array.isArray(parsed))
                      update((d) => {
                        d.landing.gallerySliders[si]!.imageUrls = parsed;
                      });
                  } catch {
                    /* keep editing */
                  }
                }}
              />
            </Field>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              id={`gallery-slider-upload-${slider.id}`}
              onChange={(event) => {
                if (!event.target.files) return;
                const files = Array.from(event.target.files).filter(
                  (f) =>
                    /^image\/(png|jpeg|webp)$/.test(f.type) &&
                    f.size <= 2 * 1024 * 1024,
                );
                if (files.length === 0) return;
                Promise.all(
                  files.map(
                    (f) =>
                      new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () =>
                          typeof r.result === "string"
                            ? resolve(r.result)
                            : reject(new Error("invalid"));
                        r.onerror = () => reject(new Error("read failed"));
                        r.readAsDataURL(f);
                      }),
                  ),
                ).then((images) => {
                  update((d) => {
                    const s = d.landing.gallerySliders[si]!;
                    s.imageUrls = [...s.imageUrls, ...images];
                    s.captions = [
                      ...s.captions,
                      ...images.map(() => "Ảnh thực tế"),
                    ];
                  });
                });
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(`gallery-slider-upload-${slider.id}`)
                  ?.click()
              }
              className="mt-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
            >
              Tải ảnh lên slider ({slider.imageUrls.length} ảnh)
            </button>
            {slider.imageUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {slider.imageUrls.map((src, ii) => (
                  <div
                    key={`${src}-${ii}`}
                    className="group relative aspect-square overflow-hidden rounded border border-neutral-200 dark:border-white/10"
                  >
                    <img
                      src={src}
                      alt={`Ảnh ${ii + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update((d) => {
                          const s = d.landing.gallerySliders[si]!;
                          s.imageUrls.splice(ii, 1);
                          s.captions.splice(ii, 1);
                        })
                      }
                      aria-label="Xóa ảnh"
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update((d) => {
              d.landing.gallerySliders.push({
                id: `slider-${Date.now()}`,
                heading: "Slider ảnh mới",
                description: "Mô tả cho slider ảnh mới.",
                imageUrls: [],
                captions: [],
                enabled: true,
                insertAfter: "gallery",
              });
            })
          }
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-600"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm slider ảnh
        </button>
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">
          Minh chứng tốt nghiệp (Trust section)
        </p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Hiển thị sau Gallery để tăng độ tin cậy. Tối đa{" "}
          {GRADUATION_IMAGE_LIMIT} ảnh, mỗi ảnh PNG/JPG/WebP tối đa 2MB.
        </p>
        <Field label="Nhãn (badge)">
          <TextInput
            value={content.graduationBadge}
            onChange={(e) =>
              update((d) => (d.landing.graduationBadge = e.target.value))
            }
          />
        </Field>
        <Field label="Tiêu đề">
          <TextInput
            value={content.graduationHeading}
            onChange={(e) =>
              update((d) => (d.landing.graduationHeading = e.target.value))
            }
          />
        </Field>
        <Field label="Nội dung">
          <TextArea
            value={content.graduationDescription}
            onChange={(e) =>
              update((d) => (d.landing.graduationDescription = e.target.value))
            }
          />
        </Field>
        <input
          ref={graduationInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadGraduationImages(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => graduationInputRef.current?.click()}
          className="mt-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
        >
          Tải ảnh minh chứng ({content.graduationImageUrls.length}/
          {GRADUATION_IMAGE_LIMIT})
        </button>
        {graduationError && (
          <p className="mt-2 text-[11px] font-semibold text-red-600">
            {graduationError}
          </p>
        )}
        {content.graduationImageUrls.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {content.graduationImageUrls.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 dark:border-white/10"
              >
                <img
                  src={src}
                  alt={`Ảnh minh chứng ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  id={`graduation-replace-${i}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) replaceGraduationImage(i, file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`graduation-replace-${i}`)?.click()
                  }
                  aria-label="Thay thế ảnh"
                  className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                >
                  Đổi
                </button>
                <button
                  type="button"
                  onClick={() => removeGraduationImage(i)}
                  aria-label="Xóa ảnh"
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
                <input
                  ref={(element) => {
                    galleryReplaceRefs.current[i] = element;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) replaceGalleryImage(i, file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => galleryReplaceRefs.current[i]?.click()}
                  aria-label="Thay ảnh"
                  className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                >
                  Thay
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Ảnh chuyên gia / đội tư vấn</p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Tải lên ảnh chuyên gia (PNG/JPG/WebP, tối đa 2MB). Thứ tự ảnh khớp với
          danh sách chuyên gia bên dưới.
        </p>
        <input
          ref={expertInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadExpertImages(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => expertInputRef.current?.click()}
          className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
        >
          Tải ảnh chuyên gia ({content.expertImageUrls.length} ảnh)
        </button>
        {content.expertImageUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {content.expertImageUrls.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="group relative aspect-square overflow-hidden rounded border border-neutral-200 dark:border-white/10"
              >
                <img
                  src={src}
                  alt={`Chuyên gia ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExpertImage(i)}
                  aria-label="Xóa ảnh"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Danh sách chuyên gia</p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Chỉnh sửa tên, vai trò, tiểu sử và kinh nghiệm từng chuyên gia.
        </p>
        {content.experts.map((expert, ei) => (
          <div
            key={ei}
            className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold">Chuyên gia {ei + 1}</span>
              <button
                type="button"
                onClick={() =>
                  update((d) => {
                    d.landing.experts.splice(ei, 1);
                    if (ei < d.landing.expertImageUrls.length)
                      d.landing.expertImageUrls.splice(ei, 1);
                  })
                }
                className="rounded-md p-1 text-red-500 hover:bg-red-50"
                aria-label="Xóa chuyên gia"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Field label="Tên">
              <TextInput
                value={expert.name}
                onChange={(e) =>
                  update((d) => {
                    d.landing.experts[ei]!.name = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Vai trò / Chức danh">
              <TextInput
                value={expert.role}
                onChange={(e) =>
                  update((d) => {
                    d.landing.experts[ei]!.role = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Tiểu sử">
              <TextArea
                value={expert.bio}
                onChange={(e) =>
                  update((d) => {
                    d.landing.experts[ei]!.bio = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Kinh nghiệm">
              <TextInput
                value={expert.experience}
                onChange={(e) =>
                  update((d) => {
                    d.landing.experts[ei]!.experience = e.target.value;
                  })
                }
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update((d) => {
              d.landing.experts.push({
                name: "Chuyên gia mới",
                role: "Cố vấn tuyển sinh",
                bio: "Giới thiệu kinh nghiệm và chuyên môn.",
                experience: "10+ năm",
              });
            })
          }
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-600"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm chuyên gia
        </button>
      </div>
      <Field label="Stats (JSON array gồm value, label)">
        <TextArea
          value={JSON.stringify(content.stats, null, 2)}
          onChange={(e) => updateJson("stats", e.target.value)}
        />
      </Field>
      <Field label="Benefits (JSON array gồm stat, title, text)">
        <TextArea
          value={JSON.stringify(content.benefits, null, 2)}
          onChange={(e) => updateJson("benefits", e.target.value)}
        />
      </Field>
      <Field label="Tiêu đề phần Testimonials">
        <TextInput
          value={content.testimonialsHeading}
          onChange={(e) =>
            update((d) => (d.landing.testimonialsHeading = e.target.value))
          }
        />
      </Field>
      <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
        <p className="text-xs font-bold">Danh sách Testimonials</p>
        <p className="mt-1 text-[11px] text-neutral-400">
          Chỉnh sửa tên, thông tin, lời nhận xét và ảnh đại diện từng học viên.
        </p>
        {content.testimonials.map((t, ti) => (
          <div
            key={ti}
            className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold">Học viên {ti + 1}</span>
              <button
                type="button"
                onClick={() =>
                  update((d) => {
                    d.landing.testimonials.splice(ti, 1);
                  })
                }
                className="rounded-md p-1 text-red-500 hover:bg-red-50"
                aria-label="Xóa testimonial"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Field label="Tên">
              <TextInput
                value={t.name}
                onChange={(e) =>
                  update((d) => {
                    d.landing.testimonials[ti]!.name = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Thông tin (ngành, địa điểm, khóa)">
              <TextInput
                value={t.meta}
                onChange={(e) =>
                  update((d) => {
                    d.landing.testimonials[ti]!.meta = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Lời nhận xét">
              <TextArea
                value={t.text}
                onChange={(e) =>
                  update((d) => {
                    d.landing.testimonials[ti]!.text = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Ảnh đại diện (tùy chọn)">
              <div className="flex items-center gap-2">
                {t.avatarUrl && (
                  <img
                    src={t.avatarUrl}
                    alt={t.name}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  id={`testimonial-avatar-${ti}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (
                      /^image\/(png|jpeg|webp)$/.test(file.type) &&
                      file.size <= 2 * 1024 * 1024
                    ) {
                      readImageDataUrl(file).then((url) =>
                        update((d) => {
                          d.landing.testimonials[ti]!.avatarUrl = url;
                        }),
                      );
                    }
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`testimonial-avatar-${ti}`)?.click()
                  }
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {t.avatarUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                </button>
                {t.avatarUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      update((d) => {
                        d.landing.testimonials[ti]!.avatarUrl = "";
                      })
                    }
                    className="rounded-md p-1 text-red-500 hover:bg-red-50"
                    aria-label="Xóa ảnh"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update((d) => {
              d.landing.testimonials.push({
                name: "Học viên mới",
                meta: "Ngành · Địa điểm · khóa",
                text: "Lời nhận xét của học viên.",
                avatarUrl: "",
              });
            })
          }
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-600"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm testimonial
        </button>
      </div>
      <Field label="Steps (JSON array gồm number, title, description)">
        <TextArea
          value={JSON.stringify(content.steps, null, 2)}
          onChange={(e) => updateJson("steps", e.target.value)}
        />
      </Field>
      <Field label="FAQ (JSON array gồm slug, question, answer)">
        <button
          type="button"
          onClick={applyStudyInChinaFaqs}
          className="mb-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          Áp dụng FAQ chương trình
        </button>
        <TextArea
          value={JSON.stringify(content.faqs, null, 2)}
          onChange={(e) => updateJson("faqs", e.target.value)}
        />
      </Field>
      <Field label="Mô tả CTA cuối trang">
        <TextArea
          value={content.finalCtaDescription}
          onChange={(e) =>
            update((d) => (d.landing.finalCtaDescription = e.target.value))
          }
        />
      </Field>
      <Field
        label="Nội dung chân trang — đơn vị bảo trợ"
        hint="Hiển thị ở cuối trang. Để trống thì dùng giá trị mặc định."
      >
        <TextArea
          value={config.footer.sponsorText}
          onChange={(e) =>
            update((d) => (d.footer.sponsorText = e.target.value))
          }
        />
      </Field>
      <SaveHint />
    </AdminModal>
  );
}

function PagesModal({ onClose }: ModalProps) {
  const { config, update } = useSiteConfig();
  const [selectedId, setSelectedId] = useState(config.pages[0]?.id || "");
  const selected =
    config.pages.find((page) => page.id === selectedId) || config.pages[0];
  if (!selected) return null;
  const selectedPageId = selected.id;
  const normalizedSelectedPath =
    selected?.path
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .toLowerCase() || "";
  const pathConflict = Boolean(
    normalizedSelectedPath &&
    config.pages.some(
      (page) =>
        page.id !== selected.id &&
        page.path
          .trim()
          .replace(/^\/+|\/+$/g, "")
          .toLowerCase() === normalizedSelectedPath,
    ),
  );

  function updatePage(
    id: string,
    patch: Partial<(typeof config.pages)[number]>,
  ) {
    update((draft) => {
      const page = draft.pages.find((item) => item.id === id);
      if (page) Object.assign(page, patch);
    });
  }

  function addPage(kind: "custom" | "thankYou") {
    const id = `page_${Date.now()}`;
    const path =
      kind === "thankYou" ? `cam-on-${Date.now()}` : `trang-${Date.now()}`;
    update((draft) => {
      const nextMenuOrder =
        draft.pages.reduce(
          (maxOrder, page) => Math.max(maxOrder, page.menuOrder),
          -1,
        ) + 1;
      draft.pages.push({
        id,
        title: kind === "thankYou" ? "Trang cảm ơn mới" : "Trang mới",
        path,
        kind,
        enabled: true,
        showInMenu: kind === "custom",
        menuOrder: nextMenuOrder,
        heading: kind === "thankYou" ? "Cảm ơn bạn!" : "Tiêu đề trang mới",
        description: "Nội dung trang được chỉnh sửa trong Admin.",
        ctaLabel: "Về trang chủ",
        ctaHref: "/",
        sectionIds: [],
      });
    });
    setSelectedId(id);
  }

  function removePage(id: string) {
    if (id === "home") return;
    update((draft) => {
      draft.pages = draft.pages.filter((page) => page.id !== id);
    });
    if (selectedId === id) setSelectedId("home");
  }

  function addSectionToPage(type: string) {
    const template = SECTION_LIBRARY[type] ?? SECTION_LIBRARY["hero"]!;
    const sectionId = `page-${selectedPageId}-${type}-${Date.now()}`;
    update((draft) => {
      draft.landing.sectionsArray.push({
        id: sectionId,
        type: "custom",
        label: template.label,
        enabled: true,
        order: draft.landing.sectionsArray.length,
        content: {
          heading: template.heading,
          body: template.body,
          imageUrl: "",
          variant: type,
          buttonLabel: template.buttonLabel,
          buttonHref: "#dang-ky",
          backgroundColor: "",
          textColor: "",
          accentColor: "",
        },
      });
      const page = draft.pages.find((item) => item.id === selectedPageId);
      if (page) page.sectionIds = [...(page.sectionIds || []), sectionId];
    });
  }

  function detachSectionFromPage(sectionId: string) {
    update((draft) => {
      const page = draft.pages.find((item) => item.id === selectedPageId);
      if (page)
        page.sectionIds = (page.sectionIds || []).filter(
          (id) => id !== sectionId,
        );
    });
  }

  function updatePageSection(
    sectionId: string,
    patch: Partial<
      NonNullable<(typeof config.landing.sectionsArray)[number]["content"]>
    >,
  ) {
    update((draft) => {
      const section = draft.landing.sectionsArray.find(
        (item) => item.id === sectionId,
      );
      if (!section) return;
      section.content = {
        heading: section.label,
        body: "",
        imageUrl: "",
        buttonLabel: "",
        buttonHref: "#dang-ky",
        backgroundColor: "",
        textColor: "",
        accentColor: "",
        ...section.content,
        ...patch,
      };
      if (patch.heading?.trim()) section.label = patch.heading.trim();
    });
  }

  return (
    <AdminModal
      title="Quản Lý Đa Trang & Menu"
      subtitle="Tạo trang phụ, Thank You page và menu điều hướng hoạt động thật"
      onClose={onClose}
    >
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => addPage("custom")}
          className="flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
        >
          + Trang mới
        </button>
        <button
          type="button"
          onClick={() => addPage("thankYou")}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold"
        >
          + Thank You
        </button>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2">
        {config.pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => setSelectedId(page.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${page.id === selected.id ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
          >
            {page.title}
          </button>
        ))}
      </div>
      <Field label="Tên trang">
        <TextInput
          value={selected.title}
          onChange={(e) => updatePage(selected.id, { title: e.target.value })}
        />
      </Field>
      <Field
        label="Đường dẫn"
        hint={
          selected.path ? `Truy cập: /${selected.path}` : "Trang chủ dùng /"
        }
      >
        <TextInput
          disabled={selected.kind === "landing"}
          value={selected.path}
          onChange={(e) => {
            const path = e.target.value
              .replace(/^\/+|[^a-z0-9-]/gi, "")
              .toLowerCase();
            if (
              !path ||
              !config.pages.some(
                (page) => page.id !== selected.id && page.path === path,
              )
            )
              updatePage(selected.id, { path });
          }}
        />
      </Field>
      {pathConflict && (
        <p className="mb-3 text-xs font-semibold text-red-600">
          Đường dẫn này đã được dùng bởi một trang khác.
        </p>
      )}
      <Field label="Tiêu đề hiển thị">
        <TextInput
          value={selected.heading}
          onChange={(e) => updatePage(selected.id, { heading: e.target.value })}
        />
      </Field>
      <Field label="Mô tả">
        <TextArea
          value={selected.description}
          onChange={(e) =>
            updatePage(selected.id, { description: e.target.value })
          }
        />
      </Field>
      <Field label="Nút CTA">
        <TextInput
          value={selected.ctaLabel}
          onChange={(e) =>
            updatePage(selected.id, { ctaLabel: e.target.value })
          }
        />
      </Field>
      <Field label="Link CTA">
        <TextInput
          value={selected.ctaHref}
          onChange={(e) => updatePage(selected.id, { ctaHref: e.target.value })}
        />
      </Field>
      <Toggle
        checked={selected.enabled}
        onChange={(value) => updatePage(selected.id, { enabled: value })}
        label="Trang đang hoạt động"
      />
      <Toggle
        checked={selected.showInMenu}
        onChange={(value) => updatePage(selected.id, { showInMenu: value })}
        label="Hiển thị trong menu"
      />
      <Field label="Thứ tự menu">
        <TextInput
          type="number"
          value={selected.menuOrder}
          onChange={(e) =>
            updatePage(selected.id, { menuOrder: Number(e.target.value) || 0 })
          }
        />
      </Field>
      {selected.kind !== "landing" && (
        <Field
          label="Section hiển thị trên trang"
          hint="Tạo mới và gắn section ngay tại đây, hoặc quản lý nội dung trong Thêm Khối Giao Diện."
        >
          <div className="space-y-1.5 rounded-lg border border-neutral-200 p-2">
            {(selected.sectionIds || []).length === 0 && (
              <p className="text-xs text-neutral-400">
                Chưa gắn section nào vào trang này.
              </p>
            )}
            {(selected.sectionIds || []).map((sectionId) => {
              const section = config.landing.sectionsArray.find(
                (item) => item.id === sectionId,
              );
              if (!section) return null;
              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-neutral-200 p-2"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {section.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => detachSectionFromPage(section.id)}
                      className="font-bold text-red-600"
                    >
                      Bỏ
                    </button>
                  </div>
                  <TextInput
                    aria-label="Tiêu đề"
                    value={section.content?.heading || section.label}
                    onChange={(event) =>
                      updatePageSection(section.id, {
                        heading: event.target.value,
                      })
                    }
                    placeholder="Tiêu đề block"
                  />
                  <TextArea
                    aria-label="Nội dung"
                    value={section.content?.body || ""}
                    onChange={(event) =>
                      updatePageSection(section.id, {
                        body: event.target.value,
                      })
                    }
                    placeholder="Nội dung đúng vai trò của block"
                  />
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <TextInput
                      value={section.content?.buttonLabel || ""}
                      onChange={(event) =>
                        updatePageSection(section.id, {
                          buttonLabel: event.target.value,
                        })
                      }
                      placeholder="Nhãn CTA"
                    />
                    <TextInput
                      value={section.content?.buttonHref || "#dang-ky"}
                      onChange={(event) =>
                        updatePageSection(section.id, {
                          buttonHref: event.target.value,
                        })
                      }
                      placeholder="Link CTA"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {Object.entries(SECTION_LIBRARY).map(([type, template]) => (
              <button
                key={type}
                type="button"
                aria-label={`+ ${template.label}`}
                onClick={() => addSectionToPage(type)}
                className="rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-left text-[11px] font-semibold hover:border-primary"
              >
                + {template.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      <button
        type="button"
        disabled={selected.id === "home" || pathConflict}
        onClick={() => removePage(selected.id)}
        className="w-full rounded-lg border border-red-200 py-2 text-xs font-bold text-red-600 disabled:opacity-40"
      >
        Xóa trang này
      </button>
      <SaveHint />
    </AdminModal>
  );
}

function GuideModal({ onClose }: ModalProps) {
  const { config } = useSiteConfig();
  const isHttpUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.hostname === "localhost";
    } catch {
      return false;
    }
  };
  const isEmailLike = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const isPhoneLike = (value: string) => value.replace(/\D/g, "").length >= 8;
  const activeTrackingChannels = [
    config.tracking.facebookPixelId,
    config.tracking.tiktokPixelId,
    config.tracking.ga4Id,
    config.tracking.gtmId,
  ].filter((value) => value.trim()).length;
  const trackingEventsEnabled = Object.values(config.tracking.events).some(
    Boolean,
  );
  const primaryWebhookReady =
    !!config.form.webhookUrl.trim() && isHttpUrl(config.form.webhookUrl.trim());
  const normalizedPagePaths = config.pages.map((page) =>
    page.path
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .toLowerCase(),
  );
  const pagePathsAreUnique =
    new Set(normalizedPagePaths).size === normalizedPagePaths.length;
  const pagePathsAreValid = config.pages.every(
    (page) =>
      !page.path ||
      /^[a-z0-9-]+$/i.test(page.path.trim().replace(/^\/+|\/+$/g, "")),
  );
  const knownSectionIds = new Set(
    config.landing.sectionsArray.map((section) => section.id),
  );
  const pageSectionsAreValid = config.pages.every((page) =>
    (page.sectionIds || []).every((sectionId) =>
      knownSectionIds.has(sectionId),
    ),
  );
  const configuredWebhookCount = [
    config.form.webhookUrl,
    ...config.webhooks
      .filter((endpoint) => endpoint.enabled)
      .map((endpoint) => endpoint.url),
  ].filter(
    (url) => url.trim() && url.startsWith("http") && !url.includes("REPLACE"),
  ).length;
  const configuredWebhookUrls = [
    config.form.webhookUrl,
    ...config.webhooks
      .filter((endpoint) => endpoint.enabled)
      .map((endpoint) => endpoint.url),
  ].filter(
    (url) => url.trim() && url.startsWith("http") && !url.includes("REPLACE"),
  );
  const adminPath = config.admin.adminPath.trim().replace(/^\/+|\/+$/g, "");
  const storageReady =
    config.admin.storageMode === "local" ||
    (isHttpUrl(config.admin.supabaseUrl.trim()) &&
      !!config.admin.supabaseAnonKey.trim());
  const contactReady =
    !config.floatingContact.enabled ||
    isPhoneLike(config.floatingContact.hotline) ||
    isHttpUrl(config.floatingContact.zalo.trim()) ||
    isHttpUrl(config.floatingContact.messenger.trim());
  const checks = [
    {
      label: "Lead có đầu ra nhận dữ liệu",
      ok: primaryWebhookReady || configuredWebhookCount > 0,
      purpose:
        "Ngăn form gửi thành công nhưng dữ liệu không tới đội sale hoặc hệ CRM.",
      action:
        "Nhập Webhook chính hợp lệ hoặc bật ít nhất một endpoint đang nhận lead.",
    },
    {
      label: "Webhook không bị trùng hoặc cấu hình sai",
      ok: new Set(configuredWebhookUrls).size === configuredWebhookCount,
      purpose:
        "Tránh gửi lead lặp, đo sai chuyển đổi và làm đội vận hành xử lý trùng dữ liệu.",
      action: "Loại bỏ URL trùng nhau và test lại từng endpoint quan trọng.",
    },
    {
      label: "Tracking đang đủ tối thiểu để đo hiệu quả",
      ok: activeTrackingChannels > 0 && trackingEventsEnabled,
      purpose:
        "Giúp biết nguồn quảng cáo nào ra lead và phát hiện điểm rơi chuyển đổi.",
      action:
        "Điền ít nhất một Pixel, GA4 hoặc GTM và giữ các event cốt lõi ở trạng thái bật.",
    },
    {
      label: "SEO cốt lõi đủ để trang hiển thị đúng",
      ok:
        !!config.seo.title.trim() &&
        !!config.seo.description.trim() &&
        !!config.seo.ogImage.trim(),
      purpose:
        "Giữ chất lượng hiển thị trên Google, Facebook và tránh snippet rỗng.",
      action:
        "Điền title, description và ảnh OG rõ ràng cho chiến dịch đang chạy.",
    },
    {
      label: "Kênh liên hệ nhanh đang sẵn sàng",
      ok: contactReady,
      purpose:
        "Đảm bảo khách có đường liên hệ ngay khi chưa kịp điền form hoặc cần tư vấn gấp.",
      action:
        "Bật hotline, Zalo hoặc Messenger với thông tin hợp lệ nếu muốn nhận lead tức thì.",
    },
    {
      label: "Lưu trữ và backup phù hợp chế độ vận hành",
      ok:
        storageReady &&
        (config.admin.cronSchedule === "off" ||
          isEmailLike(config.admin.backupEmail)),
      purpose:
        "Giảm nguy cơ mất cấu hình, mất lead và hỗ trợ đồng bộ khi nhiều người cùng vận hành.",
      action:
        "Nếu dùng database hãy điền Supabase; nếu bật cron backup hãy thêm email nhận backup.",
    },
    {
      label: "Admin có đường dẫn và mật khẩu an toàn cơ bản",
      ok:
        /^[a-z0-9-]+$/i.test(adminPath) &&
        config.admin.password.trim().length >= 6 &&
        config.admin.password !== DEFAULT_CONFIG.admin.password,
      purpose:
        "Giảm truy cập nhầm hoặc rủi ro giữ nguyên thông tin đăng nhập mặc định.",
      action:
        "Đổi admin path rõ ràng và thay mật khẩu mặc định bằng mật khẩu riêng từ 6 ký tự trở lên.",
    },
    {
      label: "Đa trang không trùng đường dẫn",
      ok: pagePathsAreUnique && pagePathsAreValid,
      purpose:
        "Ngăn va chạm route khiến menu, quảng cáo hoặc index SEO dẫn sai nội dung.",
      action:
        "Chuẩn hóa slug từng trang bằng chữ, số, dấu gạch ngang và tránh trùng nhau.",
    },
    {
      label: "Section đa trang còn tồn tại đúng phạm vi",
      ok: pageSectionsAreValid,
      purpose:
        "Đảm bảo section đã gán cho từng trang vẫn còn tồn tại và hiển thị đúng vị trí.",
      action:
        "Gỡ section đã xóa khỏi từng trang hoặc tạo lại section còn thiếu.",
    },
  ];
  const passedCount = checks.filter((check) => check.ok).length;
  const pendingCount = checks.length - passedCount;
  const score = Math.round((passedCount / checks.length) * 100);
  const readiness =
    score === 100
      ? {
          label: "Sẵn sàng vận hành",
          description:
            "Các điểm cốt lõi đã ổn. Có thể chạy ads, nhận lead và theo dõi hiệu quả mượt hơn.",
          tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
        }
      : score >= 75
        ? {
            label: "Hoạt động tốt nhưng còn mục nên tối ưu",
            description:
              "Hệ thống đã dùng được, nhưng nên xử lý hết cảnh báo để tránh sai số hoặc thất thoát lead.",
            tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
          }
        : {
            label: "Cần hoàn thiện thêm trước khi đẩy mạnh vận hành",
            description:
              "Một số cấu hình nền tảng còn thiếu; nên xử lý trước để website chạy đúng vai trò và mục đích sinh ra.",
            tone: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
          };
  const valueChecklist = [
    {
      label: "Giảm rủi ro mất lead hoặc gửi lead trùng.",
      done:
        (primaryWebhookReady || configuredWebhookCount > 0) &&
        new Set(configuredWebhookUrls).size === configuredWebhookCount,
    },
    {
      label: "Giữ tracking đủ dữ liệu để đánh giá nguồn quảng cáo.",
      done: activeTrackingChannels > 0 && trackingEventsEnabled,
    },
    {
      label:
        "Giúp đội vận hành biết ngay mục nào cần sửa trước khi chạy chiến dịch.",
      done: score >= 75,
    },
    {
      label:
        "Xác nhận website đang dùng đúng vai trò: hút lead, tư vấn nhanh và đo hiệu quả.",
      done: score === 100,
    },
  ];
  return (
    <AdminModal
      title="Hướng Dẫn & Health Check"
      subtitle="Chẩn đoán nhanh trạng thái hệ thống"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className={`rounded-2xl border px-4 py-3 ${readiness.tone}`}>
          <p className="text-xs font-black uppercase tracking-[0.18em]">
            {readiness.label}
          </p>
          <p className="mt-1 text-sm font-medium">{readiness.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Điểm health"
            value={`${score}/100`}
            tone="text-primary"
          />
          <Stat label="Mục đạt" value={passedCount} tone="text-emerald-600" />
          <Stat
            label="Mục cần xử lý"
            value={pendingCount}
            tone="text-amber-600"
          />
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 text-xs dark:border-white/10">
          <p className="font-bold text-neutral-900 dark:text-neutral-100">
            Tính năng này sinh ra để làm gì?
          </p>
          <ul className="mt-2 space-y-1.5 text-neutral-600 dark:text-neutral-300">
            <li>
              • Rà soát nhanh toàn bộ điểm dễ làm website chạy sai vai trò hoặc
              thất thoát lead.
            </li>
            <li>
              • Cảnh báo ngay cấu hình ảnh hưởng tới đo lường, đa trang, liên hệ
              và backup.
            </li>
            <li>
              • Xác nhận mức độ sẵn sàng trước khi chạy quảng cáo hoặc bàn giao
              vận hành.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          {checks.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-neutral-200 px-3 py-3 text-xs dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">
                    {c.label}
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                    {c.purpose}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    c.ok
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  }`}
                >
                  {c.ok ? "OK" : "Cần xử lý"}
                </span>
              </div>
              <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                <span className="font-semibold">Nâng cấp đề xuất:</span>{" "}
                {c.action}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            Checklist giá trị sau khi hoàn tất
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            {valueChecklist.map((item) => (
              <li key={item.label}>
                <span
                  className={item.done ? "text-emerald-600" : "text-amber-600"}
                >
                  {item.done ? "☑" : "☐"}
                </span>{" "}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
          <li>
            Đăng nhập admin, mở đúng công cụ cần chỉnh và cập nhật cấu hình còn
            thiếu.
          </li>
          <li>
            Bấm LƯU để áp dụng ngay, sau đó XUẤT CONFIG nếu cần đồng bộ lại mã
            nguồn.
          </li>
          <li>
            Nếu dùng nhiều thiết bị hoặc cần lưu cloud, cấu hình Storage Mode
            trước khi chạy thật.
          </li>
          <li>
            Vào Cổng Webhook & Đa Kênh để test endpoint; chỉ chạy traffic khi
            các kênh quan trọng báo OK.
          </li>
          <li>
            Khi điểm health đạt 100/100, xem như xác nhận vận hành thành công.
          </li>
        </ol>
      </div>
    </AdminModal>
  );
}

/* ----------------------------- REGISTRY ----------------------------------- */
const REGISTRY: Record<AdminModalKey, (p: ModalProps) => ReactElement | null> =
  {
    editor: LandingEditorModal,
    fomo: FomoModal,
    exitintent: ExitIntentModal,
    analytics: AnalyticsModal,
    pages: PagesModal,
    abtest: AbTestModal,
    email: EmailModal,
    webhook: WebhookModal,
    theme: ThemeModal,
    guide: GuideModal,
    leads: LeadsModal,
    webmaster: WebmasterModal,
    pixel: PixelModal,
    cron: CronModal,
    storage: StorageModal,
    seo: SeoModal,
    form: FormModal,
    ai: AiModal,
    salesadvice: SalesAdviceModal,
    contact: ContactModal,
    countdown: CountdownModal,
    adminlink: AdminLinkModal,
    utm: UtmModal,
  };

function getStorageStatus(config: {
  admin: {
    storageMode: "local" | "database";
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
}) {
  const cloudReady =
    config.admin.storageMode === "database" &&
    Boolean(config.admin.supabaseUrl) &&
    Boolean(config.admin.supabaseAnonKey);

  if (config.admin.storageMode === "local") {
    return {
      label: "Local only",
      detail: "Chỉ lưu trong trình duyệt",
      className: "bg-neutral-200 text-neutral-700",
    };
  }

  if (cloudReady) {
    return {
      label: "Local + Supabase",
      detail: "Lưu local và sync cloud",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Local fallback",
    detail: "Database mode nhưng thiếu Supabase",
    className: "bg-amber-100 text-amber-700",
  };
}

function SaveHint() {
  const { save, dirty, config } = useSiteConfig();
  const [message, setMessage] = useState<string | null>(null);
  const status = getStorageStatus(config);

  return (
    <div className="sticky bottom-0 -mx-4 mt-4 border-t border-neutral-200 bg-white px-4 pb-1 pt-3 dark:border-white/10 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[10px] dark:bg-white/5">
        <span
          className={`rounded-full px-2 py-1 font-bold uppercase tracking-wide ${status.className}`}
        >
          {status.label}
        </span>
        <span className="text-neutral-500">{status.detail}</span>
      </div>
      <button
        onClick={async () => {
          const saved = await save();
          if (!saved) {
            setMessage(
              "Chưa lưu được. Kiểm tra phiên đăng nhập Supabase và quyền admin_users trong Storage.",
            );
            return;
          }

          if (config.admin.storageMode === "local") {
            setMessage("Đã lưu local. Dữ liệu sẽ còn nguyên trên trình duyệt.");
            return;
          }

          if (config.admin.supabaseUrl && config.admin.supabaseAnonKey) {
            setMessage("Đã lưu local và đồng bộ lên Supabase.");
            return;
          }

          setMessage(
            "Đã lưu local, nhưng chưa có Supabase URL/key để đồng bộ cloud.",
          );
        }}
        className={`w-full rounded-lg py-2.5 text-sm font-bold ${
          dirty
            ? "bg-emerald-500 text-white"
            : "bg-neutral-200 text-neutral-500 dark:bg-white/10"
        }`}
      >
        {dirty ? "LƯU THAY ĐỔI" : "Đã lưu"}
      </button>
      {message && (
        <p className="mt-1 text-center text-[11px] font-semibold text-sky-700">
          {message}
        </p>
      )}
    </div>
  );
}
