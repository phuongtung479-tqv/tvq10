# Webhook fields

Website gửi `POST application/json` tới từng webhook đang bật. Với Google Apps
Script, mỗi lead được ghi vào tab `Leads`; các object/array được ghi dạng JSON.

## Cấu hình URL

- Web App URL phải có dạng `https://script.google.com/macros/s/.../exec`.
- Cách đơn giản nhất: vào **Admin → Form & Webhook**, điền URL đó vào ô
  **Webhook URL (Make/Zapier)**, xóa URL Make cũ hoặc tắt endpoint Make.
- Nếu dùng danh sách endpoint phụ: bấm **Thêm Webhook**, chọn **Google Sheets**,
  dán URL `/exec`, bật **Kích hoạt**, rồi bấm **Lưu ngay**.
- Với endpoint Google Sheets, mở phần **Chọn cột gửi sang Google Sheets** và
  tích/bỏ tích từng biến. Sau khi đổi lựa chọn phải bấm **Lưu ngay**.
- Khi gửi, website chỉ gửi các biến đã tích. Script luôn thêm `received_at` và
  `raw_payload` để đối soát request.
- Không điền Google Sheets API key vào ô URL. Apps Script Web App dùng URL `/exec`
  và quyền `Who has access: Anyone`.

## Trường dữ liệu

| Biến | Ý nghĩa |
| --- | --- |
| `event` | Loại sự kiện, lead thật là `lead_created`. |
| `webhook_delivery_id` | Mã duy nhất của lần gửi webhook. Dùng để tra log. |
| `idempotency_key` | Mã chống ghi trùng. Apps Script bỏ qua key đã nhận. |
| `created_at` | Thời điểm khách submit. |
| `full_name` | Họ tên khách hàng. |
| `phone` | Số điện thoại đã chuẩn hóa. |
| `email` | Email khách, có thể rỗng. |
| `city` | Tỉnh/thành khách chọn. |
| `major` | Ngành khách quan tâm. |
| `source` | Nguồn attribution chính, thường là UTM source hoặc `direct`. |
| `landing_url` | URL đầy đủ nơi khách gửi form. |
| `ab_variant` | Nhánh A/B, thường `A` hoặc `B`. |
| `ai_score` | Điểm lead do AI Sales Advisor tính. |
| `ai_rank` | Nhãn lead như HOT/WARM hoặc giá trị tương ứng. |
| `risk_level` | Mức rủi ro: `low`, `review`, `high`, `unrated`. |
| `risk_reasons` | Danh sách lý do đánh giá rủi ro, dạng JSON array. |
| `recommended_action` | Hành động tư vấn được gợi ý. |
| `sale_advice` | Kịch bản/lời khuyên cho sale. |
| `behavior_summary` | Tóm tắt hành vi truy cập. |
| `device_tech_info` | Thông tin kỹ thuật thiết bị. |
| `traffic_ads_source` | Nguồn quảng cáo đã nhận diện. |
| `visits_today` | Số lượt truy cập trong ngày. |
| `visits_month` | Số lượt truy cập trong tháng. |
| `current_session` | Số thứ tự phiên truy cập hiện tại. |
| `device_manufacturer` | Hãng thiết bị. |
| `device_family` | Dòng thiết bị. |
| `device_model_name` | Tên model thiết bị. |
| `operating_system` | Hệ điều hành và phiên bản. |
| `browser` | Trình duyệt và phiên bản. |
| `network_provider` | Nhà mạng nếu nhận diện được. |
| `network_label` | Nhãn loại mạng. |
| `utm_source` | Nguồn quảng cáo từ URL. |
| `utm_medium` | Phương tiện quảng cáo. |
| `utm_campaign` | Tên chiến dịch. |
| `utm_content` | Nội dung/quảng cáo biến thể. |
| `utm_term` | Từ khóa quảng cáo. |
| `ttclid` | Click ID TikTok. |
| `fbclid` | Click ID Facebook. |
| `gclid` | Click ID Google Ads. |
| `referrer` | Trang giới thiệu trước đó. |
| `attribution_model` | Mô hình attribution, hiện thường là `last`. |
| `attribution_detected_by` | Cách hệ thống phát hiện attribution. |
| `raw_query` | Query string gốc của URL. |
| `utm_params` | Toàn bộ attribution bổ sung, dạng JSON object. |
| `raw_payload` | Toàn bộ JSON gốc để không mất trường mới trong tương lai. |

## Chọn dữ liệu trong Google Sheets

Giữ các cột cần dùng để lọc/báo cáo, ví dụ `created_at`, `full_name`, `phone`,
`city`, `major`, `source`, `utm_campaign`, `ai_score`, `risk_level` và
`recommended_action`. Không xóa `idempotency_key` nếu vẫn muốn truy vết trùng.
Có thể ẩn các cột kỹ thuật thay vì xóa; `raw_payload` nên giữ để dự phòng.

Nếu đã đổi danh sách cột, hãy deploy lại Apps Script **New version** nếu bạn
đang dùng bản script cũ, sau đó gửi một lead test. Khi danh sách cột thay đổi,
script có thể chèn header mới ở đầu tab `Leads`; hãy giữ lại các dòng cũ để
không mất lịch sử.