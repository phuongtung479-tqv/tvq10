# Hướng dẫn triển khai (Deploy Guide)

Landing page "Du học nghề Trung Quốc" + hệ thống Admin Funnel Builder.
Dự án dùng **TanStack Start (React + Vite)**. Có 2 cách chạy:

- **A. Vercel (khuyến nghị)** — chạy full SSR + Server Function (email tự động).
- **B. Hosting tĩnh (cPanel / DirectAdmin / VPS Nginx)** — chạy bản build tĩnh; email tự động qua Server Function sẽ không hoạt động (thay bằng webhook).

---

## 0. Yêu cầu

- Node.js 18+ và npm.
- Tài khoản Supabase Cloud và biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_ADMIN_EMAIL`.
- (Tùy chọn) Khóa Resend `RESEND_API_KEY` nếu muốn gửi email tự động.

Repo này có thể phát hành công khai. Không commit `.env`, mật khẩu Supabase,
`SUPABASE_SERVICE_ROLE_KEY`, Resend key hoặc backup token. Chỉ
`VITE_SUPABASE_URL` và publishable/anon key được đưa vào frontend; RLS phải là
lớp bảo vệ dữ liệu.

Cài dependency và chạy thử local:

```bash
npm install
npm run dev      # xem thử tại http://localhost:3000
npm run build    # tạo bản build production
```

Tạo file môi trường local từ mẫu:

```bash
cp .env.example .env
```

Điền giá trị thật vào `.env`; file này đã nằm trong `.gitignore`.

---

## A. Deploy lên Vercel

1. Push code lên GitHub (v0 đã đồng bộ sẵn repo này).
2. Vào Vercel → **New Project** → chọn repo → framework tự nhận **TanStack Start**.
3. Thêm biến môi trường (Project → Settings → Environment Variables):
   - `RESEND_API_KEY` — nếu bật Auto Email.
   - `RESEND_FROM_EMAIL` — địa chỉ From thuộc domain đã xác minh trên Resend;
     test nhanh có thể dùng `onboarding@resend.dev`.
   - `VITE_SUPABASE_URL` — URL public của project Supabase.
   - `VITE_SUPABASE_ANON_KEY` — publishable/anon key, không dùng service role key.
   - `VITE_SUPABASE_ADMIN_EMAIL` — email của user quản trị đã tạo trong Supabase Auth.
   - `VITE_SITE_URL` — domain HTTPS chính, ví dụ `https://tvq4.vercel.app`.
4. Bấm **Deploy**. Xong.

Sau khi thay đổi biến môi trường, cần redeploy để Vite đưa cấu hình mới vào bản build.

> Form lead, CRM cloud và webhook relay cần deployment có SSR như Vercel.
> Không dùng bản static cho production nếu cần nhận lead tập trung.

Ưu điểm: Server Function `sendLeadEmail` chạy được, không lộ API key ra trình duyệt.

### A1. Bảng biến môi trường

| Biến                        | Nơi đặt                   |   Bắt buộc | Ghi chú                                                                     |
| --------------------------- | ------------------------- | ---------: | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Vercel Production/Preview |         Có | Project URL, ví dụ `https://project-ref.supabase.co`                        |
| `VITE_SUPABASE_ANON_KEY`    | Vercel Production/Preview |         Có | Publishable/anon key, được phép xuất hiện trong frontend nhưng vẫn cần RLS  |
| `VITE_SUPABASE_ADMIN_EMAIL` | Vercel Production/Preview |         Có | Email user đã có trong `admin_users`                                        |
| `VITE_SITE_URL`             | Vercel Production/Preview |         Có | Domain chính dùng cho canonical, sitemap và robots                            |
| `SUPABASE_URL`              | Vercel server-only        | Chỉ backup | Không có tiền tố `VITE_`                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server-only        | Chỉ backup | Tuyệt đối không đưa vào browser/Git                                         |
| `RESEND_API_KEY`            | Vercel server-only        |   Tùy chọn | Dùng email server                                                           |
| `RESEND_FROM_EMAIL`         | Vercel server-only        |   Tùy chọn | From đã xác minh trên Resend; dùng cho auto email nếu Admin không nhập From |
| `BACKUP_FROM_EMAIL`         | Vercel server-only        |   Tùy chọn | Domain/email đã xác minh trên Resend                                        |
| `BACKUP_CRON_TOKEN`         | Vercel server-only        |   Tùy chọn | Token ngẫu nhiên, không lưu trong config cloud                              |

