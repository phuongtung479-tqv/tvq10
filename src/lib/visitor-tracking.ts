import { useSyncExternalStore } from "react";

import { getUtm } from "@/lib/utm-hub";

import type {
  BehaviorData,
  DeviceKind,
  DeviceProfile,
  NetworkInfo,
  TrackingSnapshot,
  TrackingStorageMode,
  TrafficAttribution,
  VisitorMetrics,
  VisitorSessionCounts,
} from "@/types/visitor-tracking";

const VISITOR_ID_KEY = "lp_visitor_id_v2";
const ATTRIBUTION_KEY = "lp_utm_v2";
const COUNTERS_KEY = "lp_visit_counters_v2";
const SUBMISSION_KEY = "lp_submission_counters_v2";
const SESSION_MARKER_KEY = "lp_session_marker_v2";
const VISITOR_SESSION_TABLE = "visitor_sessions";
const NETWORK_TIMEOUT_MS = 3500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const runtimeStorage = new Map<string, unknown>();

export interface VisitorTrackingInitOptions {
  storageMode?: TrackingStorageMode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  variant?: "A" | "B";
}

type RuntimeState = {
  initialized: boolean;
  startedAt: number;
  firstInteractionAt: number;
  formStartedAt: number;
  maxScrollPercent: number;
  industrySwitchCount: number;
  faqClicked: string;
  copiedTextType: string;
  isCopyPaste: boolean;
  scrollVelocity: number;
  maxScrollVelocity: number;
  scrollBackCount: number;
  lastScrollY: number;
  lastScrollTime: number;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  batteryLevelPercent: number | null;
  batteryCharging: boolean | null;
  screenWidth: number | null;
  screenHeight: number | null;
  pixelRatio: number | null;
  maxTouchPoints: number | null;
  sectionTime: Record<string, number>;
  visibleSections: Record<string, number>;
  visitorId: string;
  sessionId: string;
  device: DeviceProfile;
  network: NetworkInfo;
  attribution: TrafficAttribution;
  sessionCounts: VisitorSessionCounts;
  options: VisitorTrackingInitOptions;
  cleanup?: () => void;
};

const defaultDevice: DeviceProfile = {
  userAgent: "",
  manufacturer: "Unknown",
  family: "Unknown",
  model: "Unknown",
  kind: "unknown",
  osName: "Unknown",
  osVersion: "",
  os: "Unknown",
  browserName: "Unknown",
  browserVersion: "",
  browser: "Unknown",
  isInAppBrowser: false,
};

const defaultNetwork: NetworkInfo = {
  ip: "",
  city: "",
  region: "",
  country: "Việt Nam",
  isp: "",
  organization: "",
  provider: "",
  connectionType: "",
  connectionLabel: "Mạng băng thông rộng",
  fallbackLabel: "Mạng băng thông rộng · Việt Nam",
  displayLabel: "Mạng băng thông rộng · Việt Nam",
  flags: [],
  lookupStatus: "idle",
};

const defaultAttribution: TrafficAttribution = {
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  ttclid: "",
  landingUrl: "",
};

const runtime: RuntimeState = {
  initialized: false,
  startedAt: 0,
  firstInteractionAt: 0,
  formStartedAt: 0,
  maxScrollPercent: 0,
  industrySwitchCount: 0,
  faqClicked: "",
  copiedTextType: "",
  isCopyPaste: false,
  scrollVelocity: 0,
  maxScrollVelocity: 0,
  scrollBackCount: 0,
  lastScrollY: 0,
  lastScrollTime: 0,
  deviceMemory: null,
  hardwareConcurrency: null,
  batteryLevelPercent: null,
  batteryCharging: null,
  screenWidth: null,
  screenHeight: null,
  pixelRatio: null,
  maxTouchPoints: null,
  sectionTime: {},
  visibleSections: {},
  visitorId: "",
  sessionId: "",
  device: defaultDevice,
  network: defaultNetwork,
  attribution: defaultAttribution,
  sessionCounts: { currentSession: 1, today: 0, month: 0 },
  options: {},
};

const listeners = new Set<() => void>();
let snapshotVersion = 0;

