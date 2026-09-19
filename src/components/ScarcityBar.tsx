import { useEffect, useState } from "react";

import { useSiteConfig } from "@/lib/use-site-config";

const countdownTemplates = {
  classic: {
    shell: "bg-card text-card-foreground ring-border",
    badge: "bg-primary/10 text-primary",
    accent: "text-primary",
    cell: "bg-primary/10 text-primary",
  },
  premium: {
    shell: "bg-gradient-to-br from-amber-50 via-white to-orange-50 text-neutral-900 ring-amber-200",
    badge: "bg-amber-500 text-white",
    accent: "text-amber-600",
    cell: "bg-amber-100 text-amber-900",
  },
  urgent: {
    shell: "bg-gradient-to-br from-red-50 via-white to-rose-50 text-red-950 ring-red-200",
    badge: "bg-red-600 text-white",
    accent: "text-red-600",
    cell: "bg-red-100 text-red-700",
  },
  minimal: {
    shell: "bg-slate-950 text-slate-50 ring-slate-700",
    badge: "bg-white/10 text-white",
    accent: "text-amber-300",
    cell: "bg-white/5 text-slate-50",
  },
} as const;

function endOfMonth() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  ).getTime();
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Đếm ngược + số suất còn lại, lấy trực tiếp từ cấu hình Admin. */
export function ScarcityBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { config } = useSiteConfig();
  const c = config.countdown;
  const [left, setLeft] = useState<number | null>(null);

  const target =
    c.endMode === "fixed" && c.endDate
      ? new Date(c.endDate).getTime()
      : endOfMonth();
  const validTarget = Number.isFinite(target) ? target : endOfMonth();

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, validTarget - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [validTarget]);

  const d = left === null ? 0 : Math.floor(left / 86400000);
  const h = left === null ? 0 : Math.floor((left % 86400000) / 3600000);
  const m = left === null ? 0 : Math.floor((left % 3600000) / 60000);
  const s = left === null ? 0 : Math.floor((left % 60000) / 1000);

  const displaySlots = Math.max(0, c.slotsLeft);

  if (!c.enabled) return null;

  const templateKey = c.template || "classic";
  const selectedTemplate = countdownTemplates[templateKey] ?? countdownTemplates.classic;
  const dark = tone === "dark";
  const box = dark
    ? selectedTemplate.shell
    : selectedTemplate.shell;
  const accent = dark ? selectedTemplate.accent : selectedTemplate.accent;
  const cell = dark ? selectedTemplate.cell : selectedTemplate.cell;

  return (
    <div
      className={`rounded-2xl px-4 py-3 ring-1 ${box}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          Chỉ còn{" "}
          <span className={accent}>
            {displaySlots.toString().padStart(2, "0")} suất
          </span>{" "}
          {c.headline}
        </p>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${selectedTemplate.badge}`}>
          ưu tiên
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {[
          { v: d, l: "Ngày" },
          { v: h, l: "Giờ" },
          { v: m, l: "Phút" },
          { v: s, l: "Giây" },
        ].map((u) => (
          <div
            key={u.l}
            className={`min-w-[3.25rem] rounded-lg px-2 py-1.5 text-center ${cell}`}
          >
            <span
              className={`block text-lg font-black leading-none tabular-nums ${accent}`}
            >
              {left === null ? "--" : pad(u.v)}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {u.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
