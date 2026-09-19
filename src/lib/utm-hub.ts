/**
 * ============================================================================
 *  HUB UTM — CATCH-ALL (thu gom TẤT CẢ tham số trên URL)
 * ============================================================================
 *  Nguyên tắc:
 *   1. Không quét theo danh sách cố định. Duyệt TOÀN BỘ query string
 *      (window.location.search + query nằm sau dấu #) và gom mọi tham số
 *      — dù tên lạ tới đâu — vào một object duy nhất `params`.
 *   2. Giữ nguyên `raw_query` để kiểm tra thủ công sau này.
 *   3. Smart fallback: đoán nguồn từ tên/giá trị tham số (zar* -> zalo,
 *      fb* -> facebook, tt* -> tiktok, g/ms -> google/bing...), rồi tới
 *      referrer, rồi tới in-app browser (User-Agent).
 *      Nếu có tham số lạ mà không đoán được -> utm_source =
 *      "unknown_inapp_or_referral" kèm raw query.
 *   4. Lưu ngay vào sessionStorage (last-touch) + localStorage (first-touch),
 *      không bao giờ ghi đè giá trị hợp lệ bằng rỗng/"direct".
 *   5. Mọi thao tác bọc try/catch — module này không được phép làm crash UI.
 * ============================================================================
 */

export type AttributionModel = "first" | "last";

export interface UtmRecord {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  /** TẤT CẢ tham số thu gom được trên URL, giữ nguyên tên gốc */
  params: Record<string, string>;
  /** Các tham số click-id / tracking (đã loại utm_*) */
  click_ids: Record<string, string>;
  /** Query string thô, để kiểm tra thủ công */
  raw_query: string;
  landing_url: string;
  referrer: string;
  user_agent: string;
  /** "url" | "param:<tên>" | "referrer" | "in_app" | "unknown" | "direct" */
  detected_by: string;
  captured_at: string;
}

const FIRST_TOUCH_KEY = "lp_utm_first_v4";
const LAST_TOUCH_KEY = "lp_utm_last_v4";
/** Khoá cũ — vẫn đọc để không mất dữ liệu khách đã ghé trước đây */
const LEGACY_KEYS = ["lp_utm_first_v3", "lp_utm_v2"];
const memoryStore = new Map<string, UtmRecord>();

export const UNKNOWN_SOURCE = "unknown_inapp_or_referral";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * Smart fallback: mẫu nhận diện theo TÊN tham số (và cả giá trị).
 * Xếp theo thứ tự ưu tiên từ trên xuống.
 */
const PARAM_PATTERNS: Array<{
  test: RegExp;
  source: string;
  medium: string;
}> = [
  {
    test: /^(gclid|gbraid|wbraid|gad|gclsrc|s_kwcid)/i,
    source: "google",
    medium: "cpc",
  },
  { test: /^dclid/i, source: "google", medium: "display" },
  { test: /^msclkid/i, source: "bing", medium: "cpc" },
  { test: /^(fbclid|fb_|fbadid|fb$)/i, source: "facebook", medium: "social" },
  { test: /^(ttclid|tt_|ttadid|tiktok)/i, source: "tiktok", medium: "social" },
  { test: /^(zar|zalo|zl_|zns)/i, source: "zalo", medium: "social" },
  { test: /^(igshid|ig_|instagram)/i, source: "instagram", medium: "social" },
  { test: /^(twclid|tw_|twitter)/i, source: "twitter", medium: "social" },
  { test: /^(li_fat_id|li_|linkedin)/i, source: "linkedin", medium: "social" },
  { test: /^(epik|pin_|pinterest)/i, source: "pinterest", medium: "social" },
  { test: /^(sccid|scid|snap)/i, source: "snapchat", medium: "social" },
  { test: /^(shopee|sp_atk)/i, source: "shopee", medium: "referral" },
  { test: /^(yt_|youtube)/i, source: "youtube", medium: "social" },
  { test: /^(tg_|telegram)/i, source: "telegram", medium: "social" },
];