Sau khi thêm hoặc đổi bất kỳ biến nào, chọn **Redeploy**. Vite chỉ inject biến
`VITE_*` trong lúc build; reload trang không đủ để nhận giá trị mới.

Không dùng `SUPABASE_SERVICE_ROLE_KEY` làm `VITE_SUPABASE_ANON_KEY`.

---

## B. Deploy bản tĩnh lên cPanel / DirectAdmin / VPS Nginx

> Lưu ý: bản tĩnh **không** chạy được Server Function gửi email, relay webhook
> hoặc relay CRM. In-app browser có thể chặn request trực tiếp tới webhook.
> Khuyến nghị dùng Vercel SSR cho production.

1. Build:

   ```bash
   npm run build
   ```

   Thư mục kết quả nằm ở `dist/` (hoặc `.output/public` tùy cấu hình — kiểm tra log build).

2. **cPanel / DirectAdmin:**
   - Mở **File Manager** → vào `public_html`.
   - Upload toàn bộ nội dung thư mục build.
   - File `public/.htaccess` đã kèm sẵn: ép HTTPS, SPA rewrite, Gzip, cache, security headers.

3. **VPS Nginx:** thêm block sau (thay `root` bằng đường dẫn thật):
   ```nginx
   server {
     listen 80;
     server_name duhoctq.example.com;
     root /var/www/duhoctq;
     index index.html;

     # SPA fallback
     location / {
       try_files $uri $uri/ /index.html;
     }

     # Cache tài nguyên tĩnh
     location ~* \.(css|js|webp|png|jpe?g|svg|woff2)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
     }
   }
   ```
   Sau đó cài SSL bằng `certbot --nginx`.

---

## C. Kết nối Supabase Cloud (Database Mode)

Dùng để cấu hình, lead và analytics đồng bộ nhiều thiết bị. Database Mode không ghi dữ liệu nghiệp vụ vào localStorage.

