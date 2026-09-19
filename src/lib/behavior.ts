/**
 * Unified visitor behavior tracking and lead assessment helpers.
 */
import type {
  BehaviorData,
  LeadAssessment,
  LeadRiskLevel,
  VisitorBehaviorPayload,
} from "@/types/visitor-tracking";
import {
  collectBehavior,
  getTrackingSnapshot,
  initVisitorTracking,
  markCopiedText,
  markCopyPaste,
  markFaqClick,
  markFormStart,
  markIndustrySwitch,
  syncCurrentVisitorSession,
  type VisitorTrackingInitOptions,
} from "@/lib/visitor-tracking";

export type { BehaviorData, LeadAssessment, LeadRiskLevel };
export {
  markCopiedText,
  markCopyPaste,
  markFaqClick,
  markFormStart,
  markIndustrySwitch,
};

export function initBehavior(options: VisitorTrackingInitOptions = {}) {
  return initVisitorTracking(options);
}

export function syncBehaviorSession(options: VisitorTrackingInitOptions) {
  syncCurrentVisitorSession(options);
}

function scoreLead(
  data: BehaviorData,
  cfg?: {
    enabled?: boolean;
    vipDeviceRegex?: string;
    keyRegions?: string;
    fastFillThresholdSec?: number;
    vipTimeOnPageSec?: number;
    vipScrollPercent?: number;
    weightDevice?: number;
    weightRegion?: number;
    weightFastFill?: number;
    weightTimeOnPage?: number;
    weightScroll?: number;
    weightReturnVisit?: number;
  },
): LeadAssessment {
  if (cfg?.enabled === false) {
    return {
      score: 0,
      rank: "Chưa chấm AI",
      riskLevel: "unrated",
      reasons: ["AI Sales Advisor đang tắt trong cấu hình Admin"],
      recommendedAction: "Tư vấn theo quy trình thông thường",
    };
  }

  const finiteNonNegative = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? Math.max(0, value as number) : fallback;
  const fastFill = finiteNonNegative(cfg?.fastFillThresholdSec, 4);
  const vipTime = finiteNonNegative(cfg?.vipTimeOnPageSec, 80);
  const vipScroll = finiteNonNegative(cfg?.vipScrollPercent, 70);
  const weightDevice = finiteNonNegative(cfg?.weightDevice, 18);
  const weightRegion = finiteNonNegative(cfg?.weightRegion, 8);
  const weightFastFill = finiteNonNegative(cfg?.weightFastFill, 15);
  const weightTimeOnPage = finiteNonNegative(cfg?.weightTimeOnPage, 15);
  const weightScroll = finiteNonNegative(cfg?.weightScroll, 12);
  const weightReturnVisit = finiteNonNegative(cfg?.weightReturnVisit, 4);
  const reasons: string[] = [];
  const locationMismatch = Boolean(
    data.location_city &&
    data.form_city &&
    !data.location_city.toLowerCase().includes(data.form_city.toLowerCase()) &&
    !data.form_city.toLowerCase().includes(data.location_city.toLowerCase()),
  );

  if (data.is_headless_browser) {
    reasons.push("Trình duyệt tự động/headless được nhận diện");
  }
  if (
    data.form_fill_duration_seconds > 0 &&
    data.form_fill_duration_seconds < fastFill
  ) {
    reasons.push(`Thời gian điền form dưới ${fastFill} giây`);
  }
  if (data.submission_count_same_visitor > 1) {
    reasons.push(
      `Thiết bị đã ghi nhận ${data.submission_count_same_visitor} lần gửi trong ngày`,
    );
  }
  if (locationMismatch && data.is_copy_paste) {
    reasons.push(
      "Khu vực mạng khác tỉnh khai báo kèm thao tác copy số điện thoại",
    );
  }
  if (data.network_flags.length > 0) {
    reasons.push(`Mạng có tín hiệu: ${data.network_flags.join(", ")}`);
  }
  if (data.max_scroll_velocity > 5000) {
    reasons.push(`Tốc độ cuộn ${data.max_scroll_velocity}px/s bất thường`);
  }
  if (data.scroll_back_count > 10) {
    reasons.push(`Cuộn lên/xuống ${data.scroll_back_count} lần bất thường`);
  }

  if (data.is_headless_browser) {
    return {
      score: 5,
      rank: "Bot / Ảo",
      riskLevel: "high",
      reasons,
      recommendedAction: "Không tự động gọi; kiểm tra lead và nguồn quảng cáo",
    };
  }

  const safeRegex = (pattern?: string) => {
    if (!pattern) return null;
    try {
      return new RegExp(pattern, "i");
    } catch {
      return null;
    }
  };

  const vipDevice =
    safeRegex(cfg?.vipDeviceRegex) ??
    /iPhone (12|13|14|15|16)|Galaxy S(22|23|24|25)|Fold|Flip|Pixel/i;
  const keyRegion =
    safeRegex(cfg?.keyRegions) ??
    /Nghệ An|Hà Tĩnh|Quảng Bình|Thanh Hóa|Quảng Ninh|Hải Phòng/i;

  let score = 45;
  if (vipDevice.test(data.device_model_name)) score += weightDevice;
  if (data.time_on_page_seconds >= vipTime) score += weightTimeOnPage;
  if (data.scroll_depth_percent >= vipScroll) score += weightScroll;
  if (keyRegion.test(data.form_city)) score += weightRegion;
  if (data.utm_source && data.utm_source !== "Direct") score += 5;
  if (
    data.focus_section === "luong_thuc_tap" ||
    data.copied_text_type === "chi_phi"
  ) {
    score += 5;
  }
  if (data.visits_today >= 2) score += weightReturnVisit;
  if (
    data.form_fill_duration_seconds > 0 &&
    data.form_fill_duration_seconds < fastFill
  ) {
    score -= weightFastFill;
  }
  score = Math.max(0, Math.min(100, score));

  const riskLevel: LeadRiskLevel =
    data.submission_count_same_visitor > 1 ||
    (locationMismatch && data.is_copy_paste) ||
    data.network_flags.includes("Tor") ||
    data.max_scroll_velocity > 8000
      ? "high"
      : data.form_fill_duration_seconds > 0 &&
          data.form_fill_duration_seconds < fastFill
        ? "review"
        : "low";

  return {
    score,
    rank:
      score >= 80
        ? "VIP"
        : score >= 65
          ? "Tiềm năng cao"
          : score >= 50
            ? "Tiềm năng"
            : "Cần nuôi dưỡng",
    riskLevel,
    reasons,
    recommendedAction:
      riskLevel === "high"
        ? "Xác minh thủ công trước khi gửi báo giá hoặc chuyển sale"
        : riskLevel === "review"
          ? "Ưu tiên xác minh qua Zalo trước khi gọi"
          : "Gọi tư vấn theo kịch bản phù hợp nhu cầu",
  };
}