function isBrowser() {
  return typeof window !== "undefined";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  snapshotVersion += 1;
  listeners.forEach((listener) => listener());
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* Fall back to in-memory storage when browser storage is blocked. */
  }
  return (runtimeStorage.get(key) as T | undefined) ?? fallback;
}

function writeJSON(key: string, value: unknown) {
  if (!isBrowser()) return;
  runtimeStorage.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private/in-app browsers may block localStorage. */
  }
}

function readSessionMarker() {
  if (!isBrowser()) return "";
  try {
    const raw = window.sessionStorage.getItem(SESSION_MARKER_KEY) || "";
    const [sessionId, timestamp] = raw.split("|");
    if (
      sessionId &&
      Number.isFinite(Number(timestamp)) &&
      Date.now() - Number(timestamp) < SESSION_TIMEOUT_MS
    ) {
      return sessionId;
    }
    window.sessionStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    return String(runtimeStorage.get(SESSION_MARKER_KEY) || "");
  }
  return "";
}

function writeSessionMarker(value: string) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(SESSION_MARKER_KEY, `${value}|${Date.now()}`);
  } catch {
    /* Private/in-app browsers may block sessionStorage. */
  }
  runtimeStorage.set(SESSION_MARKER_KEY, value);
}

function makeId(prefix: string) {
  if (!isBrowser()) return `${prefix}-ssr`;
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(2)))
    .map((value) => value.toString(16))
    .join("");
  return `${prefix}-${Date.now()}-${seed}`;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function connectionTypeLabel(value: string) {
  switch (value.toUpperCase()) {
    case "5G":
      return "Mạng di động 5G";
    case "4G":
      return "Mạng di động 4G";
    case "3G":
      return "Mạng di động 3G";
    case "2G":
      return "Mạng di động 2G";
    case "SLOW-2G":
      return "Mạng di động chậm";
    default:
      return "Mạng băng thông rộng";
  }
}

function buildFallbackNetworkLabel(
  connectionType: string,
  country = "Việt Nam",
) {
  return `${connectionTypeLabel(connectionType)} · ${country}`;
}

function compactLocation(parts: Array<string | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildNetworkDisplay(info: Partial<NetworkInfo>) {
  const location = compactLocation([info.city, info.region, info.country]);
  if (info.provider && location) return `${info.provider} · ${location}`;
  if (info.provider) return `${info.provider} · Việt Nam`;
  if (location)
    return `${info.connectionLabel || "Mạng băng thông rộng"} · ${location}`;
  return info.fallbackLabel || "Mạng băng thông rộng · Việt Nam";
}

function detectConnectionType() {
  if (!isBrowser()) return "";
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string };
  };
  const effective = nav.connection?.effectiveType || nav.connection?.type || "";
  return effective.toUpperCase();
}

function parseVersion(input: string | undefined) {
  return (input || "").replace(/_/g, ".").trim();
}

function prettifyToken(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .trim();
}

function inferDeviceKind(ua: string): DeviceKind {
  if (/iPad|Tablet|Nexus 7|SM-T|Tab/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|Mobile/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}

function mapIPhoneModelByViewport() {
  if (!isBrowser()) return { family: "iPhone", model: "iPhone" };
  const width = Math.max(window.screen.width, window.screen.height);
  if (width >= 932)
    return { family: "iPhone Pro Max", model: "iPhone 15/16 Pro Max" };
  if (width >= 926)
    return { family: "iPhone Pro Max", model: "iPhone 12/13/14 Pro Max" };
  if (width >= 896) return { family: "iPhone", model: "iPhone XR/11/XS Max" };
  if (width >= 852)
    return { family: "iPhone Pro", model: "iPhone 14/15/16 Pro" };
  if (width >= 844) return { family: "iPhone", model: "iPhone 12/13/14" };
  if (width >= 812) return { family: "iPhone", model: "iPhone X/XS/11 Pro" };
  return { family: "iPhone", model: "iPhone SE/8/Plus" };
}

function inferAndroidManufacturer(token: string, ua: string) {
  const source = `${token} ${ua}`;
  if (/SM-|Galaxy|Samsung/i.test(source)) return "Samsung";
  if (/Pixel/i.test(source)) return "Google";
  if (/M210|M20\d|Redmi|Mi |Xiaomi|POCO/i.test(source)) return "Xiaomi";
  if (/CPH|PHT|PAHM|OPPO/i.test(source)) return "OPPO";
  if (/V2\d|VIVO/i.test(source)) return "Vivo";
  if (/RMX|realme/i.test(source)) return "realme";
  if (/HUAWEI|ANA-|ELS-|JAD-|BLA-/i.test(source)) return "Huawei";
  if (/TECNO|Infinix/i.test(source))
    return /TECNO/i.test(source) ? "TECNO" : "Infinix";
  return "Android";
}

function parseAndroidModel(ua: string) {
  const match = ua.match(/Android\s[\d.]+;\s*([^;)]+?)(?:\sBuild\/|;|\))/i);
  const rawModel = prettifyToken(match?.[1] || "Android");
  const manufacturer = inferAndroidManufacturer(rawModel, ua);
  const family =
    rawModel.split(" ").slice(0, 2).join(" ").trim() || manufacturer;
  return { manufacturer, family, model: rawModel };
}

