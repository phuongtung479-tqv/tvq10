/**
 * MULTI-CHANNEL WEBHOOK & API SYNC HUB
 * Gửi song song một lead tới mọi endpoint đang bật: Make/Zapier, Google Sheets,
 * Telegram Bot, Supabase REST hoặc endpoint tuỳ ý.
 */
import type { SiteConfig, WebhookEndpoint } from "@/config/site-config";
import { relayWebhook } from "@/services/webhook.functions";

export interface WebhookResult {
  label: string;
  ok: boolean;
  detail?: string;
  attempts: number;
}

const TIMEOUT_MS = 4_000;
const RETRIES = 1;
const MAX_PAYLOAD_BYTES = 60_000;

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function compactPayload(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength <= MAX_PAYLOAD_BYTES) {
    return payload;
  }
  const compact = { ...payload };
  delete compact["visitor_behavior_payload"];
  return compact;
}

export function webhookConfigurationWarning(
  endpoint: WebhookEndpoint,
  config: SiteConfig,
): string | undefined {
  const value = endpoint.url.trim();
  if (!value) return "Chưa nhập URL endpoint";
  if (!validUrl(value))
    return "URL phải dùng HTTPS (localhost có thể dùng HTTP)";
  if (endpoint.type === "telegram" && !value.includes("/bot")) {
    return "URL Telegram cần có dạng /bot<TOKEN>/sendMessage?chat_id=...";
  }
  if (
    endpoint.type === "telegram" &&
    !new URL(value).searchParams.get("chat_id")
  ) {
    return "URL Telegram đang thiếu chat_id";
  }
  if (
    endpoint.type === "supabase" &&
    (!config.admin.supabaseUrl || !config.admin.supabaseAnonKey)
  ) {
    return "Cần cấu hình Supabase URL và anon key trong Storage trước";
  }
  return undefined;
}

async function requestWithRetry(
  endpoint: string,
  init: RequestInit,
): Promise<{ response?: Response; attempts: number; detail?: string }> {
  let detail = "Không thể kết nối";
  for (let attempt = 1; attempt <= RETRIES + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        ...init,
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (response.ok || response.status < 500) {
        if (!response.ok) {
          const responseText = await response.text().catch(() => "");
          detail =
            responseText.trim().slice(0, 180) || `HTTP ${response.status}`;
        }
        return { response, attempts: attempt, detail };
      }
      detail = `HTTP ${response.status}`;
    } catch (error) {
      window.clearTimeout(timer);
      detail =
        error instanceof DOMException && error.name === "AbortError"
          ? "Timeout"
          : (error as Error).message;
    }
    if (attempt <= RETRIES)
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 300));
  }
  return { attempts: RETRIES + 1, detail };
}

function telegramBody(url: string, payload: Record<string, unknown>) {
  // URL dạng: https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=123
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const text = Object.entries(payload)
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v ?? ""))}`)
    .join("\n");
  const u = new URL(url);
  const chatId = u.searchParams.get("chat_id") || "";
  u.searchParams.delete("chat_id");
  return {
    endpoint: u.toString(),
    body: { chat_id: chatId, text, parse_mode: "HTML" },
  };
}

async function postOne(
  ep: WebhookEndpoint,
  payload: Record<string, unknown>,
  supabase: { url: string; key: string },
): Promise<WebhookResult> {
  try {
    let endpoint = ep.url;
    let body: unknown = payload;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (ep.type === "telegram") {
      const t = telegramBody(ep.url, payload);
      endpoint = t.endpoint;
      body = t.body;
    } else if (ep.type === "supabase" && supabase.url && supabase.key) {
      endpoint = `${supabase.url.replace(/\/$/, "")}/rest/v1/${ep.url.replace(/^\//, "") || "leads"}`;
      headers = {
        ...headers,
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
        Prefer: "return=minimal",
      };
      body = [payload];
    }
    if (!validUrl(endpoint))
      return {
        label: ep.label || ep.type,
        ok: false,
        attempts: 0,
        detail: "URL không hợp lệ hoặc không dùng HTTPS",
      };

    // In-app browser thường chặn CORS tới Make/Sheets/Supabase. Ưu tiên relay
    // cùng origin; nếu app đang chạy static hosting thì fallback về client fetch.
    try {
      const relay = await Promise.race([
        relayWebhook({ data: { endpoint, body, headers } }),
        new Promise<null>((resolve) =>
          window.setTimeout(() => resolve(null), TIMEOUT_MS),
        ),
      ]);
      // Relay đã thực sự liên hệ được endpoint (dù thành công hay bị từ chối):
      // dùng kết quả này luôn, không rơi xuống client fetch (sẽ chỉ bị CORS
      // chặn và che mất lỗi thật, VD sai bot token/chat_id Telegram).
      if (relay) {
        return {
          label: ep.label || ep.type,
          ok: relay.ok,
          attempts: 1,
          detail: relay.ok
            ? "server_relay"
            : relay.detail || `HTTP ${relay.status}`,
        };
      }
    } catch {
      // Static build/server function unavailable: use direct request below.
    }

    const result = await requestWithRetry(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!result.response?.ok)
      return {
        label: ep.label || ep.type,
        ok: false,
        attempts: result.attempts,
        detail: result.detail || `HTTP ${result.response?.status}`,
      };
    return { label: ep.label || ep.type, ok: true, attempts: result.attempts };
  } catch (err) {
    return {
      label: ep.label || ep.type,
      ok: false,
      attempts: 0,
      detail: (err as Error).message,
    };
  }
}

