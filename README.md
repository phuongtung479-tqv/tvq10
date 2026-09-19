# Du học nghề Trung Quốc

Landing page tuyển sinh du học nghề Trung Quốc, kèm funnel builder và khu vực
quản trị lead. Ứng dụng dùng TanStack Start, React, Vite và Supabase.

## Tính năng chính

- Landing page responsive với nội dung ngành học, lợi ích, FAQ, gallery và form
  đăng ký.
- Thu thập lead, UTM tracking, analytics hành vi và các CTA liên hệ.
- `/admin` cho đăng nhập quản trị, cấu hình funnel, quản lý lead và dữ liệu
  analytics.
- Kết nối Supabase cho Auth, cấu hình funnel, lead và visitor tracking.
- Server functions cho webhook, email lead và backup theo lịch khi chạy SSR.

## Yêu cầu

- Node.js 18+ và npm.
- Supabase project nếu cần lưu lead, đăng nhập admin hoặc analytics tập trung.
- Vercel hoặc môi trường SSR tương thích nếu cần server functions.

## Chạy local

```bash
git clone <repository-url>
cd <repository-directory>
npm ci
cp .env.example .env
npm run dev
```

Mở URL mà Vite in ra trong terminal, sau đó kiểm tra `/` và `/admin`. Không
commit `.env`; chỉ dùng `.env.example` làm mẫu tên biến. Danh sách biến public,
server-only và cấu hình Supabase được mô tả trong [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md).

## Lệnh dự án

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy development server |
| `npm run build` | Build production SSR |
| `npm run build:dev` | Build bằng development mode |
| `npm run preview` | Xem bản build local |
| `npm run lint` | Kiểm tra ESLint |
| `npm run format` | Format bằng Prettier |
| `npx playwright test` | Chạy E2E tests |

## Cấu trúc mã nguồn

```text
src/
  routes/       Route landing page, admin và fallback
  components/   UI landing page, form, admin và component primitives
  services/     Server functions, webhook và data adapter
  lib/          Auth, config, tracking, email và tiện ích dùng chung
  config/       Nội dung/cấu hình site mặc định
  assets/       Hình ảnh được bundler quản lý
  styles.css    CSS toàn cục
supabase/       Schema, RLS policy và SQL migration
tests/e2e/      Kiểm thử luồng admin bằng Playwright
public/         File tĩnh công khai
```

## Supabase

Với project mới, chạy các script trong `supabase/` theo thứ tự được ghi trong
[supabase/README.md](supabase/README.md). Tài khoản admin phải tồn tại trong Supabase
Auth và được bật trong bảng `public.admin_users`. Không đưa
`SUPABASE_SERVICE_ROLE_KEY` vào biến `VITE_*` hoặc mã frontend.

## Kiểm tra trước khi phát hành

Chạy tối thiểu:

```bash
npm ci
npm run lint
npm run build
npx playwright test
```

Checklist đầy đủ nằm trong [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Hướng
dẫn Vercel, hosting tĩnh, domain, cron và xử lý Supabase nằm trong
[DEPLOY_GUIDE.md](DEPLOY_GUIDE.md).

## Bảo mật và dữ liệu

- Chỉ commit schema, migration và biến môi trường mẫu; không commit secret,
  backup, build output hoặc dữ liệu lead thật.
- RLS của Supabase là lớp bảo vệ dữ liệu bắt buộc, không coi anon key là secret.
- Sau khi đổi biến `VITE_*`, phải redeploy vì chúng được inject lúc build.
