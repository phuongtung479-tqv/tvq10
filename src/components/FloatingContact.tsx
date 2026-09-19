import { MessageCircle, Phone } from "lucide-react";

import { useSiteConfig } from "@/lib/use-site-config";
import { contactLinks } from "@/lib/contact-links";

/** Cụm nút liên hệ nổi (Hotline / Zalo / Messenger) — đọc từ cấu hình Admin. */
export function FloatingContact() {
  const { config } = useSiteConfig();
  const links = contactLinks(config);

  if (!links.enabled) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 sm:bottom-6 sm:right-6">
      {links.messengerHref && (
        <a
          href={links.messengerHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nhắn tin Messenger"
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-[var(--shadow-card)] ring-1 ring-border transition hover:scale-105 ${
            config.floatingContact.animateMessenger !== false
              ? "contact-breathe"
              : ""
          }`}
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      )}
      {links.hasHotline && (
        <a
          href={links.hotlineHref}
          aria-label="Gọi hotline tư vấn"
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-cta)] transition hover:scale-105 ${
            config.floatingContact.animateHotline !== false
              ? "contact-breathe"
              : ""
          }`}
        >
          <Phone className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}