/** Từ khoá nhận diện trong GIÁ TRỊ tham số (ví dụ ?ref=zalo, ?src=fb) */
const VALUE_PATTERNS: Array<[RegExp, { source: string; medium: string }]> = [
  [/zalo|zns/i, { source: "zalo", medium: "social" }],
  [/facebook|fb\b|messenger/i, { source: "facebook", medium: "social" }],
  [/tiktok|douyin/i, { source: "tiktok", medium: "social" }],
  [/instagram|\big\b/i, { source: "instagram", medium: "social" }],
  [/google/i, { source: "google", medium: "cpc" }],
  [/youtube/i, { source: "youtube", medium: "social" }],
  [/shopee/i, { source: "shopee", medium: "referral" }],
  [/telegram/i, { source: "telegram", medium: "social" }],
];

const REFERRER_MAP: Array<[RegExp, string]> = [
  [/facebook\.com|fb\.me|fbcdn|m\.facebook|mbasic\.facebook/i, "facebook"],
  [/messenger\.com|fb\.com\/messages/i, "messenger"],
  [/tiktok\.com|t\.tiktok|bytedance/i, "tiktok"],
  [/zalo\.me|zaloapp|zalo\.com/i, "zalo"],
  [/google\./i, "google"],
  [/bing\.com/i, "bing"],
  [/coccoc\.com/i, "coccoc"],
  [/instagram\.com|instagr\.am/i, "instagram"],
  [/t\.co|twitter\.com|x\.com/i, "twitter"],
  [/t\.me|telegram\.org|telegram/i, "telegram"],
  [/youtube\.com|youtu\.be/i, "youtube"],
  [/linkedin\.com|lnkd\.in/i, "linkedin"],
  [/pinterest\.com|pin\.it/i, "pinterest"],
  [/reddit\.com/i, "reddit"],
  [/snapchat\.com/i, "snapchat"],
  [/shopee\./i, "shopee"],
  [/lazada\./i, "lazada"],
  [/wechat|weixin/i, "wechat"],
  [/whatsapp\.com/i, "whatsapp"],
  [/viber/i, "viber"],
  [/yahoo\.|duckduckgo\.com/i, "search"],
];

/** In-app browser (webview) -> nguồn */
const IN_APP_UA_MAP: Array<[RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB|FBIOS|FBDV|Facebook/i, "facebook"],
  [/Messenger|MessengerLite/i, "messenger"],
  [/Zalo|ZaloTheme/i, "zalo"],
  [/TikTok|BytedanceWebview|musical_ly|Trill/i, "tiktok"],
  [/Instagram/i, "instagram"],
  [/Shopee/i, "shopee"],
  [/Line\//i, "line"],
  [/MicroMessenger/i, "wechat"],
  [/Telegram/i, "telegram"],
  [/Viber/i, "viber"],
  [/Twitter|TwitterAndroid/i, "twitter"],
  [/LinkedInApp/i, "linkedin"],
  [/Snapchat/i, "snapchat"],
  [/Pinterest/i, "pinterest"],
];

const EMPTY_RECORD: UtmRecord = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  params: {},
  click_ids: {},
  raw_query: "",
  landing_url: "",
  referrer: "",
  user_agent: "",
  detected_by: "",
  captured_at: "",
};

const PLACEHOLDER_VALUES = new Set([
  "",
  "direct",
  "none",
  "null",
  "undefined",
  "(direct)",
  "(none)",
  "unknown",
]);

/** Tham số điều hướng nội bộ — không coi là tín hiệu nguồn */
const IGNORED_PARAMS =
  /^(page|p|q|search|tab|id|sort|filter|lang|locale|_rsc)$/i;

function isBrowser() {
  return typeof window !== "undefined";
}

function isMeaningful(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !PLACEHOLDER_VALUES.has(value.trim().toLowerCase())
  );
}

function clean(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, 500);
  return isMeaningful(trimmed) ? trimmed : "";
}

function safeRead(kind: "local" | "session", key: string): UtmRecord | null {
  if (!isBrowser()) return null;
  const memoryValue = memoryStore.get(`${kind}:${key}`);
  if (memoryValue) return memoryValue;
  try {
    const storage =
      kind === "local" ? window.localStorage : window.sessionStorage;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UtmRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    const value: UtmRecord = {
      ...EMPTY_RECORD,
      ...parsed,
      params:
        parsed.params && typeof parsed.params === "object" ? parsed.params : {},
      click_ids:
        parsed.click_ids && typeof parsed.click_ids === "object"
          ? parsed.click_ids
          : {},
    };
    memoryStore.set(`${kind}:${key}`, value);
    return value;
  } catch {
    return null;
  }
}