const VIP_DEVICE_RE =
  /iPhone (12|13|14|15|16)|Galaxy S(22|23|24|25)|Fold|Flip|Pixel/i;
const KEY_REGION_RE =
  /Nghệ An|Hà Tĩnh|Quảng Bình|Thanh Hóa|Quảng Ninh|Hải Phòng/i;

/** Giờ Việt Nam (UTC+7) — dùng cho mọi nhánh thời gian bất kể múi giờ trình duyệt. */
function vietnamHour(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 7 * 3_600_000).getHours();
}

function applyTemplate(
  template: string,
  values: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function generateSaleAdvice(
  data: BehaviorData,
  assessment: LeadAssessment = scoreLead(data),
  templateOverride?: string,
): string {
  if (assessment.riskLevel === "unrated") {
    return `[INFO] [Chưa chấm AI] ${assessment.recommendedAction}.`;
  }
  if (assessment.riskLevel === "high") {
    const reasons = assessment.reasons.length
      ? assessment.reasons.join("; ")
      : "Lead có tín hiệu bất thường";
    return `[WARN] [Cần xác minh] ${reasons}. ${assessment.recommendedAction}.`;
  }
  if (assessment.riskLevel === "review") {
    const reasons = assessment.reasons.length
      ? assessment.reasons.join("; ")
      : "Cần xác minh thêm";
    return `[REVIEW] [Tín hiệu yếu] ${reasons}. ${assessment.recommendedAction}.`;
  }

  const advice: string[] = [];
  const isHighEndDevice = VIP_DEVICE_RE.test(data.device_model_name);
  const isKeyRegion = KEY_REGION_RE.test(data.form_city);
  const hour = vietnamHour();
  const isNightTime = hour >= 22 || hour <= 6;
  const nganh = data.nganh_hoc || "chưa chọn ngành";

  const faqAdvice: Record<string, [string, string]> = {
    hoc_phi: [
      "[TIP] [Lo ngại học phí] Khách mở câu hỏi về học phí 0Đ — cần xác minh niềm tin.",
      "[=>] Giải thích rõ nguồn tài trợ từ doanh nghiệp Trung Quốc, liệt kê chi phí thực tế (hồ sơ, vé, sinh hoạt) và nhấn mạnh không thu phí trung gian.",
    ],
    tieng_trung: [
      "[TIP] [Lo ngại ngôn ngữ] Khách quan tâm rào cản tiếng Trung và điều kiện đầu vào.",
      "[=>] Tư vấn ngắn, rõ: học từ 0, có lộ trình tiền HSK và hỗ trợ thích nghi trước khi bay.",
    ],
    luong_thuc_tap: [
      "[TIP] [Quan tâm thu nhập] Khách mở câu hỏi về lương thực tập — cần con số cụ thể.",
      `[=>] Nêu mức 15-30 triệu/tháng theo ngành ${nganh}, giải thích ca làm, ký túc xá miễn phí và khả năng gửi tiền về nhà.`,
    ],
    bang_cap: [
      "[TIP] [Quan tâm bằng cấp] Khách hỏi về giá trị bằng cấp và công nhận quốc tế.",
      "[=>] Nhấn mạnh bằng Cao đẳng chính quy, công nhận quốc tế, có thể ở lại làm việc hoặc học liên thông lên Đại học.",
    ],
    thoi_gian: [
      "[TIP] [Quan tâm thời gian] Khách hỏi về lịch trình nhập học — có nhu cầu đi sớm.",
      "[=>] Nêu 2 kỳ nhập học (tháng 3 và tháng 9), thời gian 3-5 tháng từ đăng ký đến bay, và thời điểm đăng ký lý tưởng.",
    ],
    nganh_hoc: [
      "[TIP] [Quan tâm ngành học] Khách hỏi ngành nào cần nhân lực nhất — đang phân vân lựa chọn.",
      "[=>] Giới thiệu 4 ngành hot nhất (ô tô điện, drone, IoT, logistics), so sánh thu nhập và cơ hội việc làm giữa các ngành.",
    ],
  };

  const faq = data.faq_clicked ? faqAdvice[data.faq_clicked] : undefined;

  if (
    isHighEndDevice &&
    data.time_on_page_seconds >= 80 &&
    data.scroll_depth_percent >= 70
  ) {
    advice.push(
      `[TIP] [Khách VIP] Thiết bị ${data.device_model_name}, đọc kỹ trang ${data.time_on_page_seconds} giây và cuộn ${data.scroll_depth_percent}%.`,
    );
    advice.push(
      `[=>] Tư vấn theo hướng phụ huynh quan tâm độ an toàn, lộ trình visa và đầu ra nghề nghiệp của ngành ${nganh}.`,
    );
  } else if (faq) {
    advice.push(faq[0]);
    advice.push(faq[1]);
  } else if (
    data.focus_section === "luong_thuc_tap" ||
    data.copied_text_type === "chi_phi" ||
    /cpc|paid|ads/i.test(data.utm_medium)
  ) {
    advice.push(
      "[TIP] [Khách quan tâm tài chính] Tập trung vào thu nhập, chi phí và khả năng tự chủ tài chính.",
    );
    advice.push(
      `[=>] Mở đầu bằng mức lương thực tập của ngành ${nganh}, rồi chốt bằng lộ trình học phí 0Đ và cơ hội việc làm sau tốt nghiệp.`,
    );
  } else if (data.focus_section === "nganh_hoc") {
    advice.push(
      "[TIP] [Đang xem ngành] Khách dừng lâu ở phần ngành học — đang so sánh lựa chọn.",
    );
    advice.push(
      `[=>] Giới thiệu ${nganh} trước, rồi so sánh với 1-2 ngành gần nhau về thu nhập và đầu ra để giúp khách chốt nhanh.`,
    );
  } else if (data.industry_switch_count > 1) {
    advice.push(
      `[TIP] [Phân vân ngành] Đã đổi ngành ${data.industry_switch_count} lần trước khi chốt ${nganh}.`,
    );
    advice.push(
      "[=>] Sale nên đóng vai hướng nghiệp, so sánh đầu ra, môi trường làm việc và thu nhập giữa 2-3 ngành gần nhau.",
    );
  } else if (data.time_on_page_seconds < 25) {
    advice.push(
      `[TIP] [Xem nhanh] Khách lướt nhanh bằng ${data.device_model_name}.`,
    );
    advice.push(
      "[=>] Ưu tiên gửi Zalo kèm ảnh thực tế/KTX trước, sau đó mới gọi điện chốt nhu cầu.",
    );
  } else {
    advice.push(
      `[TIP] [Tìm hiểu nghiêm túc] ${data.device_model_name}, mạng ${data.network_label}. Ngành quan tâm: ${nganh}.`,
    );
    advice.push(
      "[=>] Gọi tư vấn theo kịch bản khám phá mục tiêu học tập, tài chính và thời điểm nhập học phù hợp.",
    );
  }

  if (data.battery_level_percent != null && data.battery_level_percent <= 20) {
    advice.push(
      "[BATTERY] Khách đang dùng pin thấp — ưu tiên nhắn tin ngắn gọn, gửi tài liệu sau cuộc gọi.",
    );
  }
  if (data.is_in_app_browser) {
    advice.push(
      "[APP] Khách mở từ ứng dụng mạng xã hội — gửi lời chào ngay trên kênh đã tạo chuyển đổi và xin khung giờ tiện gọi.",
    );
  }
  if (data.time_to_first_interaction_seconds === 0) {
    advice.push(
      "[FAST] Khách tương tác ngay — mở đầu bằng câu hỏi mục tiêu: muốn chọn ngành, kiểm tra điều kiện hay nhận lộ trình chi phí.",
    );
  }

  if (data.hardware_concurrency != null && data.hardware_concurrency <= 2) {
    advice.push(
      `[NOTE] Thiết bị phần cứng yếu (${data.hardware_concurrency} nhân), ưu tiên nhắn Zalo thay vì gọi điện.`,
    );
  }
  if (data.time_to_first_interaction_seconds > 120) {
    advice.push(
      "[SLOW] Khách suy nghĩ khá lâu trước khi điền form, cần tư vấn chuyên sâu và tránh chốt vội.",
    );
  }
  if (isKeyRegion) {
    advice.push(
      `[GEO] Khách ở ${data.form_city}, nên nhắc tới cộng đồng học viên đồng hương và case thành công gần khu vực này.`,
    );
  }
  if (isNightTime) {
    advice.push(
      "[NIGHT] Lead đến vào đêm muộn, nên nhắn chào ngay nhưng hẹn gọi lại vào giờ hành chính hôm sau.",
    );
  }

  const finalAdvice = formatWebhookText(advice.join("\n"));
  if (templateOverride && templateOverride.trim()) {
    return applyTemplate(templateOverride, {
      rank: assessment.rank,
      risk: assessment.riskLevel,
      recommendation: assessment.recommendedAction,
      reasons: assessment.reasons.join("; "),
      details: finalAdvice,
      score: assessment.score,
      device: data.device_model_name || "thiết bị chưa rõ",
      city: data.form_city || data.location_city || "chưa rõ",
      major: data.nganh_hoc || "chưa rõ",
    }).trim();
  }

  return finalAdvice;
}

function formatWebhookText(value: string): string {
  return value
    .replaceAll("[TIP]", "💡")
    .replaceAll("[=>]", "➡️")
    .replaceAll("[WARN]", "⚠️")
    .replaceAll("[REVIEW]", "🔎")
    .replaceAll("[INFO]", "ℹ️")
    .replaceAll("[TIME]", "⏱️")
    .replaceAll("[SLOW]", "⏳")
    .replaceAll("[GEO]", "📍")
    .replaceAll("[NIGHT]", "🌙")
    .replaceAll("[MOUSE]", "🖱️")
    .replaceAll("[FORM]", "📝")
    .replaceAll("[SCROLL]", "📜")
    .replaceAll("[VISIT]", "👣")
    .replaceAll("[SWITCH]", "🔁")
    .replaceAll("[COPY]", "📋")
    .replaceAll("[UPDOWN]", "↕️")
    .replaceAll("[BOT]", "🤖")
    .replaceAll("[APP]", "📲")
    .replaceAll("[BATTERY]", "🔋")
    .replaceAll("[FAST]", "⚡")
    .replaceAll("[NOTE]", "📝");
}

function generateBehaviorSummary(
  data: BehaviorData,
  templateOverride?: string,
): string {
  const parts: string[] = [];
  parts.push(`[TIME] Thời gian xem trang: ${data.time_on_page_seconds} giây`);
  parts.push(
    `[MOUSE] Mất ${data.time_to_first_interaction_seconds || 0} giây để bắt đầu tương tác`,
  );
  parts.push(
    `[FORM] Điền form trong ${data.form_fill_duration_seconds || 0} giây`,
  );
  parts.push(`[SCROLL] Cuộn đọc ${data.scroll_depth_percent}% nội dung trang`);
  parts.push(
    `[VISIT] Lần truy cập thứ ${data.current_session} (hôm nay ${data.visits_today} lần, tháng này ${data.visits_month} lần)`,
  );
  if (data.industry_switch_count > 0)
    parts.push(
      `[SWITCH] Đã đổi ngành xem ${data.industry_switch_count} lần trước khi chốt`,
    );
  if (data.focus_section) {
    const sectionLabels: Record<string, string> = {
      luong_thuc_tap: "phần lương thực tập",
      nganh_hoc: "phần ngành học",
      hoc_phi: "phần học phí",
      bang_cap: "phần bằng cấp",
    };
    parts.push(
      `Dừng lâu ở ${sectionLabels[data.focus_section] || data.focus_section}`,
    );
  }
  const faqLabels: Record<string, string> = {
    hoc_phi: "học phí 0Đ",
    tieng_trung: "điều kiện tiếng Trung",
    luong_thuc_tap: "lương thực tập",
    bang_cap: "bằng cấp",
    thoi_gian: "thời gian nhập học",
    nganh_hoc: "chọn ngành",
  };
  if (data.faq_clicked)
    parts.push(
      `Đọc câu hỏi thường gặp về ${faqLabels[data.faq_clicked] || data.faq_clicked}`,
    );
  if (data.is_copy_paste) parts.push("[COPY] Có copy/paste số điện thoại");
  if (data.scroll_back_count > 10)
    parts.push(
      `[UPDOWN] Cuộn lên/xuống nhiều (${data.scroll_back_count} lần) — đang đọc kỹ`,
    );
  if (data.is_headless_browser)
    parts.push("[BOT] Phát hiện trình duyệt tự động (bot)");
  if (data.is_in_app_browser)
    parts.push("[APP] Mở trang trong app Facebook/TikTok/Zalo");

  const summary = formatWebhookText(
    parts.map((part) => `• ${part}`).join("\n"),
  );
  if (templateOverride && templateOverride.trim()) {
    return applyTemplate(templateOverride, {
      timeOnPage: `${data.time_on_page_seconds} giây`,
      firstInteraction: `${data.time_to_first_interaction_seconds || 0} giây`,
      formSpeed: `${data.form_fill_duration_seconds || 0} giây`,
      scrollDepth: `${data.scroll_depth_percent}%`,
      focusSection: data.focus_section || "chưa rõ",
      faq: data.faq_clicked || "không có",
      visitCounts: `${data.visits_today}/${data.visits_month}`,
      device: data.device_model_name || "thiết bị chưa rõ",
      network: data.network_label || "mạng chưa rõ",
      details: summary,
    }).trim();
  }

  return summary;
}

export function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part) => part && part !== "Unknown").join(" ");
}

