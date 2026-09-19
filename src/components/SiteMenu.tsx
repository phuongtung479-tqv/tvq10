import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GraduationCap, Menu } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface SiteMenuPage {
  id: string;
  title: string;
  path: string;
}

interface SiteMenuProps {
  pages: SiteMenuPage[];
  brandName: string;
  logoUrl?: string;
  showLogo?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  activePageId?: string;
}

/**
 * Hamburger trigger + animated vertical sidebar.
 * Renders nothing when there are no menu pages, so the icon disappears
 * on every device when there is no menu to show.
 */
export function SiteMenu({
  pages,
  brandName,
  logoUrl,
  showLogo = true,
  ctaLabel,
  ctaHref = "#dang-ky",
  activePageId,
}: SiteMenuProps) {
  const [open, setOpen] = useState(false);

  if (pages.length === 0) return null;

  return (
    <>
      <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-muted/60 p-1 xl:flex">
        {pages.map((page) => {
          const isActive = activePageId
            ? page.id === activePageId
            : page.path === "";
          return (
            <Link
              key={page.id}
              {...(page.path
                ? ({ to: "/$", params: { _splat: page.path } } as const)
                : ({ to: "/", hash: "top" } as const))}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-cta)]"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {page.title}
            </Link>
          );
        })}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Mở menu điều hướng"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95 xl:hidden"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          <span className="hidden text-sm font-semibold sm:inline">Menu</span>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[19rem] max-w-[85vw] flex-col gap-0 border-r border-border bg-background p-0"
        >
          <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/40 px-5 py-4">
            {showLogo &&
              (logoUrl ? (
                <img
                  src={logoUrl || "/placeholder.svg"}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-primary/20"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-cta)]">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
              ))}
            <SheetTitle className="min-w-0 truncate text-sm font-extrabold leading-tight">
              {brandName}
            </SheetTitle>
          </div>

          <nav
            className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4"
            aria-label="Menu chính"
          >
            {pages.map((page, index) => {
              const isActive = activePageId
                ? page.id === activePageId
                : page.path === "";
              const className = `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4`;
              const style = { animationDelay: `${index * 60 + 80}ms` };
              const dot = (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full transition ${
                    isActive
                      ? "bg-primary"
                      : "bg-border group-hover:bg-primary/60"
                  }`}
                  aria-hidden="true"
                />
              );
              return (
                <SheetClose asChild key={page.id}>
                  {page.path ? (
                    <Link
                      to="/$"
                      params={{ _splat: page.path }}
                      className={className}
                      style={style}
                    >
                      {dot}
                      {page.title}
                    </Link>
                  ) : (
                    <Link to="/" hash="top" className={className} style={style}>
                      {dot}
                      {page.title}
                    </Link>
                  )}
                </SheetClose>
              );
            })}
          </nav>

          {ctaLabel ? (
            <div className="border-t border-border/60 p-4">
              <SheetClose asChild>
                <a
                  href={ctaHref}
                  className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition hover:brightness-110"
                >
                  {ctaLabel}
                </a>
              </SheetClose>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