function detectDeviceProfile(): DeviceProfile {
  if (!isBrowser()) return defaultDevice;
  const ua = navigator.userAgent || "";
  const kind = inferDeviceKind(ua);

  let osName = "Unknown";
  let osVersion = "";
  if (/Windows NT/i.test(ua)) {
    osName = "Windows";
    osVersion = parseVersion(ua.match(/Windows NT ([\d.]+)/i)?.[1]);
  } else if (/Android/i.test(ua)) {
    osName = "Android";
    osVersion = parseVersion(ua.match(/Android ([\d.]+)/i)?.[1]);
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    osName = /iPad/i.test(ua) ? "iPadOS" : "iOS";
    osVersion = parseVersion(ua.match(/OS ([\d_]+)/i)?.[1]);
  } else if (/Mac OS X/i.test(ua)) {
    osName = "macOS";
    osVersion = parseVersion(ua.match(/Mac OS X ([\d_]+)/i)?.[1]);
  } else if (/Linux/i.test(ua)) {
    osName = "Linux";
  }

  const browserMatchers: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/i, "Edge"],
    [/OPR\/([\d.]+)/i, "Opera"],
    [/Chrome\/([\d.]+)/i, "Chrome"],
    [/Version\/([\d.]+).*Safari/i, "Safari"],
    [/Firefox\/([\d.]+)/i, "Firefox"],
  ];
  let browserName = "Unknown";
  let browserVersion = "";
  for (const [matcher, name] of browserMatchers) {
    const match = ua.match(matcher);
    if (match) {
      browserName = name;
      browserVersion = match[1] || "";
      break;
    }
  }
  if (/FBAN|FBAV/i.test(ua)) browserName = "Facebook In-App";
  if (/TikTok|BytedanceWebview/i.test(ua)) browserName = "TikTok In-App";
  if (/Zalo/i.test(ua)) browserName = "Zalo In-App";
  const isInAppBrowser = /FBAN|FBAV|TikTok|BytedanceWebview|Zalo/i.test(ua);

  let manufacturer = "Unknown";
  let family = osName;
  let model = osName;
  if (/Android/i.test(ua)) {
    const parsed = parseAndroidModel(ua);
    manufacturer = parsed.manufacturer;
    family = parsed.family;
    model = parsed.model;
  } else if (/iPhone/i.test(ua)) {
    const parsed = mapIPhoneModelByViewport();
    manufacturer = "Apple";
    family = parsed.family;
    model = parsed.model;
  } else if (/iPad/i.test(ua)) {
    manufacturer = "Apple";
    family = "iPad";
    model = "iPad";
  } else if (/Mac/i.test(ua)) {
    manufacturer = "Apple";
    family = "Mac";
    model = "Mac";
  } else if (/Windows/i.test(ua)) {
    manufacturer = "Microsoft / OEM";
    family = "Windows PC";
    model = "PC Windows";
  }

  return {
    userAgent: ua,
    manufacturer,
    family,
    model,
    kind,
    osName,
    osVersion,
    os: [osName, osVersion].filter(Boolean).join(" "),
    browserName,
    browserVersion,
    browser: [browserName, browserVersion].filter(Boolean).join(" "),
    isInAppBrowser,
  };
}