function generateDeviceTechInfo(
  data: BehaviorData,
  templateOverride?: string,
): string {
  const hwInfo =
    data.device_memory != null && data.hardware_concurrency != null
      ? `RAM ~${data.device_memory}GB · ${data.hardware_concurrency} cores`
      : data.hardware_concurrency != null
        ? `${data.hardware_concurrency} cores`
        : "Phần cứng không chia sẻ";
  const os = joinParts([data.operating_system, data.operating_system_version]);
  const browser = joinParts([data.browser, data.browser_version]);
  const deviceName = joinParts([
    data.device_manufacturer,
    data.device_model_name,
  ]);
  const battery =
    data.battery_level_percent != null
      ? `🔋 Pin ${data.battery_level_percent}%${data.battery_charging ? " · đang sạc" : ""}`
      : "🔋 Pin không khả dụng";
  const mobileHardware =
    data.screen_width != null && data.screen_height != null
      ? `📐 Màn hình ${data.screen_width}×${data.screen_height}px · DPR ${data.pixel_ratio ?? "?"} · cảm ứng ${data.max_touch_points ?? 0} điểm`
      : "📐 Thông tin màn hình không khả dụng";

  const finalValue = [
    `📱 ${deviceName || "Thiết bị chưa nhận diện"}`,
    `🧩 ${os || "Hệ điều hành chưa rõ"}`,
    `🌐 ${browser || "Trình duyệt chưa rõ"}`,
    data.is_in_app_browser ? "📲 Mở trong app (FB/TikTok/Zalo)" : "",
    `📡 ${data.network_label}`,
    `💻 ${hwInfo}`,
    mobileHardware,
    battery,
  ]
    .filter(Boolean)
    .join("\n");

  if (templateOverride && templateOverride.trim()) {
    return applyTemplate(templateOverride, {
      device: deviceName || "Thiết bị chưa nhận diện",
      os: os || "Hệ điều hành chưa rõ",
      browser: browser || "Trình duyệt chưa rõ",
      network: data.network_label || "Mạng chưa rõ",
      battery,
      screen: mobileHardware,
      details: finalValue,
    }).trim();
  }

  return finalValue;
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  zalo: "Zalo",
  google: "Google",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  telegram: "Telegram",
  messenger: "Messenger",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  reddit: "Reddit",
  snapchat: "Snapchat",
  wechat: "WeChat",
  whatsapp: "WhatsApp",
  viber: "Viber",
};

