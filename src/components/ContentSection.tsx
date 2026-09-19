import type { SiteConfig } from "@/config/site-config";
import { ScarcityBar } from "@/components/ScarcityBar";
import { CalendarDays, Gift, Sparkles } from "lucide-react";

type ContentSectionData = SiteConfig["landing"]["sectionsArray"][number];

function safeHref(value: string | undefined, fallback = "#dang-ky") {
  const trimmed = value?.trim() || "";
  if (!trimmed) return fallback;
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function safeMediaUrl(value: string | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  if (trimmed.startsWith("/") || trimmed.startsWith("data:image/"))
    return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function ContentSection({ section }: { section: ContentSectionData }) {
  const variant = section.content?.variant || section.type;
  const videoUrl = safeMediaUrl(section.content?.buttonHref);
  const imageUrl = safeMediaUrl(section.content?.imageUrl);
  const youtubeId = videoUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/,
  )?.[1];
  const bodyLines =
    section.content?.body
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean) || [];
  const offerIntro = bodyLines[0] || "Đăng ký sớm để nhận chính sách hỗ trợ.";
  const offerValue = bodyLines.find((line) => line.includes("2.000.000"));
  const offerTerms = bodyLines.filter(
    (line) => line !== offerIntro && line !== offerValue,
  );

  return (
    <section
      style={{
        backgroundColor: section.content?.backgroundColor || undefined,
        color: section.content?.textColor || undefined,
      }}
      className={`mx-auto w-full max-w-6xl px-4 py-10 sm:py-14 ${
        variant === "testimonials" ? "border-l-4 border-gold bg-card" : ""
      } ${variant === "guarantee" ? "ring-1 ring-primary/20" : ""} ${
        variant === "offer"
          ? "mb-6 rounded-xl border border-gold/50 bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
          : ""
      }`}
    >
      {variant === "video" && youtubeId ? (
        <div className="mb-6 aspect-video overflow-hidden rounded-2xl bg-neutral-900">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={section.content?.heading || section.label}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        imageUrl && (
          <img
            src={safeMediaUrl(section.content.imageUrl)}
            alt=""
            className="mb-6 max-h-[20rem] w-full max-w-full rounded-2xl object-cover sm:max-h-[28rem]"
            loading="lazy"
          />
        )
      )}
      {variant === "offer" && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold">
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Cơ hội trong tháng
          </span>
          <span className="inline-flex items-center gap-1 text-primary-foreground/80">
            <CalendarDays className="h-3.5 w-3.5" /> Hạn 28/09/2026
          </span>
        </div>
      )}
      <h2
        style={{ color: section.content?.accentColor || undefined }}
        className={`mt-3 text-2xl font-extrabold sm:text-3xl ${
          variant === "offer" ? "text-primary-foreground" : ""
        }`}
      >
        {section.content?.heading || section.label}
      </h2>
      {variant === "faq" && section.content?.body ? (
        <details className="mt-4 rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-bold">
            {section.content.heading || section.label}
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {section.content.body}
          </p>
        </details>
      ) : variant === "offer" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-primary-foreground/90 sm:text-base">
              {offerIntro}
            </p>
            <div className="mt-4 flex items-start gap-3 border-l-2 border-gold pl-3 text-sm leading-relaxed text-primary-foreground/80">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div className="space-y-2">
                {offerTerms.map((term) => (
                  <p key={term}>{term}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="border border-gold/60 bg-gold px-5 py-5 text-center text-gold-foreground">
            <p className="text-xs font-bold uppercase tracking-wide">
              Ưu đãi dành riêng
            </p>
            <p className="mt-2 text-2xl font-black sm:text-3xl">
              {offerValue?.replace("🎁 ", "") || "2.000.000đ"}
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Đăng ký qua website trước hạn áp dụng
            </p>
          </div>
        </div>
      ) : variant === "pricing" || variant === "grid" ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {(bodyLines.length ? bodyLines : [section.content?.body || ""]).map(
            (line) => (
              <li
                key={line}
                className={`rounded-lg border p-3 text-sm leading-relaxed ${
                  variant === "offer"
                    ? "border-white/20 bg-white/10 text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                ✓ {line}
              </li>
            ),
          )}
        </ul>
      ) : (
        section.content?.body && (
          <p
            className={`mt-3 max-w-3xl whitespace-pre-line text-muted-foreground ${
              variant === "offer" ? "text-primary-foreground/90" : ""
            }`}
          >
            {section.content.body}
          </p>
        )
      )}
      {variant === "countdown" && (
        <div className="mt-6 max-w-xl">
          <ScarcityBar />
        </div>
      )}
      {section.content?.buttonLabel && (
        <a
          href={safeHref(section.content.buttonHref)}
          className={`mt-6 inline-flex w-full max-w-md items-center justify-center rounded-xl px-5 py-3 text-center font-bold sm:w-auto ${
            variant === "offer"
              ? "cta-pulse bg-gold text-gold-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {section.content.buttonLabel}
        </a>
      )}
    </section>
  );
}
