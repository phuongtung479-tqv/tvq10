/**
 * Conversion tracking helpers.
 *
 * Nguồn duy nhất của base code pixel là src/components/RuntimeConfig.tsx,
 * nạp theo ID đã lưu trong config.tracking (Facebook / TikTok / GA4 / GTM).
 */

type AnyFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: AnyFn;
    ttq?: { track: AnyFn; page?: AnyFn; identify?: AnyFn };
    gtag?: AnyFn;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

/** Khách bắt đầu tương tác với ô input đầu tiên */
export function trackFormStart(enabled = true) {
  if (!enabled) return;
  trackInteraction("form_start");
}

export function trackInteraction(
  eventName: string,
  payload: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  const event = { event: eventName, ...payload };
  pushDataLayer(event);

  try {
    window.fbq?.("trackCustom", eventName, payload);
  } catch (e) {
    console.warn(`fbq ${eventName} failed`, e);
  }
  try {
    window.ttq?.track("ClickButton", { event_name: eventName, ...payload });
  } catch (e) {
    console.warn(`ttq ${eventName} failed`, e);
  }
  try {
    window.gtag?.("event", eventName, payload);
  } catch (e) {
    console.warn(`gtag ${eventName} failed`, e);
  }
}

/**
 * Chỉ gọi SAU khi dữ liệu đã gửi thành công.
 * `adsId` lấy trực tiếp từ config.tracking.ga4Id (một nguồn ID duy nhất);
 * chỉ bắn conversion Google Ads khi ID có dạng AW-xxx.
 */
export function trackLead(
  payload?: Record<string, unknown>,
  events?: { lead?: boolean; completeRegistration?: boolean },
  adsId?: string,
) {
  if (typeof window === "undefined") return;
  if (events?.lead === false) return;

  pushDataLayer({
    event: "lead_conversion",
    nganh_hoc: payload?.["content_name"] ?? "",
  });

  try {
    window.fbq?.("track", "Lead", payload);
  } catch (e) {
    console.warn("fbq lead failed", e);
  }

  try {
    if (events?.completeRegistration !== false) {
      window.ttq?.track("CompleteRegistration", payload);
    }
    window.ttq?.track("SubmitForm", payload);
  } catch (e) {
    console.warn("ttq event failed", e);
  }

  const sendTo = adsId?.trim();
  if (sendTo?.startsWith("AW-")) {
    try {
      window.gtag?.("event", "conversion", { send_to: sendTo });
    } catch (e) {
      console.warn("gtag conversion failed", e);
    }
  }
}

export interface TestEventLog {
  channel: string;
  ok: boolean;
  detail: string;
}

/**
 * Bắn một sự kiện thử tới tất cả kênh tracking đang hoạt động
 * và trả về nhật ký trạng thái để hiển thị trong Admin.
 */
export function fireTestEvent(): TestEventLog[] {
  const logs: TestEventLog[] = [];
  if (typeof window === "undefined") return logs;

  const payload = {
    test: true,
    content_name: "admin_test_event",
    value: 0,
    currency: "VND",
  };

  if (typeof window.fbq === "function") {
    try {
      window.fbq("trackCustom", "admin_test_event", payload);
      logs.push({
        channel: "Meta Pixel",
        ok: true,
        detail: "Đã gửi admin_test_event",
      });
    } catch (e) {
      logs.push({ channel: "Meta Pixel", ok: false, detail: String(e) });
    }
  } else {
    logs.push({
      channel: "Meta Pixel",
      ok: false,
      detail: "Chưa nạp (thiếu Pixel ID?)",
    });
  }

  if (window.ttq && typeof window.ttq.track === "function") {
    try {
      window.ttq.track("ClickButton", payload);
      logs.push({
        channel: "TikTok Pixel",
        ok: true,
        detail: "Đã gửi ClickButton",
      });
    } catch (e) {
      logs.push({ channel: "TikTok Pixel", ok: false, detail: String(e) });
    }
  } else {
    logs.push({
      channel: "TikTok Pixel",
      ok: false,
      detail: "Chưa nạp (thiếu Pixel ID?)",
    });
  }

  if (typeof window.gtag === "function") {
    try {
      window.gtag("event", "admin_test_event", payload);
      logs.push({
        channel: "Google Analytics 4",
        ok: true,
        detail: "Đã gửi admin_test_event",
      });
    } catch (e) {
      logs.push({
        channel: "Google Analytics 4",
        ok: false,
        detail: String(e),
      });
    }
  } else {
    logs.push({
      channel: "Google Analytics 4",
      ok: false,
      detail: "Chưa nạp (thiếu GA4 ID?)",
    });
  }

  if (Array.isArray(window.dataLayer)) {
    pushDataLayer({ event: "admin_test_event", ...payload });
    logs.push({
      channel: "GTM dataLayer",
      ok: true,
      detail: `${window.dataLayer.length} sự kiện trong hàng đợi`,
    });
  } else {
    logs.push({
      channel: "GTM dataLayer",
      ok: false,
      detail: "Chưa có dataLayer",
    });
  }

  const scripts = [
    "fb-pixel",
    "tiktok-pixel",
    "ga4-init",
    "gtm-init",
    "custom-head",
    "custom-body",
    "custom-footer",
  ].filter((id) => document.getElementById(id));
  logs.push({
    channel: "Mã đã chèn vào trang",
    ok: scripts.length > 0,
    detail: scripts.length ? scripts.join(", ") : "Chưa có mã nào được chèn",
  });

  return logs;
}
