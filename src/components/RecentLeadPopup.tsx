import { useEffect, useMemo, useRef, useState } from "react";

import { useSiteConfig } from "@/lib/use-site-config";
import {
  LEAD_CREATED_EVENT,
  loadRecentLeadNotifications,
  loadLeads,
  type LeadRecord,
} from "@/services/dataAdapter";

function pick<T>(arr: T[], previous?: T): T | undefined {
  if (!arr.length) return undefined;
  if (arr.length === 1 || previous === undefined)
    return arr[Math.floor(Math.random() * arr.length)];
  const candidates = arr.filter((item) => item !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Thông báo "khách vừa đăng ký" trượt lên góc màn hình — dữ liệu & vị trí lấy từ Admin. */
export function RecentLeadPopup() {
  const { config } = useSiteConfig();
  const fomo = config.fomo;
  const [item, setItem] = useState<{
    name: string;
    city: string;
    mins: number;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [leadVersion, setLeadVersion] = useState(0);
  const previousNameRef = useRef<string | undefined>(undefined);
  const leadsRef = useRef<LeadRecord[]>([]);
  const fomoRef = useRef(fomo);
  const configRef = useRef(config);
  const immediateHideRef = useRef<number | undefined>(undefined);
  const hideRef = useRef<number | undefined>(undefined);

  fomoRef.current = fomo;
  configRef.current = config;

  const sampleItems = useMemo(
    () =>
      fomo.names.map((name, index) => ({
        name,
        city: fomo.cities[index % Math.max(1, fomo.cities.length)] || "",
        mins: 1 + (index % 9),
      })),
    [fomo.names, fomo.cities],
  );

  useEffect(() => {
    const refreshLeads = async () => {
      const localLeads = loadLeads();
      const cloudLeads = await loadRecentLeadNotifications(configRef.current);
      const merged = [...localLeads, ...cloudLeads].filter(
        (lead, index, all) => {
          const key = lead.id || `${lead.name}:${lead.at}`;
          return (
            all.findIndex(
              (candidate) =>
                (candidate.id || `${candidate.name}:${candidate.at}`) === key,
            ) === index
          );
        },
      );
      const recent = merged.filter((lead) => {
        const timestamp = new Date(lead.at).getTime();
        return (
          Number.isFinite(timestamp) &&
          Date.now() - timestamp < 24 * 60 * 60 * 1000
        );
      });
      leadsRef.current = recent;
      setLeadVersion((version) => version + 1);
    };
    const showNewLead = (event: Event) => {
      const detail = (event as CustomEvent<LeadRecord & { preview?: boolean }>)
        .detail;
      const lead = detail;
      const currentFomo = fomoRef.current;
      if ((!currentFomo.enabled && !detail?.preview) || !lead?.name) return;
      if (
        currentFomo.respectReducedMotion &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const timestamp = new Date(lead.at).getTime();
      const mins = Number.isFinite(timestamp)
        ? Math.max(1, Math.floor((Date.now() - timestamp) / 60000))
        : 1;
      window.clearTimeout(immediateHideRef.current);
      window.clearTimeout(hideRef.current);
      setItem({ name: lead.name, city: lead.city || "", mins });
      setDismissed(false);
      setVisible(true);
      immediateHideRef.current = window.setTimeout(
        () => setVisible(false),
        Math.min(30, Math.max(2, currentFomo.displaySec)) * 1000,
      );
    };
    refreshLeads();
    window.addEventListener(LEAD_CREATED_EVENT, refreshLeads);
    window.addEventListener(LEAD_CREATED_EVENT, showNewLead);
    window.addEventListener("funnel:fomo-preview", showNewLead);
    return () => {
      window.removeEventListener(LEAD_CREATED_EVENT, refreshLeads);
      window.removeEventListener(LEAD_CREATED_EVENT, showNewLead);
      window.removeEventListener("funnel:fomo-preview", showNewLead);
      window.clearTimeout(immediateHideRef.current);
    };
  }, []);

  useEffect(() => {
    setDismissed(false);
    setVisible(false);
    if (!fomo.enabled) return;
    if (fomo.source === "sample" && sampleItems.length === 0) return;
    if (fomo.source === "recentLeads" && leadsRef.current.length === 0) return;
    if (
      fomo.respectReducedMotion &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    let hideTimer: number | undefined;
    let nextTimer: number | undefined;
    let lastName = previousNameRef.current;

    const displayMs = Math.min(30, Math.max(2, fomo.displaySec)) * 1000;
    const minGap = Math.min(3600, Math.max(5, fomo.minDelaySec)) * 1000;
    const maxGap =
      Math.min(3600, Math.max(minGap / 1000, fomo.maxDelaySec)) * 1000;

    const show = () => {
      let next: { name: string; city: string; mins: number } | undefined;
      if (fomo.source === "recentLeads") {
        const actual = pick(
          leadsRef.current,
          leadsRef.current.find((lead) => lead.name === lastName),
        );
        if (!actual) return;
        next = {
          name: actual.name,
          city: actual.city || "",
          mins: Math.max(
            1,
            Math.floor((Date.now() - new Date(actual.at).getTime()) / 60000),
          ),
        };
      } else {
        const sample = pick(
          sampleItems,
          sampleItems.find((entry) => entry.name === lastName),
        );
        if (!sample) return;
        next = sample;
      }
      lastName = next.name;
      previousNameRef.current = lastName;
      setItem(next);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), displayMs);
      hideRef.current = hideTimer;
      const gap = minGap + Math.random() * (maxGap - minGap);
      nextTimer = window.setTimeout(show, displayMs + gap);
    };

    const first = window.setTimeout(show, minGap);
    return () => {
      window.clearTimeout(first);
      if (hideTimer) window.clearTimeout(hideTimer);
      if (nextTimer) window.clearTimeout(nextTimer);
      window.clearTimeout(hideRef.current);
    };
  }, [
    fomo.enabled,
    fomo.source,
    fomo.respectReducedMotion,
    fomo.displaySec,
    fomo.minDelaySec,
    fomo.maxDelaySec,
    sampleItems,
    leadVersion,
  ]);

  if (!fomo.enabled || !item || dismissed) return null;

  const message = fomo.template
    .replaceAll("{name}", item.name)
    .replaceAll("{city}", item.city)
    .replaceAll("{mins}", String(item.mins));

  const side =
    fomo.position === "right"
      ? "right-3 sm:right-6 left-auto"
      : "left-3 sm:left-6 right-auto";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-24 z-40 max-w-[17rem] rounded-2xl bg-card/90 p-3 shadow-[var(--shadow-card)] ring-1 ring-border backdrop-blur transition-all duration-500 sm:bottom-6 ${side} ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug text-card-foreground">{message}</p>
          <p className="mt-1 text-[11px] font-semibold text-primary">
            {item.mins} phút trước
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setVisible(false);
          }}
          aria-label="Đóng thông báo"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
