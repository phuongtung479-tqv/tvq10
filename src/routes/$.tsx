import { createFileRoute, Link, useParams } from "@tanstack/react-router";

import { useSiteConfig } from "@/lib/use-site-config";
import { AdminLoginPage } from "@/components/admin/AdminLoginPage";
import { ContentSection } from "@/components/ContentSection";

export const Route = createFileRoute("/$")({
  component: CatchAll,
});

function CatchAll() {
  const params = useParams({ from: "/$" });
  const { config } = useSiteConfig();
  const slug = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
  const adminPath = config.admin.adminPath.trim().replace(/^\/+|\/+$/g, "");
  const adminAliases = new Set([adminPath, "admin", "supper"]);

  if (adminAliases.has(slug) && slug) return <AdminLoginPage />;

  const page = config.pages.find((item) => item.enabled && item.path === slug);
  if (page) {
    const menuPages = config.pages
      .filter((item) => item.enabled && item.showInMenu)
      .sort((a, b) => a.menuOrder - b.menuOrder);
    const pageSections = (page.sectionIds || [])
      .map((sectionId) =>
        config.landing.sectionsArray.find(
          (section) => section.id === sectionId,
        ),
      )
      .filter((section): section is NonNullable<typeof section> =>
        Boolean(section && section.enabled),
      );
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
          <nav
            className="mx-auto flex max-w-6xl items-center justify-end gap-3 overflow-x-auto"
            aria-label="Menu chính"
          >
            {menuPages.map((menuPage) => {
              const cls = `shrink-0 text-xs font-semibold transition hover:text-primary ${menuPage.id === page.id ? "text-primary" : "text-muted-foreground"}`;
              return menuPage.path ? (
                <Link
                  key={menuPage.id}
                  to="/$"
                  params={{ _splat: menuPage.path }}
                  className={cls}
                >
                  {menuPage.title}
                </Link>
              ) : (
                <Link key={menuPage.id} to="/" className={cls}>
                  {menuPage.title}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="mx-auto w-full max-w-3xl px-4 pt-16 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            {page.title}
          </p>
          <h1 className="mt-3 text-3xl font-black text-foreground">
            {page.heading || page.title}
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {page.description}
          </p>
          {page.ctaLabel && (
            <a
              href={page.ctaHref || "/"}
              className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground"
            >
              {page.ctaLabel}
            </a>
          )}
        </div>
        <div className="mt-8">
          {pageSections.map((section) => (
            <ContentSection key={section.id} section={section} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Không tìm thấy trang
        </h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