function platformLabel(source: string): string {
  const key = source.toLowerCase().trim();
  return PLATFORM_LABELS[key] || source;
}

export function generateTrafficAdsSource(
  data: BehaviorData,
  fallbackSource = "",
  templateOverride?: string,
): string {
  const rawSource = (data.utm_source || fallbackSource || "").trim();
  const source = rawSource || (data.ttclid ? "TikTok" : "Direct");
  const hasCampaignData = Boolean(
    data.utm_medium ||
    data.utm_campaign ||
    data.utm_content ||
    data.utm_term ||
    data.ttclid,
  );

  if (!hasCampaignData && source.toLowerCase() === "direct") {
    return "🎯 Nguồn: Truy cập trực tiếp (không qua chiến dịch quảng cáo)";
  }

  const parts = [
    `Nguồn: ${platformLabel(source)}`,
    data.utm_medium && `Kênh: ${data.utm_medium}`,
    data.utm_campaign && `Chiến dịch: ${data.utm_campaign}`,
    data.utm_content && `Nội dung: ${data.utm_content}`,
    data.utm_term && `Từ khoá: ${data.utm_term}`,
    data.ttclid && `Mã TikTok: ${data.ttclid}`,
  ].filter(Boolean);

  const finalValue =
    parts.length > 0
      ? formatWebhookText(`🎯 ${parts.map((part) => `• ${part}`).join("\n")}`)
      : "🎯 Nguồn: Truy cập trực tiếp";

  if (templateOverride && templateOverride.trim()) {
    return applyTemplate(templateOverride, {
      source: platformLabel(source),
      medium: data.utm_medium || "không rõ",
      campaign: data.utm_campaign || "không rõ",
      content: data.utm_content || "không rõ",
      term: data.utm_term || "không rõ",
      ttclid: data.ttclid || "không có",
      details: finalValue,
    }).trim();
  }

  return finalValue;
}

