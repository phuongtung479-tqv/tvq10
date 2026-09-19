import { useEffect, useState } from "react";

import { useSiteConfig } from "@/lib/use-site-config";
import { contactLinks } from "@/lib/contact-links";

/**
 * Thanh CTA cố định ở mép dưới, chỉ hiện trên mobile sau khi cuộn qua hero.
 * Số điện thoại / Zalo đọc trực tiếp từ cấu hình Admin.
 */
export function StickyMobileCTA() {
  const { config } = useSiteConfig();
  const links = contactLinks(config);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Cache the geometry threshold so the scroll handler never reads layout
    // (window.innerHeight on every scroll event forces reflow). Recompute
    // it only on resize.
    let threshold = window.innerHeight * 0.8;
    const onScroll = () => setShow(window.scrollY > threshold);
    const onResize = () => {
      threshold = window.innerHeight * 0.8;
      onScroll();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function toForm(e: React.MouseEvent) {
    e.preventDefault();
    const el =
      document.getElementById("dang-ky-cuoi") ??
      document.getElementById("dang-ky");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 py-2.5 backdrop-blur transition-transform duration-300 sm:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {links.enabled && links.hasZalo && (
          <a
            href={links.zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-gold py-3.5 text-center text-sm font-extrabold text-gold-foreground shadow-[var(--shadow-card)]"
          >
            Zalo Tư Vấn
          </a>
        )}
        <a
          href="#dang-ky-cuoi"
          onClick={toForm}
          className="flex-[1.3] rounded-xl bg-primary py-3.5 text-center text-sm font-extrabold uppercase text-primary-foreground shadow-[var(--shadow-cta)]"
        >
          Đăng Ký Ngay
        </a>
      </div>
    </div>
  );
}
