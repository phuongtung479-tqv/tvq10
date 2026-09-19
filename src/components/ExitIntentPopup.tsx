import { useEffect, useMemo, useRef, useState } from "react";

import { useSiteConfig } from "@/lib/use-site-config";

const EXIT_INTENT_SHOWN_KEY = "funnel_exit_intent_shown_v1";

export const templateMap = {
  offer: {
    badge: "Ưu đãi đặc biệt",
    title: "Nhận tư vấn miễn phí + lộ trình học phù hợp",
    description:
      "Bạn đang quan tâm đến chương trình du học nghề. Nhận ngay lộ trình học, danh sách ngành hot, và ưu đãi học bổng phù hợp với mục tiêu của bạn.",
    cta: "Nhận tư vấn ngay",
  },
  urgency: {
    badge: "Sắp hết suất",
    title: "Còn ít suất ưu tiên cho học bổng và tư vấn 1:1",
    description:
      "Chúng tôi đang ưu tiên xét duyệt cho khách quan tâm trong 24h tới. Đăng ký ngay để nhận lịch tư vấn riêng và ưu đãi phù hợp.",
    cta: "Đăng ký nhận ưu đãi",
  },
  trust: {
    badge: "Bảo mật thông tin",
    title: "Tư vấn miễn phí, không ép mua, không lo rủi ro",
    description:
      "Hình thức tư vấn trực tiếp qua chuyên viên, rõ ràng, minh bạch và phù hợp với từng nhu cầu của học viên và gia đình.",
    cta: "Nhận tư vấn 1:1",
  },
  premium: {
    badge: "Chương trình premium",
    title: "Được tư vấn theo lộ trình cá nhân và hỗ trợ 1:1",
    description:
      "Bạn đang ở giai đoạn muốn chọn đúng ngành, thời điểm và chiến lược học tối ưu nhất để tối đa hóa cơ hội việc làm sau tốt nghiệp.",
    cta: "Ưu tiên đăng ký ngay",
  },
  limited: {
    badge: "Chỉ còn vài suất",
    title: "Học bổng và tư vấn ưu tiên đang chốt nhanh",
    description:
      "Cơ hội nhận tư vấn chuyên sâu, hỗ trợ hồ sơ và gợi ý ngành phù hợp đang có giới hạn theo từng đợt tuyển sinh.",
    cta: "Đặt lịch tư vấn",
  },
} as const;

export function getExitIntentTemplate(config: {
  templateId?: keyof typeof templateMap;
  badge?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
}) {
  const selected = templateMap[config.templateId ?? "offer"] ?? templateMap.offer;
  return {
    badge: config.badge || selected.badge,
    title: config.title || selected.title,
    description: config.description || selected.description,
    cta: config.ctaLabel || selected.cta,
  };
}

