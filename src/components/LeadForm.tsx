import { useRef, useState } from "react";
import { toast } from "sonner";
import { trackFormStart, trackLead } from "@/lib/tracking";
import {
  buildVisitorBehaviorPayload,
  joinParts,
  markCopyPaste,
  markFormStart,
  markIndustrySwitch,
  syncBehaviorSession,
} from "@/lib/behavior";
import { getVariant, utmSource } from "@/lib/ab";
import { getUtmPayload } from "@/lib/utm-hub";
import { UtmHiddenFields } from "@/components/UtmHiddenFields";
import { useSiteConfig } from "@/lib/use-site-config";
import { dispatchLead } from "@/services/webhooks";
import {
  isDuplicateLead,
  isDuplicateLeadRemote,
  saveLead,
  trackConversion,
  type LeadRecord,
} from "@/services/dataAdapter";
import { sendLeadEmail } from "@/lib/email.functions";

export const MAJORS = [
  "Công nghệ Ô tô điện",
  "Công nghệ Drone (UAV)",
  "Thương mại điện tử",
  "Logistics & Chuỗi cung ứng",
  "Kỹ thuật Điện tử",
  "IoT - Internet vạn vật",
  "Cơ khí tự động hóa",
  "Hán ngữ thương mại",
];

/** 63 tỉnh/thành Việt Nam gom theo vùng (dùng cho <optgroup>) */
const PROVINCE_GROUPS: { region: string; provinces: string[] }[] = [
  {
    region: "Miền Bắc",
    provinces: [
      "Hà Nội",
      "Hà Giang",
      "Cao Bằng",
      "Bắc Kạn",
      "Tuyên Quang",
      "Lào Cai",
      "Điện Biên",
      "Lai Châu",
      "Sơn La",
      "Yên Bái",
      "Hòa Bình",
      "Thái Nguyên",
      "Lạng Sơn",
      "Quảng Ninh",
      "Bắc Giang",
      "Phú Thọ",
      "Vĩnh Phúc",
      "Bắc Ninh",
      "Hải Dương",
      "Hải Phòng",
      "Hưng Yên",
      "Thái Bình",
      "Hà Nam",
      "Nam Định",
      "Ninh Bình",
    ],
  },
  {
    region: "Miền Trung & Tây Nguyên",
    provinces: [
      "Thanh Hóa",
      "Nghệ An",
      "Hà Tĩnh",
      "Quảng Bình",
      "Quảng Trị",
      "Thừa Thiên Huế",
      "Đà Nẵng",
      "Quảng Nam",
      "Quảng Ngãi",
      "Bình Định",
      "Phú Yên",
      "Khánh Hòa",
      "Ninh Thuận",
      "Bình Thuận",
      "Kon Tum",
      "Gia Lai",
      "Đắk Lắk",
      "Đắk Nông",
      "Lâm Đồng",
    ],
  },
  {
    region: "Miền Nam",
    provinces: [
      "Bình Phước",
      "Tây Ninh",
      "Bình Dương",
      "Đồng Nai",
      "Bà Rịa - Vũng Tàu",
      "TP. Hồ Chí Minh",
      "Long An",
      "Tiền Giang",
      "Bến Tre",
      "Trà Vinh",
      "Vĩnh Long",
      "Đồng Tháp",
      "An Giang",
      "Kiên Giang",
      "Cần Thơ",
      "Hậu Giang",
      "Sóc Trăng",
      "Bạc Liêu",
      "Cà Mau",
    ],
  },
];

const EMPTY = { name: "", phone: "", email: "", province: "", major: "" };

type Status = "idle" | "sending" | "done" | "error";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

/** Rate limiting: giới hạn số lần gửi trong 1 cửa sổ thời gian / trình duyệt (cấu hình trong Admin). */
let rateStamps: number[] = [];

function rateLimited(maxCount: number, windowMin: number): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const windowMs = Math.max(1, windowMin) * 60 * 1000;
  let stamps = rateStamps;
  stamps = stamps.filter((t) => now - t < windowMs);
  if (stamps.length >= Math.max(1, maxCount)) return true;
  stamps.push(now);
  rateStamps = stamps;
  return false;
}