function safeWrite(kind: "local" | "session", key: string, value: UtmRecord) {
  if (!isBrowser()) return;
  memoryStore.set(`${kind}:${key}`, value);
  try {
    const storage =
      kind === "local" ? window.localStorage : window.sessionStorage;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be blocked; the in-memory fallback remains available */
  }
}

export function detectReferrerSource(referrer: string): string {
  if (!referrer) return "";
  try {
    for (const [regex, name] of REFERRER_MAP) {
      if (regex.test(referrer)) return name;
    }
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host) return "referral";
    if (isBrowser() && host === window.location.hostname) return "";
    return host;
  } catch {
    return "referral";
  }
}

export function detectInAppSource(userAgent?: string): string {
  const ua = userAgent ?? (isBrowser() ? navigator.userAgent : "");
  if (!ua) return "";
  try {
    for (const [regex, name] of IN_APP_UA_MAP) {
      if (regex.test(ua)) return name;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * CATCH-ALL COLLECTOR — duyệt mọi tham số trên URL, không bỏ sót cái nào.
 * Trả về object { tên_tham_số: giá_trị } + chuỗi query thô.
 */
export function collectAllQueryParams(): {
  params: Record<string, string>;
  rawQuery: string;
} {
  const params: Record<string, string> = {};
  let rawQuery = "";
  if (!isBrowser()) return { params, rawQuery };
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
    rawQuery = [search.replace(/^\?/, ""), hashQuery.replace(/^\?/, "")]
      .filter(Boolean)
      .join("&")
      .slice(0, 2000);

    const absorb = (qs: string) => {
      try {
        new URLSearchParams(qs).forEach((value, key) => {
          const name = String(key).trim().slice(0, 100);
          if (!name) return;
          if (name in params) return;
          params[name] = String(value ?? "")
            .trim()
            .slice(0, 500);
        });
      } catch {
        /* query dị dạng — thử tách thủ công */
        for (const pair of qs.split("&")) {
          if (!pair) continue;
          const idx = pair.indexOf("=");
          const key = (idx >= 0 ? pair.slice(0, idx) : pair).slice(0, 100);
          const value = idx >= 0 ? pair.slice(idx + 1).slice(0, 500) : "";
          if (key && !(key in params)) {
            try {
              params[decodeURIComponent(key)] = decodeURIComponent(value);
            } catch {
              params[key] = value;
            }
          }
        }
      }
    };
    absorb(search.replace(/^\?/, ""));
    absorb(hashQuery.replace(/^\?/, ""));
  } catch {
    /* URL lạ từ in-app browser — không bao giờ throw */
  }
  return { params, rawQuery };
}

/** Bóc tách toàn bộ tín hiệu attribution trên URL hiện tại */
export function parseCurrentUrl(): UtmRecord {
  if (!isBrowser()) return { ...EMPTY_RECORD, params: {}, click_ids: {} };
  const record: UtmRecord = {
    ...EMPTY_RECORD,
    params: {},
    click_ids: {},
    captured_at: new Date().toISOString(),
  };
  try {
    const { params, rawQuery } = collectAllQueryParams();
    record.params = params;
    record.raw_query = rawQuery;
    record.referrer = document.referrer || "";
    record.user_agent = navigator.userAgent || "";
    record.landing_url = (window.location.href || "").split("#")[0] ?? "";

    // 1) UTM chuẩn (không phân biệt hoa thường)
    const lowerMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      lowerMap[key.toLowerCase()] = value;
      if (
        !/^utm_/i.test(key) &&
        !IGNORED_PARAMS.test(key) &&
        value !== undefined
      ) {
        record.click_ids[key] = value;
      }
    }
    for (const key of UTM_KEYS) record[key] = clean(lowerMap[key]);

    if (record.utm_source) {
      record.detected_by = "url";
    }

    // 2) Smart fallback theo TÊN tham số lạ
    if (!record.utm_source) {
      for (const [key] of Object.entries(record.click_ids)) {
        const hit = PARAM_PATTERNS.find((p) => p.test.test(key));
        if (hit) {
          record.utm_source = hit.source;
          record.utm_medium = record.utm_medium || hit.medium;
          record.detected_by = `param:${key}`;
          break;
        }
      }
    }

    // 3) Smart fallback theo GIÁ TRỊ tham số (?ref=zalo, ?src=fb ...)
    if (!record.utm_source) {
      for (const [key, value] of Object.entries(record.click_ids)) {
        if (!value) continue;
        const hit = VALUE_PATTERNS.find(([regex]) => regex.test(value));
        if (hit) {
          record.utm_source = hit[1].source;
          record.utm_medium = record.utm_medium || hit[1].medium;
          record.detected_by = `param:${key}`;
          break;
        }
      }
    }

    // 4) Referrer
    if (!record.utm_source) {
      const fromReferrer = detectReferrerSource(record.referrer);
      if (fromReferrer) {
        record.utm_source = fromReferrer;
        record.utm_medium = record.utm_medium || "referral";
        record.detected_by = "referrer";
      }
    }

    // 5) In-app browser (webview thường không có referrer)
    if (!record.utm_source) {
      const inApp = detectInAppSource(record.user_agent);
      if (inApp) {
        record.utm_source = inApp;
        record.utm_medium = record.utm_medium || "social";
        record.detected_by = "in_app";
      }
    }

    // 6) Có tham số lạ nhưng không đoán được danh tính
    if (!record.utm_source && Object.keys(record.click_ids).length > 0) {
      record.utm_source = UNKNOWN_SOURCE;
      record.utm_medium = record.utm_medium || "unknown";
      record.detected_by = "unknown";
    }
  } catch {
    /* không bao giờ throw ra ngoài */
  }
  return record;
}

/** Trộn bản ghi mới vào bản ghi cũ — chỉ ghi đè bằng giá trị CÓ nghĩa */
function merge(base: UtmRecord | null, next: UtmRecord): UtmRecord {
  const prev = base ?? { ...EMPTY_RECORD, params: {}, click_ids: {} };
  const out: UtmRecord = {
    ...prev,
    params: { ...prev.params, ...next.params },
    click_ids: { ...prev.click_ids, ...next.click_ids },
  };
  for (const key of UTM_KEYS) {
    if (next[key]) out[key] = next[key];
  }
  if (next.raw_query) out.raw_query = next.raw_query;
  if (next.landing_url && !prev.landing_url) out.landing_url = next.landing_url;
  if (next.referrer && !prev.referrer) out.referrer = next.referrer;
  if (next.user_agent) out.user_agent = next.user_agent;
  if (next.utm_source && next.detected_by) out.detected_by = next.detected_by;
  out.captured_at = next.captured_at || prev.captured_at;
  return out;
}

/** Đọc dữ liệu từ các phiên bản lưu trữ cũ để không mất nguồn */
let cached: { first: UtmRecord; last: UtmRecord } | null = null;

function hasSignal(record: UtmRecord) {
  return Boolean(
    record.utm_source ||
    record.utm_campaign ||
    Object.keys(record.click_ids).length > 0,
  );
}

/**
 * Đọc URL, thu gom, lưu first-touch (localStorage) + last-touch (sessionStorage).
 * Gọi bao nhiêu lần cũng an toàn.
 */
export function captureUtm(force = false): {
  first: UtmRecord;
  last: UtmRecord;
} {
  const blank = () => ({
    first: { ...EMPTY_RECORD, params: {}, click_ids: {} },
    last: { ...EMPTY_RECORD, params: {}, click_ids: {} },
  });
  if (!isBrowser()) return blank();
  if (cached && !force) return cached;
  try {
    const current = parseCurrentUrl();
    const storedFirst = safeRead("local", FIRST_TOUCH_KEY);
    const storedLast = safeRead("session", LAST_TOUCH_KEY);

    // First-touch: giữ nguyên nguồn gốc, chỉ bổ sung ô còn trống
    const first = storedFirst
      ? merge(storedFirst, {
          ...current,
          utm_source: storedFirst.utm_source ? "" : current.utm_source,
          utm_medium: storedFirst.utm_medium ? "" : current.utm_medium,
          utm_campaign: storedFirst.utm_campaign ? "" : current.utm_campaign,
          utm_content: storedFirst.utm_content ? "" : current.utm_content,
          utm_term: storedFirst.utm_term ? "" : current.utm_term,
        })
      : current;

    // Last-touch: chỉ cập nhật khi lần tải này thật sự có tham số mới
    const newSignal =
      Object.keys(current.click_ids).length > 0 || !!current.raw_query;
    const last = newSignal
      ? merge(storedLast, current)
      : storedLast && storedLast.utm_source
        ? storedLast
        : merge(storedLast, current);

    if (hasSignal(first)) safeWrite("local", FIRST_TOUCH_KEY, first);
    // Luôn ghi last-touch vào sessionStorage ngay khi trang tải
    safeWrite("session", LAST_TOUCH_KEY, last);

    cached = { first, last };
    return cached;
  } catch {
    const fallback = blank();
    cached = fallback;
    return fallback;
  }
}

/** Dữ liệu UTM đã chuẩn hoá (mặc định: last-touch) */
export function getUtm(model: AttributionModel = "last"): UtmRecord {
  const { first, last } = captureUtm();
  const primary = model === "first" ? first : last;
  const backup = model === "first" ? last : first;
  return {
    ...primary,
    utm_source: primary.utm_source || backup.utm_source,
    utm_medium: primary.utm_medium || backup.utm_medium,
    utm_campaign: primary.utm_campaign || backup.utm_campaign,
    utm_content: primary.utm_content || backup.utm_content,
    utm_term: primary.utm_term || backup.utm_term,
    params: { ...backup.params, ...primary.params },
    click_ids: { ...backup.click_ids, ...primary.click_ids },
    raw_query: primary.raw_query || backup.raw_query,
    landing_url: primary.landing_url || backup.landing_url,
    referrer: primary.referrer || backup.referrer,
    user_agent: primary.user_agent || backup.user_agent,
    detected_by: primary.detected_by || backup.detected_by || "direct",
  };
}

/** Nguồn gọn: luôn trả về chuỗi dùng được */
export function getUtmSource(model: AttributionModel = "last"): string {
  return getUtm(model).utm_source || "direct";
}

/**
 * Payload phẳng, sạch để đính vào form / webhook.
 * Bao gồm TẤT CẢ tham số thu gom được (tên gốc giữ nguyên) + raw query.
 */
export function getUtmPayload(
  model: AttributionModel = "last",
): Record<string, string> {
  const utm = getUtm(model);
  const payload: Record<string, string> = {};
  // Mọi tham số lạ đi kèm, giữ nguyên tên
  for (const [key, value] of Object.entries(utm.click_ids)) {
    if (typeof value === "string") payload[key] = value;
  }
  payload["utm_source"] = utm.utm_source || "direct";
  payload["utm_medium"] = utm.utm_medium;
  payload["utm_campaign"] = utm.utm_campaign;
  payload["utm_content"] = utm.utm_content;
  payload["utm_term"] = utm.utm_term;
  payload["raw_query"] = utm.raw_query;
  payload["landing_url"] = utm.landing_url;
  payload["referrer"] = utm.referrer;
  payload["attribution_model"] = model;
  payload["attribution_detected_by"] = utm.detected_by;
  // Giữ tương thích: click-id phổ biến luôn tồn tại
  payload["fbclid"] = payload["fbclid"] || "";
  payload["ttclid"] = payload["ttclid"] || "";
  payload["gclid"] = payload["gclid"] || "";
  return payload;
}

/** Gắn UTM vào payload gửi đi mà không ghi đè giá trị đã có nghĩa */
export function withUtm<T extends Record<string, unknown>>(
  payload: T,
  model: AttributionModel = "last",
): T & Record<string, string> {
  const utm = getUtmPayload(model);
  const merged: Record<string, unknown> = { ...utm };
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === "") {
      if (!(key in merged)) merged[key] = value;
      continue;
    }
    merged[key] = value;
  }
  return merged as T & Record<string, string>;
}

/** Xoá toàn bộ dữ liệu attribution (dùng cho Admin / test) */
export function resetUtm() {
  cached = null;
  if (!isBrowser()) return;
  memoryStore.delete(`local:${FIRST_TOUCH_KEY}`);
  memoryStore.delete(`session:${LAST_TOUCH_KEY}`);
  try {
    window.localStorage.removeItem(FIRST_TOUCH_KEY);
    window.sessionStorage.removeItem(LAST_TOUCH_KEY);
    for (const key of LEGACY_KEYS) {
      memoryStore.delete(`local:${key}`);
      window.localStorage.removeItem(key);
    }
  } catch {
    /* storage may be blocked */
  }
}