export function ExitIntentPopup() {
  const { config } = useSiteConfig();
  const exitIntent = config.exitIntent;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const launcherRef = useRef(false);
  const startTimeRef = useRef<number>(performance.now());
  const hasImage = Boolean(exitIntent.showImage && exitIntent.imageUrl);
  const imageOnLeft = exitIntent.imagePosition !== "right";

  const template = useMemo(() => getExitIntentTemplate(exitIntent), [exitIntent]);

  useEffect(() => {
    if (!exitIntent.enabled) {
      setVisible(false);
      setDismissed(false);
      launcherRef.current = false;
      return;
    }

    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(EXIT_INTENT_SHOWN_KEY) === "1") {
      setDismissed(true);
      return;
    }

    if (
      exitIntent.respectReducedMotion &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const triggerDelayMs = Math.max(0, exitIntent.triggerDelaySec * 1000);
    const minimumTimeMs = Math.max(0, exitIntent.minTimeOnPageSec * 1000);
    const minimumScroll = Math.max(0, Math.min(100, exitIntent.minScrollPercent));

    // Cache scroll geometry; recompute on resize instead of reading layout
    // (scrollHeight/innerHeight) on every scroll, which forces reflow.
    let cachedMaxScroll =
      document.documentElement.scrollHeight - window.innerHeight || 1;
    const recomputeMaxScroll = () => {
      cachedMaxScroll =
        document.documentElement.scrollHeight - window.innerHeight || 1;
    };
    const getScrollPercent = () => {
      return Math.min(100, (window.scrollY / cachedMaxScroll) * 100);
    };

    const show = (reason: "timeout" | "leave" | "scroll") => {
      if (launcherRef.current || dismissed) return;
      const elapsed = performance.now() - startTimeRef.current;
      const currentScroll = getScrollPercent();
      const shouldWaitForScroll = currentScroll < minimumScroll;
      const allowedOnMobile = exitIntent.allowMobile || window.innerWidth >= 768;
      const enoughTime = elapsed >= minimumTimeMs;
      const shouldShowByTime = elapsed >= triggerDelayMs;

      if (!allowedOnMobile || !enoughTime || shouldWaitForScroll) {
        if (reason === "leave" && elapsed >= triggerDelayMs) {
          setVisible(true);
        }
        return;
      }

      if (reason === "timeout" || reason === "leave" || reason === "scroll") {
        if (shouldShowByTime || reason === "leave") {
          launcherRef.current = true;
          window.sessionStorage.setItem(EXIT_INTENT_SHOWN_KEY, "1");
          setVisible(true);
        }
      }
    };

    const timer = window.setTimeout(() => show("timeout"), triggerDelayMs || 1500);
    const fallbackTimer = window.setTimeout(() => {
      if (launcherRef.current || dismissed) return;
      const allowedOnMobile = exitIntent.allowMobile || window.innerWidth >= 768;
      if (!allowedOnMobile) return;
      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed < Math.max(minimumTimeMs, 1500)) return;
      launcherRef.current = true;
      window.sessionStorage.setItem(EXIT_INTENT_SHOWN_KEY, "1");
      setVisible(true);
    }, Math.max(triggerDelayMs, minimumTimeMs, 1500));

    const onMouseLeave = (event: MouseEvent) => {
      const isLeavingViewport =
        event.clientY <= 0 ||
        event.relatedTarget === null ||
        (event.target === document && !event.relatedTarget);
      if (isLeavingViewport) show("leave");
    };
    const onScroll = () => {
      const currentScroll = getScrollPercent();
      if (currentScroll >= minimumScroll) show("scroll");
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseout", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseout", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [dismissed, exitIntent]);

  const positionClass =
    exitIntent.position === "bottom-left"
      ? "left-3 bottom-4 sm:left-6"
      : exitIntent.position === "bottom-right"
        ? "right-3 bottom-4 sm:right-6"
        : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

  if (!exitIntent.enabled || !visible || dismissed) return null;

  return (
    <>
      <style>{`
        @keyframes exitIntentRise {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        className={`fixed z-50 w-[min(92vw,34rem)] ${positionClass}`}
        role="dialog"
        aria-modal="false"
        aria-live="polite"
      >
        <div
          className="overflow-hidden rounded-[1.8rem] border border-white/15 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_35%),_rgba(15,23,42,0.96)] shadow-[0_30px_90px_rgba(15,23,42,0.42)] backdrop-blur-xl"
          style={{ animation: "exitIntentRise 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
        >
          <div className="bg-gradient-to-r from-primary via-amber-500 to-[#f59e0b] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white">
            {template.badge}
          </div>

          <div className={hasImage ? "grid md:grid-cols-[1fr_1.2fr]" : "grid grid-cols-1"}>
            {hasImage && imageOnLeft && (
              <div className="relative min-h-[220px] overflow-hidden border-b border-white/10 md:border-b-0 md:border-r md:border-white/10">
                <img
                  src={exitIntent.imageUrl}
                  alt={exitIntent.imageAlt || template.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/30 via-transparent to-transparent" />
              </div>
            )}

            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black leading-tight text-white sm:text-xl">
                    {template.title}
                  </h3>
                </div>
                {exitIntent.showCloseButton && (
                  <button
                    type="button"
                    aria-label="Đóng popup"
                    onClick={() => setDismissed(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
              <p className="text-sm leading-relaxed text-slate-200/90">
                {template.description}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a
                  href="#dang-ky"
                  onClick={() => setDismissed(true)}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-3 text-sm font-black text-primary-foreground shadow-[0_14px_30px_rgba(251,191,36,0.35)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
                >
                  {template.cta}
                </a>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Để sau
                </button>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-300/80">
                Tư vấn 1:1 · Miễn phí · Không bắt buộc mua
              </p>
            </div>

            {hasImage && !imageOnLeft && (
              <div className="relative min-h-[220px] overflow-hidden border-t border-white/10 md:border-l md:border-t-0 md:border-white/10">
                <img
                  src={exitIntent.imageUrl}
                  alt={exitIntent.imageAlt || template.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-slate-950/30 via-transparent to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