export function LeadForm({ id = "dang-ky" }: { id?: string }) {
  const { config, decrementCountdown } = useSiteConfig();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const startedRef = useRef(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const field = (name: string, fallback: string) =>
    config.form.fields.find((item) => item.name === name)?.placeholder ||
    fallback;

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setMajor = (e: React.ChangeEvent<HTMLSelectElement>) => {
    markIndustrySwitch();
    setForm((f) => ({ ...f, major: e.target.value }));
  };

  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
    }));

  // Khách bắt đầu tương tác với ô input đầu tiên -> form_start
  const onFirstInteract = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    markFormStart();
    trackFormStart(config.tracking.events.formStart);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    // Anti-spam honeypot: bot điền trường ẩn -> giả vờ thành công, không gửi
    if (honeypotRef.current?.value) {
      setForm(EMPTY);
      setStatus("done");
      return;
    }

    const phone = form.phone.replace(/\D/g, "");
    if (!/^(03|05|07|08|09)\d{8}$/.test(phone)) {
      setError(
        "Số điện thoại không hợp lệ. Phải bắt đầu bằng 03, 05, 07, 08 hoặc 09 và đủ 10 số — ví dụ: 0912345678.",
      );
      setStatus("error");
      return;
    }
    const name = form.name.trim();
    if (name.length < 2 || !/^[\p{L}\s]+$/u.test(name)) {
      setError(
        "Họ và tên chỉ chứa chữ cái và dấu tiếng Việt, tối thiểu 2 ký tự.",
      );
      setStatus("error");
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Email chưa đúng định dạng — ví dụ: ten@gmail.com.");
      setStatus("error");
      return;
    }

    if (isDuplicateLead(phone)) {
      setError(
        "Số điện thoại này vừa được đăng ký. Tư vấn viên sẽ liên hệ với bạn sớm nhất.",
      );
      setStatus("error");
      return;
    }

    if (await isDuplicateLeadRemote(phone, config)) {
      setError(
        "Số điện thoại này vừa được đăng ký. Tư vấn viên sẽ liên hệ với bạn sớm nhất.",
      );
      setStatus("error");
      return;
    }

    if (
      rateLimited(config.form.rateLimitCount, config.form.rateLimitWindowMin)
    ) {
      setError(
        "Bạn đã gửi nhiều lần trong thời gian ngắn. Vui lòng chờ vài phút rồi thử lại.",
      );
      setStatus("error");
      return;
    }

    setError("");
    setStatus("sending");

    let leadSaved = false;
    try {
      const variant = getVariant(config.abTest.enabled, config.abTest.split);
      syncBehaviorSession({
        storageMode: config.admin.storageMode,
        supabaseUrl: config.admin.supabaseUrl,
        supabaseAnonKey: config.admin.supabaseAnonKey,
        variant,
      });
      const sessionSource = utmSource();
      // Hub UTM: dữ liệu attribution sạch, luôn an toàn (không throw)
      const utmData = getUtmPayload("last");
      const trackedSource = utmData["utm_source"] || sessionSource || "direct";
      const { behavior, assessment, visitorBehaviorPayload } =
        buildVisitorBehaviorPayload(
          {
            city: form.province,
            major: form.major,
          },
          config.aiAdvisor,
          sessionSource,
          config.salesAdvice,
        );
      const { score: aiScore, rank: aiRank } = assessment;
      const source = trackedSource;

      const payload = {
        full_name: name.slice(0, 100),
        phone,
        email: email.slice(0, 255),
        major: form.major,
        city: form.province,
        landing_url:
          typeof window !== "undefined"
            ? window.location.href
            : "Landing Page UTM",
        source,
        created_at: visitorBehaviorPayload.submittedAt,
        ab_variant: variant,
        ai_score: aiScore,
        ai_rank: aiRank,
        risk_level: assessment.riskLevel,
        risk_reasons: assessment.reasons,
        recommended_action: assessment.recommendedAction,
        utm_source: source,
        utm_medium: utmData["utm_medium"] || behavior.utm_medium,
        utm_campaign: utmData["utm_campaign"] || behavior.utm_campaign,
        utm_content: utmData["utm_content"] || behavior.utm_content,
        utm_term: behavior.utm_term || utmData["utm_term"] || "",
        ttclid: behavior.ttclid || utmData["ttclid"] || "",
        fbclid: utmData["fbclid"] || "",
        gclid: utmData["gclid"] || "",
        referrer: utmData["referrer"] || "",
        attribution_model: utmData["attribution_model"] || "last",
        attribution_detected_by: utmData["attribution_detected_by"] || "",
        raw_query: utmData["raw_query"] || "",
        utm_params: utmData,
        visits_today: behavior.visits_today,
        visits_month: behavior.visits_month,
        current_session: behavior.current_session,
        device_manufacturer: behavior.device_manufacturer,
        device_family: behavior.device_family,
        device_model_name: behavior.device_model_name,
        operating_system: joinParts([
          behavior.operating_system,
          behavior.operating_system_version,
        ]),
        browser: joinParts([behavior.browser, behavior.browser_version]),
        network_provider: behavior.network_provider,
        network_label: behavior.network_label,
        sale_advice: visitorBehaviorPayload.saleAdvice,
        behavior_summary: visitorBehaviorPayload.behaviorSummary,
        device_tech_info: visitorBehaviorPayload.deviceTechInfo,
        traffic_ads_source: visitorBehaviorPayload.trafficAdsSource,
      };

      // Lưu Mini-CRM (localStorage / Supabase) để hiện trong bảng Quản Lý Lead.
      const leadRecord: LeadRecord = {
        id: `ld_${Date.now()}`,
        at: payload.created_at,
        name: payload.full_name,
        phone: payload.phone,
        email: payload.email || undefined,
        city: payload.city || undefined,
        major: payload.major || undefined,
        aiScore,
        aiRank,
        riskLevel: assessment.riskLevel,
        riskReasons: assessment.reasons,
        recommendedAction: assessment.recommendedAction,
        behaviorSummary: payload.behavior_summary,
        saleAdvice: payload.sale_advice,
        deviceTechInfo: payload.device_tech_info,
        trafficAdsSource: payload.traffic_ads_source,
        networkProvider: payload.network_provider || undefined,
        networkLabel: payload.network_label || undefined,
        visitsToday: payload.visits_today,
        visitsMonth: payload.visits_month,
        currentSession: payload.current_session,
        visitorBehaviorPayload,
        utmSource: source,
        utmMedium: payload.utm_medium,
        utmCampaign: payload.utm_campaign,
        utmContent: payload.utm_content,
        utmTerm: payload.utm_term,
        fbclid: payload.fbclid,
        ttclid: payload.ttclid,
        gclid: payload.gclid,
        rawQuery: utmData["raw_query"],
        referrer: payload.referrer,
        attributionModel: payload.attribution_model,
        attributionDetectedBy: payload.attribution_detected_by,
        utmParams: Object.fromEntries(
          Object.entries(utmData).filter(
            ([key]) =>
              ![
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_content",
                "utm_term",
                "raw_query",
                "landing_url",
                "referrer",
                "attribution_model",
                "attribution_detected_by",
              ].includes(key),
          ),
        ),
        variant,
        landing_url: payload.landing_url,
        deviceManufacturer: payload.device_manufacturer,
        deviceFamily: payload.device_family,
        deviceModel: payload.device_model_name,
        operatingSystem: payload.operating_system,
        browser: payload.browser,
      };
      // Lưu local và gửi các kênh từ xa song song; một request cross-origin bị
      // chặn trong in-app browser không được giữ các kênh còn lại lại.
      const savePromise = saveLead(leadRecord, config).then((saved) => {
        leadSaved = true;
        return saved;
      });
      const [savedLead, delivery] = await Promise.all([
        savePromise,
        dispatchLead(config, payload),
      ]);
      if (
        config.admin.storageMode === "database" &&
        savedLead.storage !== "database"
      ) {
        console.warn(
          "Database mode fallback to local storage: Supabase cloud sync unavailable; lead was still saved locally.",
        );
      }
      if (!delivery.ok) {
        const failed = delivery.results
          .filter((result) => !result.ok)
          .map((result) => result.label)
          .join(", ");
        console.warn(
          `Webhook delivery degraded (${delivery.failedCount ?? 0}/${delivery.results.length || 0}): ${failed || "unknown"}`,
        );
      } else if (delivery.failedCount && delivery.failedCount > 0) {
        const failed = delivery.results
          .filter((result) => !result.ok)
          .map((result) => result.label)
          .join(", ");
        console.warn(
          `Webhook partial failure (${delivery.failedCount}/${delivery.results.length}): ${failed}`,
        );
      }
      const countdownSaved = await decrementCountdown(savedLead.id);
      if (!countdownSaved) {
        toast.warning("Lead đã lưu, nhưng chưa cập nhật được số suất.", {
          description:
            "Kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trên server rồi redeploy.",
        });
      }

      // Ghi nhận chuyển đổi cho Analytics Dashboard + A/B comparison.
      trackConversion(source, config.abTest.enabled ? variant : undefined);

      // Automated Email Sequencer (auto-responder) — chạy phía server nếu bật.
      // Toàn bộ khối này không được phép làm hỏng luồng submit chính: lỗi cấu
      // hình email (vd. thiếu/sai From) chỉ nên cảnh báo, không throw ra ngoài.
      try {
      if (config.emailAutomation.enabled) {
        type EmailTaskResult = { sent: boolean; reason?: string; detail?: string };
        const safeSendLeadEmail = (
          args: Parameters<typeof sendLeadEmail>[0],
        ): Promise<EmailTaskResult> =>
          sendLeadEmail(args).catch((err) => ({
            sent: false,
            reason: "unexpected_error",
            detail: err instanceof Error ? err.message : String(err),
          }));
        const emailTasks: Promise<EmailTaskResult>[] = [];
        const fill = (s: string) =>
          s
            .replaceAll("{name}", payload.full_name)
            .replaceAll("{phone}", payload.phone)
            .replaceAll("{city}", payload.city || "")
            .replaceAll("{major}", form.major || "")
            .replaceAll("{source}", source || "direct")
            .replaceAll("{ai_score}", String(aiScore))
            .replaceAll("{timestamp}", new Date().toLocaleString("vi-VN"));
        const brandName =
          config.emailAutomation.brandName?.trim() ||
          config.emailAutomation.headerText?.trim() ||
          "Funnel Builder";
        const brandLogo = config.emailAutomation.brandLogoUrl?.trim();
        const ctaLabel =
          config.emailAutomation.ctaLabel?.trim() || "Nhận tư vấn ngay";
        const ctaUrl = config.emailAutomation.ctaUrl?.trim() || "#dang-ky";
        const htmlBody = (s: string) => {
          const bodyHtml = s
            .replaceAll("\n", "<br />")
            .replaceAll("{name}", `<strong>${payload.full_name}</strong>`)
            .replaceAll("{phone}", `<strong>${payload.phone}</strong>`)
            .replaceAll("{city}", payload.city || "—")
            .replaceAll("{major}", form.major || "—")
            .replaceAll("{source}", source || "direct")
            .replaceAll("{ai_score}", String(aiScore))
            .replaceAll("{timestamp}", new Date().toLocaleString("vi-VN"));
          const brandMarkup = brandLogo
            ? `<img src="${brandLogo}" alt="${brandName}" style="display:block;width:52px;height:52px;border-radius:14px;object-fit:cover;border:1px solid rgba(148,163,184,0.35);background:#fff;" />`
            : `<div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#475569;font-weight:700;">${brandName}</div>`;
          return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;color:#0f172a;line-height:1.7"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;margin-bottom:16px;">${brandMarkup}<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">${brandName}</div></div>${bodyHtml}<div style="margin-top:18px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;"><a href="${ctaUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">${ctaLabel}</a></div></div>`;
        };
        const parseSalesList = (value: string) =>
          value
            .split(/[;,\n]/)
            .map((item) => item.trim())
            .filter(Boolean);

        const chooseSalesRecipient = () => {
          const saleList = parseSalesList(
            config.emailAutomation.notifyEmail || config.emailAutomation.salesEmailList.join(","),
          );
          const weighted = Object.fromEntries(
            Object.entries(config.emailAutomation.salesDistributionWeights || {}).filter(
              ([key, val]) => Boolean(key) && Number(val) > 0,
            ),
          );
          const accumulate = (entries: [string, number][]) => {
            let total = entries.reduce((sum, [, weight]) => sum + Number(weight || 0), 0);
            if (!total) return entries[0]?.[0] || "";
            let pointer = Math.random() * total;
            for (const [email, weight] of entries) {
              pointer -= Number(weight || 0);
              if (pointer <= 0) return email;
            }
            return entries[entries.length - 1]?.[0] || "";
          };

          if (config.emailAutomation.salesEmailList.length > 0) {
            const recipients = config.emailAutomation.salesEmailList
              .map((item) => item.trim())
              .filter(Boolean);
            if (recipients.length === 0) return "";
            if (config.emailAutomation.salesDistributionMode === "weighted_percent") {
              const entries = recipients.map((email) => [email, Number(weighted[email] || 100 / recipients.length)] as [string, number]);
              return accumulate(entries);
            }
            if (config.emailAutomation.salesDistributionMode === "random") {
              return recipients[Math.floor(Math.random() * recipients.length)] || "";
            }
            const today = new Date();
            const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            const roundRobinSeed = Number.parseInt(`${dayKey.split("-").join("")}`, 10) || 0;
            const selectIndex = roundRobinSeed % recipients.length;
            return recipients[selectIndex] || "";
          }

          if (saleList.length === 0) return "";
          if (config.emailAutomation.salesDistributionMode === "weighted_percent") {
            const entries = saleList.map((email) => [email, Number(weighted[email] || 100 / saleList.length)] as [string, number]);
            return accumulate(entries);
          }
          if (config.emailAutomation.salesDistributionMode === "random") {
            return saleList[Math.floor(Math.random() * saleList.length)] || "";
          }
          const today = new Date();
          const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
          const roundRobinSeed = Number.parseInt(`${dayKey.split("-").join("")}`, 10) || 0;
          const selectIndex = roundRobinSeed % saleList.length;
          return saleList[selectIndex] || "";
        };

        const selectedSaleRecipient = chooseSalesRecipient();
        const directNotify = config.emailAutomation.notifyEmail.trim();
        const saleRecipients = parseSalesList(
          config.emailAutomation.salesEmailList.join(",") || directNotify,
        );

        // Email cảm ơn gửi tới khách (nếu khách cung cấp email)
        if (email) {
          emailTasks.push(
            safeSendLeadEmail({
              data: {
                provider: config.emailAutomation.provider,
                to: email,
                from: config.emailAutomation.fromEmail,
                subject: fill(config.emailAutomation.subject),
                text: fill(config.emailAutomation.body),
                html: htmlBody(config.emailAutomation.body),
                resendApiKey: config.emailAutomation.resendApiKey,
                gmailClientId: config.emailAutomation.gmailClientId,
                gmailClientSecret: config.emailAutomation.gmailClientSecret,
                gmailRefreshToken: config.emailAutomation.gmailRefreshToken,
              },
            }),
          );
        }

        if (selectedSaleRecipient) {
          emailTasks.push(
            safeSendLeadEmail({
              data: {
                provider: config.emailAutomation.provider,
                to: selectedSaleRecipient,
                from: config.emailAutomation.fromEmail,
                subject: fill(config.emailAutomation.notifySubject),
                text: fill(config.emailAutomation.notifyBody),
                html: htmlBody(config.emailAutomation.notifyBody),
                resendApiKey: config.emailAutomation.resendApiKey,
                gmailClientId: config.emailAutomation.gmailClientId,
                gmailClientSecret: config.emailAutomation.gmailClientSecret,
                gmailRefreshToken: config.emailAutomation.gmailRefreshToken,
              },
            }),
          );
          if (config.emailAutomation.salesSendWebhook) {
            void dispatchLead(config, {
              ...payload,
              event: "sale_assignment_email",
              sales_email_to: selectedSaleRecipient,
              notify_email_type: config.emailAutomation.salesDistributionMode,
              notify_email_template: config.emailAutomation.notifySubject,
              assigned_sale_timestamp: new Date().toISOString(),
            });
          }
        } else if (directNotify) {
          emailTasks.push(
            safeSendLeadEmail({
              data: {
                provider: config.emailAutomation.provider,
                to: directNotify,
                from: config.emailAutomation.fromEmail,
                subject: fill(config.emailAutomation.notifySubject),
                text: fill(config.emailAutomation.notifyBody),
                html: htmlBody(config.emailAutomation.notifyBody),
                resendApiKey: config.emailAutomation.resendApiKey,
                gmailClientId: config.emailAutomation.gmailClientId,
                gmailClientSecret: config.emailAutomation.gmailClientSecret,
                gmailRefreshToken: config.emailAutomation.gmailRefreshToken,
              },
            }),
          );
          if (config.emailAutomation.salesSendWebhook && directNotify) {
            void dispatchLead(config, {
              ...payload,
              event: "sale_assignment_email",
              sales_email_to: directNotify,
              notify_email_type: config.emailAutomation.salesDistributionMode,
              notify_email_template: config.emailAutomation.notifySubject,
              assigned_sale_timestamp: new Date().toISOString(),
            });
          }
        }

        if (saleRecipients.length > 0 && selectedSaleRecipient && config.emailAutomation.salesSendWebhook) {
          void dispatchLead(config, {
            ...payload,
            event: "sale_assignment_email_total",
            sales_email_recipients: saleRecipients,
            selected_sales_email: selectedSaleRecipient,
            sales_distribution_mode: config.emailAutomation.salesDistributionMode,
            sales_distribution_weights: config.emailAutomation.salesDistributionWeights,
          });
        }

        const emailResults = await Promise.all(emailTasks);
        const failedEmail = emailResults.find((result) => !result.sent);
        if (failedEmail) {
          console.warn("Automated email failed:", failedEmail);
          toast.warning("Lead đã lưu, nhưng email chưa gửi được.", {
            description:
              failedEmail.detail ||
              `Kiểm tra cấu hình Resend (${failedEmail.reason || "provider_error"}).`,
          });
        }
      }
      } catch (emailErr) {
        console.warn("Automated email step crashed, submit still succeeds:", emailErr);
        toast.warning("Lead đã lưu, nhưng email chưa gửi được.", {
          description: "Kiểm tra cấu hình email tự động trong Admin.",
        });
      }

      // Chỉ bắn tracking SAU khi dữ liệu đã gửi thành công
      trackLead(
        { content_name: form.major || "Du hoc nghe Trung Quoc" },
        config.tracking.events,
        config.tracking.ga4Id,
      );
      setForm(EMPTY);
      setStatus("done");
      toast.success("Đăng ký thành công!", {
        description: "Tư vấn viên sẽ liên hệ lại trong 5 phút.",
      });
      // Redirect (Thank You Page) nếu Admin cấu hình.
      const redirect = config.form.redirectUrl?.trim();
      if (redirect && typeof window !== "undefined")
        window.location.assign(redirect);
      else {
        const thankYou = config.pages.find(
          (page) => page.enabled && page.kind === "thankYou",
        );
        if (thankYou && typeof window !== "undefined")
          window.location.assign(`/${thankYou.path}`);
      }
    } catch (err) {
      console.error("Lead submit failed:", err);
      if (!leadSaved) {
        const fallbackPayload = {
          full_name: name.slice(0, 100),
          phone,
          email: email.slice(0, 255),
          city: form.province,
          major: form.major,
          source: "direct",
          landing_url:
            typeof window !== "undefined" ? window.location.href : "",
          created_at: new Date().toISOString(),
        };
        try {
          await Promise.all([
            saveLead(
              {
                id: `ld_${Date.now()}`,
                at: fallbackPayload.created_at,
                name: fallbackPayload.full_name,
                phone: fallbackPayload.phone,
                email: fallbackPayload.email || undefined,
                city: fallbackPayload.city || undefined,
                major: fallbackPayload.major || undefined,
                utmSource: "direct",
                landing_url: fallbackPayload.landing_url,
              },
              config,
            ),
            dispatchLead(config, fallbackPayload),
          ]);
        } catch (fallbackError) {
          console.error("Fallback lead delivery failed:", fallbackError);
        }
      }
      setError(
        "Có lỗi khi gửi thông tin. Vui lòng kiểm tra kết nối v�� thử gửi lại.",
      );
      setStatus("error");
      toast.error("Gửi chưa thành công", {
        description: "Vui lòng thử lại sau vài giây.",
      });
    }
  }

  if (status === "done") {
    return (
      <div
        id={id}
        className="rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-border"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl font-bold text-gold-foreground">
          ✓
        </div>
        <h3 className="mt-4 text-2xl font-extrabold">Đăng ký thành công!</h3>
        <p className="mt-2 text-muted-foreground">
          Tư vấn viên sẽ liên hệ lại với bạn trong 5 phút. Vui lòng để ý điện
          thoại (cuộc gọi hoặc Zalo).
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-sm font-bold text-primary underline underline-offset-4"
        >
          Gửi thêm một đăng ký khác
        </button>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-border sm:p-8"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        Miễn phí 100%
      </p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
        {config.form.headline || "Nhận lộ trình du học nghề 0Đ"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Chỉ 30 giây. Chúng tôi gọi lại tư vấn 1:1, không thu bất kỳ khoản phí
        nào.
      </p>

      <div className="mt-5 space-y-3">
        {/* Honeypot ẩn chống bot — người thật không nhìn thấy */}
        <input
          ref={honeypotRef}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        {/* Hub UTM Catch-All: nhét TOÀN BỘ tham số thu gom được vào các
            <input type="hidden"> để nếu form submit theo kiểu HTML POST truyền
            thống (kể cả khi bị in-app browser chặn JS), backend vẫn nhận đủ
            100% "vết tích" của đường link. */}
        <UtmHiddenFields model="last" />
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={set("name")}
          onFocus={onFirstInteract}
          placeholder={field("name", "Họ và tên")}
          className={inputClass}
        />
        <input
          required
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={form.phone}
          onChange={setPhone}
          onFocus={onFirstInteract}
          onPaste={() => markCopyPaste("sdt")}
          placeholder={field("phone", "Số điện thoại (Zalo) — 10 số")}
          className={inputClass}
        />
        <input
          type="email"
          maxLength={255}
          value={form.email}
          onChange={set("email")}
          onFocus={onFirstInteract}
          placeholder={field("email", "Email (không bắt buộc)")}
          className={inputClass}
        />
        <select
          required
          aria-label={field("city", "Tỉnh/Thành phố")}
          value={form.province}
          onChange={set("province")}
          className={inputClass}
        >
          <option value="">{field("city", "Tỉnh/Thành phố")}</option>
          {PROVINCE_GROUPS.map((g) => (
            <optgroup key={g.region} label={g.region}>
              {g.provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          required
          aria-label={field("major", "Ngành quan tâm")}
          value={form.major}
          onChange={setMajor}
          className={inputClass}
        >
          <option value="">{field("major", "Ngành quan tâm")}</option>
          {MAJORS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {status === "error" && error && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending"}
        className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-4 text-base font-extrabold uppercase tracking-wide text-primary-foreground shadow-[var(--shadow-cta)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
      >
        {status === "sending" && (
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
          />
        )}
        {status === "sending"
          ? "Đang gửi..."
          : config.form.ctaLabel || "Gửi đăng ký — Nhận lộ trình 0Đ"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Thông tin của bạn được bảo mật, chỉ dùng để tư vấn hướng nghiệp.
      </p>
    </form>
  );
}
