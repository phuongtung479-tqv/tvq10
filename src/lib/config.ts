/**
 * Paste your Make.com webhook URL here (Custom Webhook -> Copy address URL).
 * Leads are sent as JSON via HTTP POST, ready to append to Google Sheets.
 */
export const MAKE_WEBHOOK_URL: string =
  "https://hook.us2.make.com/jtwmjkp2t8wrlr4f080ppgc84u3e53aa";

/**
 * Thông tin liên hệ dùng chung cho chân trang và các nút liên hệ nổi.
 * Để chuỗi rỗng ("") thì dòng tương ứng sẽ tự ẩn cho tới khi có thông tin thật.
 */
export const FOOTER: {
  hotline: string;
  email: string;
  zalo: string;
  sponsor: string;
  address: string;
  licenseNumber: string;
} = {
  hotline: "",
  email: "",
  /** Số Zalo nhận tin nhắn tư vấn nhanh (để trống thì dùng hotline) */
  zalo: "",
  /** Đơn vị bảo trợ chuyên môn & tuyển sinh hiển thị ở chân trang */
  sponsor: "Trung tâm Hướng nghiệp & Phát triển Sự nghiệp Quốc tế",
  address: "",
  licenseNumber: "",
};

/** Tổng số suất học bổng 0Đ mở trong tháng (dùng cho thanh khan hiếm) */
export const SLOTS_TOTAL = 30;
export const SLOTS_LEFT = 5;
