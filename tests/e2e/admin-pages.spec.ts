import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env["E2E_ADMIN_EMAIL"];
const adminPassword = process.env["E2E_ADMIN_PASSWORD"];

test.skip(
  !adminEmail || !adminPassword,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for cloud admin E2E tests.",
);

async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByPlaceholder("Email Supabase Auth").fill(adminEmail ?? "");
  await page.getByPlaceholder("Mật khẩu quản trị").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("admin can create a secondary page and keep its section scoped", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Xem trước: BẬT/ }).click();
  await expect(page.getByRole("button", { name: "Đa Trang" })).toBeVisible();
  await page.getByRole("button", { name: "Đa Trang" }).click();
  await expect(
    page.getByRole("heading", { name: "Quản Lý Đa Trang & Menu" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "+ Trang mới" }).click();
  await page.getByLabel("Tên trang").fill("Trang phụ kiểm thử");
  await page.getByLabel("Tiêu đề hiển thị").fill("Trang phụ kiểm thử");
  await page.getByRole("button", { name: /\+ Hero/ }).click();
  await page
    .getByLabel("Tiêu đề", { exact: true })
    .last()
    .fill("Block chỉ dành cho trang phụ");

  const pagePath = await page.getByLabel("Đường dẫn").inputValue();
  await page.getByRole("button", { name: "Đóng" }).click();

  const secondaryPageLink = page.getByRole("link", {
    name: "Trang phụ kiểm thử",
  });
  await expect(secondaryPageLink).toHaveAttribute("href", `/${pagePath}`);
  await secondaryPageLink.click();
  await expect(page).toHaveURL(new RegExp(`/${pagePath}$`));
  await expect(
    page.getByRole("heading", { name: "Block chỉ dành cho trang phụ" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Block chỉ dành cho trang phụ" }),
  ).toHaveCount(0);
});

test("exit intent popup triggers when the config is enabled and user leaves page", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "funnel_site_config_v1",
      JSON.stringify({
        exitIntent: {
          enabled: true,
          respectReducedMotion: false,
          templateId: "offer",
          badge: "Ưu đãi đặc biệt",
          title: "Nhận tư vấn miễn phí + lộ trình học phù hợp",
          description: "Test popup",
          ctaLabel: "Nhận tư vấn ngay",
          triggerDelaySec: 0,
          minTimeOnPageSec: 0,
          minScrollPercent: 0,
          allowMobile: true,
          position: "center",
          showCloseButton: true,
        },
      }),
    );
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    document.dispatchEvent(
      new MouseEvent("mouseleave", { clientY: 0, bubbles: true }),
    );
  });

  await expect(
    page.getByRole("dialog").filter({ hasText: "Nhận tư vấn miễn phí + lộ trình học phù hợp" }),
  ).toBeVisible({ timeout: 15_000 });
});

test("admin guide health modal shows readiness summary and checklist", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Xem trước: BẬT/ }).click();
  await page.getByRole("button", { name: "Hướng Dẫn & Health" }).click();

  await expect(
    page.getByRole("heading", { name: "Hướng Dẫn & Health Check" }),
  ).toBeVisible();
  await expect(page.getByText("Điểm health", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Tính năng này sinh ra để làm gì?"),
  ).toBeVisible();
  await expect(
    page.getByText("Checklist giá trị sau khi hoàn tất"),
  ).toBeVisible();
  await expect(page.getByText("Lead có đầu ra nhận dữ liệu")).toBeVisible();
  await expect(
    page.getByText("Khi điểm health đạt 100/100", { exact: false }),
  ).toBeVisible();
});