function detectHeadlessBrowser() {
  if (!isBrowser()) return false;
  const nav = navigator as Navigator & { webdriver?: boolean };
  let score = 0;
  if (nav.webdriver) score += 1;
  if (
    /HeadlessChrome|Puppeteer|Playwright|PhantomJS/i.test(navigator.userAgent)
  )
    score += 1;
  if (navigator.languages && navigator.languages.length === 0) score += 1;
  if (window.outerWidth === 0 && window.outerHeight === 0) score += 1;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : "";
      if (/SwiftShader|llvmpipe|Headless|VirtualBox/i.test(String(renderer)))
        score += 1;
    }
  } catch {
    /* ignore */
  }
  try {
    if (!(navigator as Navigator & { permissions?: unknown }).permissions)
      score += 1;
  } catch {
    /* ignore */
  }
  return score >= 2;
}

function getVisitorId() {
  if (!isBrowser()) return "visitor-ssr";
  const stored = runtimeStorage.get(VISITOR_ID_KEY);
  if (typeof stored === "string" && stored) return stored;
  const next = makeId("visitor");
  runtimeStorage.set(VISITOR_ID_KEY, next);
  return next;
}

/**
 * Attribution lấy từ Hub UTM (src/lib/utm-hub.ts) — nơi duy nhất đọc URL,
 * quy đổi mã nền tảng và lưu first-touch/last-touch.
 */
function readAttribution(): TrafficAttribution {
  if (!isBrowser()) return defaultAttribution;
  try {
    const utm = getUtm("last");
    return {
      source: utm.utm_source,
      medium: utm.utm_medium,
      campaign: utm.utm_campaign,
      content: utm.utm_content,
      term: utm.utm_term,
      ttclid: utm.click_ids["ttclid"] || "",
      landingUrl:
        utm.landing_url ||
        (window.location.href.split("#")[0] ?? window.location.href),
    };
  } catch {
    return defaultAttribution;
  }
}

function computeMetrics(): VisitorMetrics {
  const now = isBrowser() ? Date.now() : runtime.startedAt;
  const timeOnPageSeconds = runtime.startedAt
    ? Math.max(0, Math.round((now - runtime.startedAt) / 1000))
    : 0;
  const timeToFirstInteractionSeconds = runtime.firstInteractionAt
    ? Math.max(
        0,
        Math.round((runtime.firstInteractionAt - runtime.startedAt) / 1000),
      )
    : 0;
  const formFillDurationSeconds = runtime.formStartedAt
    ? Math.max(0, Math.round((now - runtime.formStartedAt) / 1000))
    : 0;
  const focusSection =
    Object.entries(runtime.sectionTime).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "";

  return {
    timeOnPageSeconds,
    timeToFirstInteractionSeconds,
    formFillDurationSeconds,
    scrollDepthPercent: runtime.maxScrollPercent,
    scrollVelocity: runtime.scrollVelocity,
    maxScrollVelocity: runtime.maxScrollVelocity,
    scrollBackCount: runtime.scrollBackCount,
    industrySwitchCount: Math.max(0, runtime.industrySwitchCount - 1),
    focusSection,
    faqClicked: runtime.faqClicked,
    copiedTextType: runtime.copiedTextType,
    isCopyPaste: runtime.isCopyPaste,
    isHeadlessBrowser: detectHeadlessBrowser(),
    submissionCountSameVisitor: 0,
    deviceMemory: runtime.deviceMemory,
    hardwareConcurrency: runtime.hardwareConcurrency,
    batteryLevelPercent: runtime.batteryLevelPercent,
    batteryCharging: runtime.batteryCharging,
    screenWidth: runtime.screenWidth,
    screenHeight: runtime.screenHeight,
    pixelRatio: runtime.pixelRatio,
    maxTouchPoints: runtime.maxTouchPoints,
    sessionCounts: runtime.sessionCounts,
  };
}

function buildSnapshot(): TrackingSnapshot {
  return {
    device: runtime.device,
    network: runtime.network,
    attribution: runtime.attribution,
    metrics: computeMetrics(),
    visitorId: runtime.visitorId,
    sessionId: runtime.sessionId,
    initialized: runtime.initialized,
  };
}

let cachedSnapshot: TrackingSnapshot | null = null;
let cachedVersion = -1;

