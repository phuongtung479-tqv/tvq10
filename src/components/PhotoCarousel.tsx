import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type Slide = { img: string; caption: string };

/** Carousel anh thuc te, tu chay muot, co nut chuyen, cham die huong va Lightbox phong to. */
export function PhotoCarousel({
  slides,
  interval = 4000,
}: {
  slides: Slide[];
  interval?: number;
}) {
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!paused.current) setI((p) => (p + 1) % slides.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [slides.length, interval]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft")
        setI((p) => (p - 1 + slides.length) % slides.length);
      if (e.key === "ArrowRight") setI((p) => (p + 1) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, slides.length]);

  return (
    <>
      <div
        className="overflow-hidden rounded-2xl bg-card ring-1 ring-border"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)}
        onTouchEnd={() => (paused.current = false)}
        aria-roledescription="carousel"
      >
        <div className="relative">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${i * 100}%)` }}
          >
            {slides.map((s, idx) => (
              <figure key={s.img} className="w-full shrink-0">
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="group relative block w-full"
                  aria-label={`Phong to anh: ${s.caption}`}
                >
                  <img
                    src={s.img}
                    alt={s.caption}
                    width={1280}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[16/10] w-full max-w-full cursor-zoom-in object-cover transition group-hover:brightness-95"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-background/80 px-2 py-1 text-[10px] font-bold text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100">
                    Bam de phong to
                  </span>
                </button>
                <figcaption className="px-4 py-3 text-center text-sm font-semibold text-card-foreground/85">
                  {idx + 1}/{slides.length} — {s.caption}
                </figcaption>
              </figure>
            ))}
          </div>

          <button
            type="button"
            aria-label="Anh truoc"
            onClick={() => setI((p) => (p - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-lg font-bold backdrop-blur sm:h-10 sm:w-10"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Anh tiep theo"
            onClick={() => setI((p) => (p + 1) % slides.length)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-lg font-bold backdrop-blur sm:h-10 sm:w-10"
          >
            ›
          </button>
        </div>

        <div className="flex justify-center gap-2 pb-4">
          {slides.map((s, idx) => (
            <button
              key={s.img}
              type="button"
              aria-label={`Xem anh ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Phong to anh"
        >
          <button
            type="button"
            aria-label="Dong"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Anh truoc"
            onClick={(e) => {
              e.stopPropagation();
              setI((p) => (p - 1 + slides.length) % slides.length);
            }}
            className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white transition hover:bg-white/25"
          >
            ‹
          </button>
          <figure
            className="max-h-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={slides[i]!.img}
              alt={slides[i]!.caption}
              className="max-h-[85vh] w-auto rounded-xl object-contain"
            />
            <figcaption className="mt-3 text-center text-sm font-semibold text-white/90">
              {i + 1}/{slides.length} — {slides[i]!.caption}
            </figcaption>
          </figure>
          <button
            type="button"
            aria-label="Anh tiep theo"
            onClick={(e) => {
              e.stopPropagation();
              setI((p) => (p + 1) % slides.length);
            }}
            className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white transition hover:bg-white/25"
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