export async function testWebhookEndpoint(
  endpoint: WebhookEndpoint,
  config: SiteConfig,
): Promise<WebhookResult> {
  const supabase = {
    url: config.admin.supabaseUrl,
    key: config.admin.supabaseAnonKey,
  };
  // Bảng Supabase tùy ý (VD "leads") không khớp field với payload test chung
  // ("test", "event", "sent_at"), gây lỗi PGRST204 giả dù cấu hình đúng.
  // Thay vào đó chỉ kiểm tra kết nối/quyền đọc bảng, không insert dữ liệu giả.
  if (endpoint.type === "supabase" && supabase.url && supabase.key) {
    const table = endpoint.url.replace(/^\//, "").trim() || "leads";
    try {
      const response = await fetch(
        `${supabase.url.replace(/\/$/, "")}/rest/v1/${table}?select=id&limit=0`,
        {
          headers: {
            apikey: supabase.key,
            Authorization: `Bearer ${supabase.key}`,
          },
        },
      );
      if (response.ok)
        return {
          label: endpoint.label || endpoint.type,
          ok: true,
          attempts: 1,
        };
      const detail = await response.text().catch(() => "");
      return {
        label: endpoint.label || endpoint.type,
        ok: false,
        attempts: 1,
        detail: detail.trim().slice(0, 180) || `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        label: endpoint.label || endpoint.type,
        ok: false,
        attempts: 1,
        detail: (err as Error).message,
      };
    }
  }
  return postOne(
    endpoint,
    { test: true, event: "webhook_test", sent_at: new Date().toISOString() },
    supabase,
  );
}

/**
 * Gửi lead đi mọi kênh. Khi đã cấu hình nhiều kênh, chỉ coi là thành công
 * khi tất cả kênh đều nhận được dữ liệu; không cấu hình kênh nào vẫn hợp lệ.
 */
export async function dispatchLead(
  config: SiteConfig,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; results: WebhookResult[]; failedCount?: number }> {
  payload = compactPayload(payload);
  const endpoints: WebhookEndpoint[] = [];

  const primary = config.form.webhookUrl?.trim();
  if (primary && primary.startsWith("http") && !primary.includes("REPLACE")) {
    endpoints.push({
      id: "primary",
      label: "Webhook chính",
      url: primary,
      enabled: true,
      type: "make",
    });
  }
  endpoints.push(...config.webhooks.filter((w) => w.enabled && w.url.trim()));

  const uniqueEndpoints = endpoints.filter(
    (endpoint, index, all) =>
      all.findIndex(
        (candidate) => candidate.url.trim() === endpoint.url.trim(),
      ) === index,
  );

  if (uniqueEndpoints.length === 0) return { ok: true, results: [] };

  const supabase = {
    url: config.admin.supabaseUrl,
    key: config.admin.supabaseAnonKey,
  };

  const results = await Promise.all(
    uniqueEndpoints.map((ep) => postOne(ep, payload, supabase)),
  );

  // Fallback: nếu fetch thất bại, thử sendBeacon (hoạt động ngay cả khi
  // in-app browser chặn fetch hoặc khi trang đang redirect)
  const failed = results.filter((r) => !r.ok);
  if (
    failed.length > 0 &&
    typeof navigator !== "undefined" &&
    navigator.sendBeacon
  ) {
    for (const ep of uniqueEndpoints) {
      const result = results.find((r) => r.label === (ep.label || ep.type));
      if (result?.ok) continue;
      if (ep.type === "telegram" || ep.type === "supabase") continue; // sendBeacon chỉ cho POST JSON đơn giản
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(ep.url, blob);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    // Partial delivery is useful for diagnostics, but must not be reported as
    // a complete multi-channel delivery.
    ok: failed.length === 0,
    results,
    failedCount: failed.length,
  };
}