function getSnapshot(): TrackingSnapshot {
  if (!cachedSnapshot || cachedVersion !== snapshotVersion) {
    cachedSnapshot = buildSnapshot();
    cachedVersion = snapshotVersion;
  }
  return cachedSnapshot;
}

let serverSnapshot: TrackingSnapshot | null = null;

function getServerSnapshot(): TrackingSnapshot {
  serverSnapshot ??= buildSnapshot();
  return serverSnapshot;
}

export function useVisitorTrackingSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function updateSnapshot() {
  emit();
}

function readLocalSessionCounts(isNewSession: boolean): VisitorSessionCounts {
  const stored = readJSON<{
    day: { key: string; count: number };
    month: { key: string; count: number };
    totalSessions: number;
  }>(COUNTERS_KEY, {
    day: { key: dayKey(), count: 0 },
    month: { key: monthKey(), count: 0 },
    totalSessions: 0,
  });

  const nextDay = stored.day.key === dayKey() ? stored.day.count : 0;
  const nextMonth = stored.month.key === monthKey() ? stored.month.count : 0;
  const dayCount = isNewSession ? nextDay + 1 : Math.max(1, nextDay);
  const monthCount = isNewSession ? nextMonth + 1 : Math.max(1, nextMonth);
  const totalSessions = isNewSession
    ? (stored.totalSessions || 0) + 1
    : Math.max(1, stored.totalSessions || 1);

  writeJSON(COUNTERS_KEY, {
    day: { key: dayKey(), count: dayCount },
    month: { key: monthKey(), count: monthCount },
    totalSessions,
  });

  return { currentSession: totalSessions, today: dayCount, month: monthCount };
}

