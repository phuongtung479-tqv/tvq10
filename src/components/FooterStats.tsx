import { CalendarDays, Clock, MousePointerClick, Users } from "lucide-react";

import { useVisitorTrackingSnapshot } from "@/lib/visitor-tracking";

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function FooterStats({
  title = "Thống kê truy cập",
  helperText = "Dữ liệu truy cập được gom chung để đồng bộ giữa Analytics, CRM và webhook.",
}: {
  title?: string;
  helperText?: string;
}) {
  const snapshot = useVisitorTrackingSnapshot();

  const quickStats = [
    {
      icon: Users,
      label: "Hom nay",
      value: snapshot.metrics.sessionCounts.today.toLocaleString("vi-VN"),
    },
    {
      icon: CalendarDays,
      label: "Thang nay",
      value: snapshot.metrics.sessionCounts.month.toLocaleString("vi-VN"),
    },
    {
      icon: Clock,
      label: "Thoi gian",
      value: formatDuration(snapshot.metrics.timeOnPageSeconds),
    },
    {
      icon: MousePointerClick,
      label: "Cuon",
      value: `${Math.min(100, Math.max(0, snapshot.metrics.scrollDepthPercent))}%`,
    },
  ];

  const isLive = snapshot.initialized;

  return (
    <aside
      aria-label="Thong ke luu luong truy cap"
      className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {isLive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <h3 className="text-[11px] font-bold text-muted-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {quickStats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
              <stat.icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
              {stat.value}
            </p>
            <p className="text-[9px] leading-tight text-muted-foreground/60 sm:text-[8px]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground/50 sm:text-[9px]">
        {helperText}
      </p>
    </aside>
  );
}
