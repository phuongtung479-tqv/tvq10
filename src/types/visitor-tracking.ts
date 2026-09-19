import type { StorageMode } from "@/config/site-config";

export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";
export type LeadRiskLevel = "low" | "review" | "high" | "unrated";
/** Nguồn lưu trữ duy nhất: dùng chung StorageMode của cấu hình site. */
export type TrackingStorageMode = StorageMode;
export type LookupStatus =
  "idle" | "loading" | "resolved" | "fallback" | "error";

export interface DeviceProfile {
  userAgent: string;
  manufacturer: string;
  family: string;
  model: string;
  kind: DeviceKind;
  osName: string;
  osVersion: string;
  os: string;
  browserName: string;
  browserVersion: string;
  browser: string;
  isInAppBrowser: boolean;
}

export interface NetworkInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  isp: string;
  organization: string;
  provider: string;
  connectionType: string;
  connectionLabel: string;
  fallbackLabel: string;
  displayLabel: string;
  flags: string[];
  lookupStatus: LookupStatus;
}

export interface TrafficAttribution {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  ttclid: string;
  landingUrl: string;
}

export interface VisitorSessionCounts {
  currentSession: number;
  today: number;
  month: number;
}

export interface VisitorMetrics {
  timeOnPageSeconds: number;
  timeToFirstInteractionSeconds: number;
  formFillDurationSeconds: number;
  scrollDepthPercent: number;
  scrollVelocity: number;
  maxScrollVelocity: number;
  scrollBackCount: number;
  industrySwitchCount: number;
  focusSection: string;
  faqClicked: string;
  copiedTextType: string;
  isCopyPaste: boolean;
  isHeadlessBrowser: boolean;
  submissionCountSameVisitor: number;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  batteryLevelPercent: number | null;
  batteryCharging: boolean | null;
  screenWidth: number | null;
  screenHeight: number | null;
  pixelRatio: number | null;
  maxTouchPoints: number | null;
  sessionCounts: VisitorSessionCounts;
}

export interface TrackingSnapshot {
  device: DeviceProfile;
  network: NetworkInfo;
  attribution: TrafficAttribution;
  metrics: VisitorMetrics;
  visitorId: string;
  sessionId: string;
  initialized: boolean;
}

export interface BehaviorData {
  time_on_page_seconds: number;
  time_to_first_interaction_seconds: number;
  form_fill_duration_seconds: number;
  scroll_depth_percent: number;
  scroll_velocity: number;
  max_scroll_velocity: number;
  scroll_back_count: number;
  industry_switch_count: number;
  focus_section: string;
  faq_clicked: string;
  copied_text_type: string;
  is_copy_paste: boolean;
  is_headless_browser: boolean;
  submission_count_same_visitor: number;
  device_model_name: string;
  device_manufacturer: string;
  device_family: string;
  operating_system: string;
  operating_system_version: string;
  browser: string;
  browser_version: string;
  is_in_app_browser: boolean;
  connection_type: string;
  network_provider: string;
  network_label: string;
  network_flags: string[];
  device_memory: number | null;
  hardware_concurrency: number | null;
  battery_level_percent: number | null;
  battery_charging: boolean | null;
  screen_width: number | null;
  screen_height: number | null;
  pixel_ratio: number | null;
  max_touch_points: number | null;
  client_ip: string;
  location_city: string;
  location_region: string;
  location_country: string;
  form_city: string;
  nganh_hoc: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  ttclid: string;
  visits_today: number;
  visits_month: number;
  current_session: number;
}

export interface LeadAssessment {
  score: number;
  rank: string;
  riskLevel: LeadRiskLevel;
  reasons: string[];
  recommendedAction: string;
}

export interface VisitorBehaviorPayload {
  submittedAt: string;
  device: DeviceProfile;
  network: NetworkInfo;
  attribution: TrafficAttribution;
  metrics: VisitorMetrics;
  form: {
    city: string;
    major: string;
  };
  assessment: LeadAssessment;
  saleAdvice: string;
  behaviorSummary: string;
  deviceTechInfo: string;
  trafficAdsSource: string;
}