async function fetchRemoteSessionCounts(
  options: VisitorTrackingInitOptions,
  visitorId: string,
  sessionId: string,
  isNewSession: boolean,
  attribution: TrafficAttribution,
  device: DeviceProfile,
) {
  if (
    options.storageMode !== "database" ||
    !options.supabaseUrl ||
    !options.supabaseAnonKey ||
    !isBrowser()
  ) {
    return;
  }

  const base = options.supabaseUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    apikey: options.supabaseAnonKey,
    Authorization: `Bearer ${options.supabaseAnonKey}`,
  };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}/rest/v1/rpc/record_visitor_session`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        p_id: sessionId,
        p_visitor_id: visitorId,
        p_source: attribution.source || null,
        p_medium: attribution.medium || null,
        p_campaign: attribution.campaign || null,
        p_content: attribution.content || null,
        p_device_model: device.model,
        p_device_kind: device.kind,
        p_os: device.os,
        p_browser: device.browser,
        p_variant: options.variant || null,
      }),
    });
    if (!response.ok) {
      console.warn(`record_visitor_session failed [${response.status}]`);
      return;
    }
    const rows = (await response.json()) as Array<{
      today_count?: number;
      month_count?: number;
    }>;
    const counts = rows[0];

    runtime.sessionCounts = {
      currentSession: runtime.sessionCounts.currentSession,
      today:
        typeof counts?.today_count === "number"
          ? counts.today_count
          : runtime.sessionCounts.today,
      month:
        typeof counts?.month_count === "number"
          ? counts.month_count
          : runtime.sessionCounts.month,
    };
    updateSnapshot();
  } catch {
    /* ignore remote fallback */
  } finally {
    window.clearTimeout(timer);
  }
}

/** Đảm bảo phiên hiện tại được ghi khi người dùng submit, kể cả hydration trễ. */
export function syncCurrentVisitorSession(
  options: VisitorTrackingInitOptions,
): void {
  if (!runtime.initialized) {
    initVisitorTracking(options);
    return;
  }
  void fetchRemoteSessionCounts(
    options,
    runtime.visitorId,
    runtime.sessionId,
    true,
    runtime.attribution,
    runtime.device,
  );
}

async function refreshNetworkInfo() {
  if (!isBrowser()) return;
  const connectionType = detectConnectionType();
  runtime.network = {
    ...runtime.network,
    connectionType,
    connectionLabel: connectionTypeLabel(connectionType),
    fallbackLabel: buildFallbackNetworkLabel(connectionType),
    displayLabel: buildFallbackNetworkLabel(connectionType),
    lookupStatus: "loading",
  };
  updateSnapshot();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch("https://ipwho.is/", {
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      success?: boolean;
      ip?: string;
      city?: string;
      region?: string;
      country?: string;
      connection?: { isp?: string; org?: string };
      security?: {
        vpn?: boolean;
        proxy?: boolean;
        tor?: boolean;
        hosting?: boolean;
      };
    };
    window.clearTimeout(timer);

    const provider = payload.connection?.isp || payload.connection?.org || "";
    runtime.network = {
      ip: payload.ip || "",
      city: payload.city || "",
      region: payload.region || "",
      country: payload.country || "Việt Nam",
      isp: payload.connection?.isp || "",
      organization: payload.connection?.org || "",
      provider,
      connectionType,
      connectionLabel: connectionTypeLabel(connectionType),
      fallbackLabel: buildFallbackNetworkLabel(
        connectionType,
        payload.country || "Việt Nam",
      ),
      displayLabel: "",
      flags: [
        payload.security?.vpn && "VPN",
        payload.security?.proxy && "Proxy",
        payload.security?.tor && "Tor",
        payload.security?.hosting && "Hosting",
      ].filter((flag): flag is string => Boolean(flag)),
      lookupStatus: payload.success === false ? "fallback" : "resolved",
    };
    runtime.network.displayLabel = buildNetworkDisplay(runtime.network);
  } catch {
    window.clearTimeout(timer);
    runtime.network = {
      ...runtime.network,
      lookupStatus: "fallback",
      displayLabel: buildNetworkDisplay(runtime.network),
    };
  }
  updateSnapshot();
}

function detectHardwareInfo() {
  if (!isBrowser()) return;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  runtime.deviceMemory =
    typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  runtime.hardwareConcurrency =
    typeof nav.hardwareConcurrency === "number"
      ? nav.hardwareConcurrency
      : null;
  runtime.screenWidth = window.screen.width || null;
  runtime.screenHeight = window.screen.height || null;
  runtime.pixelRatio = window.devicePixelRatio || null;
  runtime.maxTouchPoints =
    typeof navigator.maxTouchPoints === "number"
      ? navigator.maxTouchPoints
      : null;
}

async function detectBatteryInfo() {
  if (!isBrowser()) return;
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{
      level: number;
      charging: boolean;
      addEventListener: (name: string, listener: () => void) => void;
    }>;
  };
  if (!nav.getBattery) return;
  try {
    const battery = await nav.getBattery();
    const update = () => {
      runtime.batteryLevelPercent = Math.round(battery.level * 100);
      runtime.batteryCharging = battery.charging;
      updateSnapshot();
    };
    update();
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
  } catch {
    /* Battery API is unavailable in many mobile browsers. */
  }
}

export function initVisitorTracking(options: VisitorTrackingInitOptions = {}) {
  if (!isBrowser()) return () => {};
  runtime.options = options;
  if (runtime.initialized) {
    void fetchRemoteSessionCounts(
      runtime.options,
      runtime.visitorId,
      runtime.sessionId,
      options.storageMode === "database",
      runtime.attribution,
      runtime.device,
    );
    runtime.options = options;
    return runtime.cleanup || (() => {});
  }

  runtime.initialized = true;
  runtime.startedAt = Date.now();
  runtime.firstInteractionAt = 0;
  runtime.formStartedAt = 0;
  runtime.maxScrollPercent = 0;
  runtime.industrySwitchCount = 0;
  runtime.faqClicked = "";
  runtime.copiedTextType = "";
  runtime.isCopyPaste = false;
  runtime.scrollVelocity = 0;
  runtime.maxScrollVelocity = 0;
  runtime.scrollBackCount = 0;
  runtime.lastScrollY = 0;
  runtime.lastScrollTime = 0;
  runtime.sectionTime = {};
  runtime.visibleSections = {};
  runtime.visitorId = getVisitorId();
  runtime.sessionId = readSessionMarker() || makeId("session");
  const isNewSession = !readSessionMarker();
  if (isNewSession) writeSessionMarker(runtime.sessionId);
  runtime.device = detectDeviceProfile();
  runtime.attribution = readAttribution();
  runtime.sessionCounts = readLocalSessionCounts(isNewSession);
  detectHardwareInfo();
  void detectBatteryInfo();
  runtime.network = {
    ...defaultNetwork,
    connectionType: detectConnectionType(),
    connectionLabel: connectionTypeLabel(detectConnectionType()),
    fallbackLabel: buildFallbackNetworkLabel(detectConnectionType()),
    displayLabel: buildFallbackNetworkLabel(detectConnectionType()),
  };
  updateSnapshot();

  const markInteraction = () => {
    if (!runtime.firstInteractionAt) runtime.firstInteractionAt = Date.now();
    updateSnapshot();
  };
  // Cache scroll geometry; recompute on resize instead of reading layout
  // (scrollHeight/innerHeight) on every scroll, which forces reflow.
  let cachedTotal =
    document.documentElement.scrollHeight - window.innerHeight;
  const recomputeTotal = () => {
    cachedTotal = document.documentElement.scrollHeight - window.innerHeight;
  };
  const onScroll = () => {
    markInteraction();
    const total = cachedTotal;
    const currentY = window.scrollY || 0;
    const percent = total > 0 ? Math.round((currentY / total) * 100) : 100;
    runtime.maxScrollPercent = Math.max(
      runtime.maxScrollPercent,
      Math.min(100, percent),
    );
    const now = Date.now();
    const dt = now - runtime.lastScrollTime;
    if (dt > 0 && runtime.lastScrollTime > 0) {
      const dy = Math.abs(currentY - runtime.lastScrollY);
      const v = Math.round((dy / dt) * 1000);
      runtime.scrollVelocity = v;
      runtime.maxScrollVelocity = Math.max(runtime.maxScrollVelocity, v);
      if (currentY < runtime.lastScrollY - 5) {
        runtime.scrollBackCount += 1;
      }
    }
    runtime.lastScrollY = currentY;
    runtime.lastScrollTime = now;
    updateSnapshot();
  };
  const events: Array<[keyof WindowEventMap, EventListener]> = [
    ["scroll", onScroll as EventListener],
    ["pointerdown", markInteraction],
    ["keydown", markInteraction],
  ];
  events.forEach(([name, handler]) =>
    window.addEventListener(name, handler, { passive: true }),
  );
  onScroll();

  let observer: IntersectionObserver | undefined;
  const tick = window.setInterval(() => {
    Object.keys(runtime.visibleSections).forEach((name) => {
      if (runtime.visibleSections[name]) {
        runtime.sectionTime[name] = (runtime.sectionTime[name] || 0) + 1;
      }
    });
    updateSnapshot();
  }, 1000);

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const name = (entry.target as HTMLElement).dataset["section"];
          if (name) {
            runtime.visibleSections[name] =
              entry.isIntersecting && entry.intersectionRatio > 0.4 ? 1 : 0;
          }
        });
      },
      { threshold: [0, 0.4, 0.8] },
    );
    document
      .querySelectorAll<HTMLElement>("[data-section]")
      .forEach((element) => observer?.observe(element));
  }

  void refreshNetworkInfo();
  void fetchRemoteSessionCounts(
    runtime.options,
    runtime.visitorId,
    runtime.sessionId,
    isNewSession,
    runtime.attribution,
    runtime.device,
  );

  runtime.cleanup = () => {
    events.forEach(([name, handler]) =>
      window.removeEventListener(name, handler),
    );
    window.clearInterval(tick);
    observer?.disconnect();
    runtime.initialized = false;
    delete runtime.cleanup;
  };
  return runtime.cleanup;
}

function incrementSubmissionCounter() {
  const store = readJSON<{
    day: string;
    counts: Record<string, number>;
  }>(SUBMISSION_KEY, { day: dayKey(), counts: {} });
  const counts = store.day === dayKey() ? store.counts : {};
  counts[runtime.visitorId || "unknown"] =
    (counts[runtime.visitorId || "unknown"] || 0) + 1;
  writeJSON(SUBMISSION_KEY, { day: dayKey(), counts });
  return counts[runtime.visitorId || "unknown"] ?? 1;
}

export function detectDevice() {
  return runtime.device;
}

export function getConnectionType() {
  return runtime.network.connectionType;
}

export function isHeadless() {
  return detectHeadlessBrowser();
}

export function markFormStart() {
  if (!runtime.formStartedAt) runtime.formStartedAt = Date.now();
  if (!runtime.firstInteractionAt) runtime.firstInteractionAt = Date.now();
  updateSnapshot();
}

export function markIndustrySwitch() {
  runtime.industrySwitchCount += 1;
  updateSnapshot();
}

export function markFaqClick(slug: string) {
  runtime.faqClicked = slug;
  updateSnapshot();
}

export function markCopyPaste(type = "sdt") {
  runtime.isCopyPaste = true;
  runtime.copiedTextType = type;
  updateSnapshot();
}

export function markCopiedText(type: string) {
  runtime.copiedTextType = type;
  updateSnapshot();
}

export function getIpSnapshot() {
  return {
    ip: runtime.network.ip,
    city: compactLocation([runtime.network.city, runtime.network.region]),
    visitsToday: runtime.sessionCounts.today,
    networkProvider: runtime.network.provider,
    networkFlags: runtime.network.flags,
    displayLabel: runtime.network.displayLabel,
  };
}

export function getTrackingSnapshot() {
  return getSnapshot();
}

export function collectBehavior(form: {
  city: string;
  major: string;
}): BehaviorData {
  const snapshot = getSnapshot();
  const submissionCount = incrementSubmissionCounter();
  snapshot.metrics.submissionCountSameVisitor = submissionCount;

  return {
    time_on_page_seconds: snapshot.metrics.timeOnPageSeconds,
    time_to_first_interaction_seconds:
      snapshot.metrics.timeToFirstInteractionSeconds,
    form_fill_duration_seconds: snapshot.metrics.formFillDurationSeconds,
    scroll_depth_percent: snapshot.metrics.scrollDepthPercent,
    scroll_velocity: snapshot.metrics.scrollVelocity,
    scroll_back_count: snapshot.metrics.scrollBackCount,
    industry_switch_count: snapshot.metrics.industrySwitchCount,
    focus_section: snapshot.metrics.focusSection,
    faq_clicked: snapshot.metrics.faqClicked,
    copied_text_type: snapshot.metrics.copiedTextType,
    is_copy_paste: snapshot.metrics.isCopyPaste,
    is_headless_browser: snapshot.metrics.isHeadlessBrowser,
    submission_count_same_visitor: submissionCount,
    max_scroll_velocity: snapshot.metrics.maxScrollVelocity,
    device_model_name: snapshot.device.model,
    device_manufacturer: snapshot.device.manufacturer,
    device_family: snapshot.device.family,
    operating_system: snapshot.device.osName,
    operating_system_version: snapshot.device.osVersion,
    browser: snapshot.device.browserName,
    browser_version: snapshot.device.browserVersion,
    is_in_app_browser: snapshot.device.isInAppBrowser,
    connection_type: snapshot.network.connectionType,
    network_provider: snapshot.network.provider,
    network_label: snapshot.network.displayLabel,
    network_flags: snapshot.network.flags,
    device_memory: snapshot.metrics.deviceMemory,
    hardware_concurrency: snapshot.metrics.hardwareConcurrency,
    battery_level_percent: snapshot.metrics.batteryLevelPercent,
    battery_charging: snapshot.metrics.batteryCharging,
    screen_width: snapshot.metrics.screenWidth,
    screen_height: snapshot.metrics.screenHeight,
    pixel_ratio: snapshot.metrics.pixelRatio,
    max_touch_points: snapshot.metrics.maxTouchPoints,
    client_ip: snapshot.network.ip,
    location_city: snapshot.network.city,
    location_region: snapshot.network.region,
    location_country: snapshot.network.country,
    form_city: form.city,
    nganh_hoc: form.major,
    utm_source: snapshot.attribution.source,
    utm_medium: snapshot.attribution.medium,
    utm_campaign: snapshot.attribution.campaign,
    utm_content: snapshot.attribution.content,
    utm_term: snapshot.attribution.term,
    ttclid: snapshot.attribution.ttclid,
    visits_today: snapshot.metrics.sessionCounts.today,
    visits_month: snapshot.metrics.sessionCounts.month,
    current_session: snapshot.metrics.sessionCounts.currentSession,
  };
}

export function bumpVisitCounters() {
  return getSnapshot().metrics.sessionCounts;
}