1. Tạo project tại [supabase.com](https://supabase.com).
2. Trong SQL Editor, chạy lần lượt `supabase/admin_users.sql`, `supabase/funnel_configs.sql`, `supabase/leads.sql`, `supabase/visitor_tracking.sql`, rồi `supabase/admin_rls_patch.sql`. Với project đã chạy schema cũ, chạy lại `supabase/admin_rls_patch.sql` để sửa policy analytics mà không xóa dữ liệu. Không chạy các dump SQL cũ.
3. Vào **Authentication → Users → Add user**, tạo tài khoản email/mật khẩu quản trị. Nếu bật **Confirm email**, phải xác nhận email trước lần đăng nhập đầu tiên.
4. Nếu user cũ vẫn báo `email_not_confirmed` dù đã tắt Confirm email, chạy câu SQL sau. `confirmed_at` là cột generated nên không được cập nhật trực tiếp:

   ```sql
   update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
   where lower(email) = lower('admin@example.com');
   ```

   Thay email mẫu bằng email quản trị thật. Sau đó kiểm tra:

   ```sql
   select id, email, email_confirmed_at, confirmed_at
   from auth.users
   where lower(email) = lower('admin@example.com');
   ```

5. Chạy lại đoạn `insert into public.admin_users ...` trong `supabase/admin_users.sql` sau khi user đã tồn tại, hoặc thay email trong câu SQL bằng email thực tế của admin. Kiểm tra user có một dòng `enabled = true` trong `public.admin_users`.
6. Trong Vercel đặt `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và `VITE_SUPABASE_ADMIN_EMAIL`. Chỉ dùng publishable/anon key ở frontend; tuyệt đối không dùng service role key.
7. Redeploy rồi mở `/admin`. Đăng nhập bằng email Supabase Auth và mật khẩu của user, không dùng mật khẩu admin cũ trong mã nguồn.
8. Nếu đăng nhập thành công nhưng lưu analytics báo 403, chạy `supabase/admin_rls_patch.sql`; patch tạo function `is_funnel_admin()` với `security definer` để policy không bị RLS lồng chặn.

Kiểm tra nhanh trong Supabase sau khi đăng nhập:

```sql
select user_id, email, role, enabled from public.admin_users;
select count(*) from public.leads;
```

Nếu đăng nhập thành công nhưng danh sách lead trống hoặc báo 401/403, kiểm tra policy `admins can read leads` và xem Network request tới `/rest/v1/leads` có `Authorization: Bearer <access_token>`.

### C1. Kiểm tra schema sau khi chạy SQL

```sql
select user_id, email, role, enabled
from public.admin_users;

select id, updated_at from public.funnel_configs where id = 1;
select id, updated_at from public.funnel_analytics where id = 1;

select public.is_funnel_admin();

select proname
from pg_proc
where proname in (
   'is_funnel_admin',
   'upsert_funnel_analytics',
   'reset_funnel_analytics',
   'clear_funnel_leads'
);
```

Với project đã chạy schema cũ, chạy `supabase/admin_rls_patch.sql`. File này
idempotent và tạo các RPC bảo vệ thao tác analytics/lead của Admin.

### C2. Kiểm tra Analytics cloud

Analytics không ghi tổng hợp trực tiếp từ visitor anon vào `funnel_analytics`.
Landing ghi từng phiên vào `visitor_sessions`; sau khi Admin đăng nhập, màn hình
**Thống Kê & Analytics** đọc `visitor_sessions` và `leads` rồi tổng hợp theo
nguồn traffic. Vì vậy mở `/admin` một mình không tạo lượt truy cập; hãy mở
trang landing thật bằng tab khác, chờ vài giây rồi tải lại Analytics.

Kiểm tra nhanh trong SQL Editor:

```sql
select count(*) as sessions from public.visitor_sessions;
select count(*) as leads from public.leads;
select id, data from public.funnel_analytics where id = 1;
```

Nếu `visitor_sessions` vẫn bằng 0 sau khi mở landing, chạy lại
`supabase/visitor_tracking.sql` để áp dụng quyền `insert` cho `anon`, sau đó
redeploy frontend và mở lại trang landing. Không cấp quyền `select` cho `anon`.

Migration mới cũng tạo RPC `record_visitor_session`. RPC này là bắt buộc để
Footer nhận được tổng số lượt hôm nay/tháng mà vẫn giữ RLS an toàn; nếu request
`/rest/v1/rpc/record_visitor_session` trả `404`, schema cloud chưa được cập nhật.
Migration cũng tạo RPC `get_funnel_analytics`, là nguồn dữ liệu của màn hình
Admin Analytics. Nếu RPC này trả `404`, màn hình sẽ không thể đọc số liệu cloud.

Thông tin phần cứng và pin được gửi trong `device_tech_info`. RAM và số lõi có
thể bị trình duyệt giới hạn; Safari iOS không hỗ trợ Battery API đầy đủ, nên
trường hợp này sẽ ghi `Pin không khả dụng` thay vì suy đoán dữ liệu.

---

## D. Cloud Cron-job (sao lưu định kỳ)

Admin hỗ trợ lịch backup (`daily` / `weekly` / `off`) trong mục **📂 Cloud Cron & Backup**.
Với Vercel, endpoint `/api/backup` đã được cấu hình trong `vercel.json` và được gọi hằng ngày lúc 02:00 UTC. Endpoint tự kiểm tra `cronSchedule`; lịch `weekly` chỉ gửi vào thứ Hai.

Thêm các biến môi trường Production trên Vercel:

- `SUPABASE_URL` — URL project Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — chỉ đặt trên server, không đưa vào frontend.
- `RESEND_API_KEY` — API key Resend.
- `BACKUP_FROM_EMAIL` — email đã xác minh trên Resend.
- `BACKUP_CRON_TOKEN` — tùy chọn, dùng khi gọi thủ công ngoài Vercel Cron.

Sau đó nhập email nhận backup trong Admin, chọn `daily` hoặc `weekly`, bấm **LƯU THAY ĐỔI**, rồi deploy lại.

Gọi thủ công để kiểm tra:

```bash
curl -i "https://tvq4.vercel.app/api/backup?token=$BACKUP_CRON_TOKEN"
```

Phải nhận HTTP `200 Backup sent`. Nếu nhận `503`, kiểm tra đủ biến môi trường; nếu `401`, kiểm tra token hoặc gọi từ Vercel Cron.

## E. Domain và SSL

### E1. Gắn domain trên Vercel

1. Vào **Vercel → Project → Settings → Domains → Add**.
2. Nhập domain chính, ví dụ `www.example.com` hoặc `example.com`.
3. Tại nhà cung cấp DNS, tạo đúng bản ghi Vercel hiển thị trong màn hình Domain.
   Thông thường:
   - Domain gốc: `A @ 76.76.21.21`.
   - Subdomain: `CNAME www cname.vercel-dns.com`.
4. Xóa bản ghi A/CNAME cũ trỏ sang hosting khác nếu gây conflict.
5. Chờ DNS propagation và xem trạng thái **Valid Configuration** trên Vercel.

Không tự cài certificate trên Vercel. Vercel tự cấp và gia hạn SSL sau khi DNS
đúng. Không dùng domain có certificate lỗi hoặc mixed-content asset.

### E2. Kiểm tra domain/SSL

```bash
curl -I http://example.com/admin
curl -I https://example.com/admin
openssl s_client -connect example.com:443 -servername example.com \\
   </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

Kết quả mong muốn: HTTP chuyển `308` sang HTTPS, HTTPS trả `200`, certificate
có SAN chứa domain thật, và ngày hết hạn còn hiệu lực.

## F. Phát hành source package

Gói source không được chứa `.env`, `node_modules`, `.output`, test traces hoặc
secret. Tạo gói sạch từ root repository:

```bash
tar --exclude=node_modules \\
      --exclude=.output \\
      --exclude=test-results \\
      --exclude=.env \\
      --exclude='*.zip' \\
      -czf tvq1-source-release.tar.gz .
```

Người nhận giải nén gói, chạy `npm install`, copy `.env.example` thành `.env`,
điền biến môi trường riêng, chạy SQL trong mục C rồi `npm run build`.

Không gửi file `.env` qua GitHub, email công khai hoặc trong archive source.

---

## G. Checklist phát hành doanh nghiệp

- [ ] Trang chủ mở được qua HTTPS.
- [ ] Mở đúng `https://tvq1.vercel.app`, không dùng `http://`; HTTP phải tự chuyển 308 sang HTTPS.
- [ ] Supabase Auth có user admin và `public.admin_users.enabled = true`.
- [ ] `/admin` đăng nhập được bằng email/mật khẩu Supabase Auth; refresh trang vẫn giữ phiên tới khi token hết hạn.
- [ ] Admin đọc được `leads` sau khi đăng nhập, không dùng service role key trên trình duyệt.
- [ ] Lưu một thay đổi cấu hình và kiểm tra `funnel_configs.id = 1` cập nhật trên Supabase.
- [ ] Gửi thử form → kiểm tra lead xuất hiện trong **Admin → 📋 Quản Lý Lead**.
- [ ] Webhook (Make/Telegram/Sheets) nhận được dữ liệu.
- [ ] Pixel Facebook/TikTok/GA4 bắn sự kiện `PageView` và `Lead`.
- [ ] Đổi mật khẩu & đường dẫn Admin (mục **🔑 Đổi Link Admin**) khỏi giá trị mặc định.
- [ ] Cập nhật `public/sitemap.xml` và `public/robots.txt` theo domain thật.
- [ ] Domain Vercel hiển thị `Valid Configuration`.
- [ ] HTTP redirect sang HTTPS và certificate có SAN đúng domain.
- [ ] Không còn secret thật trong source package.
- [ ] Đã kiểm tra rollback về deployment trước trên Vercel.

### Kiểm tra tự động

Lint toàn bộ repo hiện còn một số lỗi Prettier tồn tại ở các component không liên quan. Kiểm tra riêng phần auth:

```bash
npx eslint src/lib/supabase-auth.ts src/components/admin/AdminLoginPage.tsx
```

Chạy E2E cloud sau khi đã tạo user test:

```bash
E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD='mat-khau-test' npm exec playwright test tests/e2e/admin-pages.spec.ts
```

## H. Google Sheets webhook không qua Make

Dùng file `scripts/google-sheets-webhook.gs` để thay Make khi Make hết quota.
Danh sách đầy đủ biến và ý nghĩa nằm trong [docs/WEBHOOK_FIELDS.md](docs/WEBHOOK_FIELDS.md).

1. Tạo một Google Sheet mới.
2. Mở **Extensions → Apps Script**.
3. Xóa code mẫu và dán toàn bộ nội dung `scripts/google-sheets-webhook.gs`.
4. Bấm **Deploy → New deployment → Web app**.
5. Chọn **Execute as: Me** và **Who has access: Anyone**.
6. Deploy, cấp quyền Google lần đầu và sao chép URL kết thúc bằng `/exec`.
7. Trong Admin → **Form & Webhook**, thêm endpoint:
    - Type: `Google Sheets`
    - URL: URL `/exec`
    - Enabled: bật
8. Bấm **Lưu ngay**, rồi bấm **Test webhook chính** hoặc test endpoint Sheets.

Nếu Apps Script báo `autoRemoveEmptyRows` hoặc `myFunction` đã bị xóa, đó là
trigger cũ còn sót lại trong project, không phải lỗi webhook mới. Chọn hàm
`removeLegacyTriggers` rồi bấm **Run** một lần, cấp quyền nếu được hỏi. Sau đó
vào **Triggers** và xóa mọi trigger còn gọi các hàm cũ. Không bấm **Run** cho
`doPost`: `doPost` cần HTTP event từ Web App. Để test trực tiếp quyền ghi Sheet,
chọn hàm `testWebhookInSheet` rồi bấm **Run**; hàm này phải tạo một dòng
`sheets_manual_test` trong tab `Leads`.

Khi submit form, Apps Script ghi một dòng vào tab `Leads`. Script lưu cả các trường
UTM, AI, hành vi và `raw_payload`. `idempotency_key`/`webhook_delivery_id` được
dùng để bỏ qua request trùng.

Test thủ công không dùng dữ liệu khách thật:

```bash
curl -i -X POST 'URL_APPS_SCRIPT_EXEC' \
   -H 'Content-Type: application/json' \
   -H 'X-Idempotency-Key: sheets-test-1' \
   --data '{"event":"sheets_test","webhook_delivery_id":"sheets-test-1","idempotency_key":"sheets-test-1","full_name":"Test webhook","phone":"0900000000","source":"manual_test"}'
```

Kết quả đúng là JSON có `"ok":true` và một dòng mới trong tab `Leads`. Gửi lại
cùng `idempotency_key` phải trả `"duplicate":true` và không tạo thêm dòng.
