import { createFileRoute } from "@tanstack/react-router";

import { AdminLoginPage } from "@/components/admin/AdminLoginPage";
import { useSiteConfig } from "@/lib/use-site-config";

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  const { config } = useSiteConfig();
  const path = config.admin.adminPath.trim().replace(/^\/+|\/+$/g, "");
  const adminAliases = new Set([path, "admin", "supper"]);

  if (adminAliases.has("admin") || adminAliases.has("supper")) {
    return <AdminLoginPage />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">
        Trang quản trị đã được chuyển sang đường dẫn mới.
      </p>
    </main>
  );
}
