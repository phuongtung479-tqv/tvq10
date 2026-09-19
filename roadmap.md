# Roadmap

Hoàn thành:

1. Chân trang lấy hotline/email/đơn vị bảo trợ từ một chỗ cấu hình duy nhất (src/lib/config.ts) — tự ẩn khi chưa có thông tin.
2. Hai nút liên hệ nổi (gọi hotline + Zalo, pulse) góc dưới phải.
3. Form: trạng thái "Đang gửi...", toast + màn hình thành công, reset form, validation SĐT/email.
4. Webhook Make.com POST JSON (full_name, phone, email, major, city, source, created_at); tracking fbq/ttq chỉ chạy sau khi gửi thành công.
5. Thanh khan hiếm: đếm ngược hết tháng + số suất 0Đ còn lại, đặt cạnh form.
6. Section cơ sở vật chất (xưởng ô tô điện, lab drone, ký túc xá) + đội ngũ chuyên gia.
7. Khối đánh giá học viên + dải số liệu nổi bật.
8. Popup "khách vừa đăng ký" góc dưới trái, lặp 10-15 giây.
9. FAQ + dữ liệu cấu trúc FAQPage; hiệu ứng fade-in khi cuộn, thẻ kính mờ, giãn khoảng trắng.

10. Thanh CTA dính đáy trên mobile (Zalo Tư Vấn + Đăng Ký Ngay, cuộn mượt tới form), chỉ hiện sau hero.
11. Ô điện thoại chỉ nhận số, giới hạn 10 chữ số; nút gửi có spinner + disable chống bấm trùng.
12. Carousel ảnh visa/trường/ký túc xá tự chạy, có nút chuyển và chấm điều hướng.
13. Toàn bộ ảnh chuyển sang WebP, lazy-load cho ảnh dưới khung hình đầu.
14. Gỡ nút Zalo nổi bên phải và section cơ sở vật chất bị trùng với carousel ảnh thực tế.
15. Bổ sung hồ sơ chuyên môn cho từng chuyên gia; viết lại 8 ngành theo triển vọng 5-20 năm, không hiển thị lương cụ thể trên thẻ ngành.

Còn chờ thông tin thật từ user:

- Webhook URL Make.com, ID pixel Facebook/TikTok/Google.
- Hotline, email, số Zalo, tên/địa chỉ/giấy phép đơn vị bảo trợ gốc.

- [x] Deep audit 15/09: sửa trang chủ trắng (thiếu useMemo/useState, vòng lặp render useSyncExternalStore), dọn lỗi TypeScript strict, typecheck + eslint + build sạch

- [x] 15/09 (2): thanh Admin dùng icon (3 chế độ xem, lưu, đăng xuất, thu gọn); header trang chủ: menu giữa + nút đăng ký sát mép phải trên desktop, icon menu dọc cạnh logo trên tablet/mobile; gộp trùng lặp tracking (StorageMode, base code pixel, ID Google Ads), bỏ export/thừa không dùng