export function buildVisitorBehaviorPayload(
  input: { city: string; major: string },
  cfg?: Parameters<typeof scoreLead>[1],
  fallbackSource = "",
  salesAdviceConfig?: {
    saleAdviceTemplate?: string;
    behaviorSummaryTemplate?: string;
    deviceTechInfoTemplate?: string;
    trafficAdsSourceTemplate?: string;
  },
): {
  behavior: BehaviorData;
  assessment: LeadAssessment;
  visitorBehaviorPayload: VisitorBehaviorPayload;
} {
  const behavior = collectBehavior(input);
  const assessment = scoreLead(behavior, cfg);
  const snapshot = getTrackingSnapshot();
  const saleAdvice = generateSaleAdvice(
    behavior,
    assessment,
    salesAdviceConfig?.saleAdviceTemplate,
  );
  const behaviorSummary = generateBehaviorSummary(
    behavior,
    salesAdviceConfig?.behaviorSummaryTemplate,
  );
  const deviceTechInfo = generateDeviceTechInfo(
    behavior,
    salesAdviceConfig?.deviceTechInfoTemplate,
  );
  const trafficAdsSource = generateTrafficAdsSource(
    behavior,
    fallbackSource,
    salesAdviceConfig?.trafficAdsSourceTemplate,
  );

  return {
    behavior,
    assessment,
    visitorBehaviorPayload: {
      submittedAt: new Date().toISOString(),
      device: snapshot.device,
      network: snapshot.network,
      attribution: snapshot.attribution,
      metrics: {
        ...snapshot.metrics,
        submissionCountSameVisitor: behavior.submission_count_same_visitor,
      },
      form: input,
      assessment,
      saleAdvice,
      behaviorSummary,
      deviceTechInfo,
      trafficAdsSource,
    },
  };
}
