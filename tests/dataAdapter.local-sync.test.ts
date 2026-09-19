import assert from "node:assert/strict";
import test from "node:test";

const localStore = new Map<string, string>();

globalThis.window = {
  localStorage: {
    getItem(key: string) {
      return localStore.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      localStore.set(key, value);
    },
    removeItem(key: string) {
      localStore.delete(key);
    },
  },
  setTimeout,
  clearTimeout,
  dispatchEvent() {
    return true;
  },
} as unknown as Window & typeof globalThis;

Object.defineProperty(import.meta, "env", {
  value: {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
  },
  configurable: true,
});

const { DEFAULT_CONFIG } = await import("../src/config/site-config.ts");
const { loadConfig, saveConfig } = await import("../src/services/dataAdapter.ts");

test("loadConfig keeps local storage mode when the user has selected local save", () => {
  const saved = {
    ...DEFAULT_CONFIG,
    admin: {
      ...DEFAULT_CONFIG.admin,
      storageMode: "local",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  };
  localStore.clear();
  localStore.set("funnel_site_config_v1", JSON.stringify(saved));

  const config = loadConfig();
  assert.equal(config.admin.storageMode, "local");
});

test("saveConfig stores a local copy even if Supabase sync fails", async () => {
  localStore.clear();
  globalThis.fetch = async () => {
    throw new Error("network");
  };

  const config = {
    ...DEFAULT_CONFIG,
    admin: {
      ...DEFAULT_CONFIG.admin,
      storageMode: "database",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  };

  const result = await saveConfig(config);
  assert.equal(result, true);
  assert.ok(localStore.has("funnel_site_config_v1"));
});

test("saveLead falls back to local storage when remote database insert fails", async () => {
  localStore.clear();
  globalThis.fetch = async () => {
    throw new Error("network");
  };

  const config = {
    ...DEFAULT_CONFIG,
    admin: {
      ...DEFAULT_CONFIG.admin,
      storageMode: "database",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  };

  const { saveLead } = await import("../src/services/dataAdapter.ts");
  const saved = await saveLead(
    {
      id: "lead_fallback",
      at: new Date().toISOString(),
      name: "Nguyễn Văn A",
      phone: "0900000001",
      email: "a@example.com",
      city: "Hà Nội",
      major: "Công nghệ",
      storage: "database",
    },
    config,
  );

  assert.equal(saved.storage, "local");
  const leads = JSON.parse(localStore.get("funnel_leads_v1") || "[]");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].phone, "0900000001");
});

test("syncLeadsToSupabase reports local saved and cloud synced statuses", async () => {
  localStore.clear();

  const lead = {
    id: "lead_1",
    at: new Date().toISOString(),
    name: "Nguyễn Văn A",
    phone: "0900000001",
    city: "Hà Nội",
    major: "Công nghệ",
    aiScore: 82,
    aiRank: "HOT",
    storage: "local",
  } as const;

  localStore.set("funnel_leads_v1", JSON.stringify([lead]));

  globalThis.fetch = async () => ({ ok: true }) as Response;

  const { syncLeadsToSupabase } = await import("../src/services/dataAdapter.ts");
  const result = await syncLeadsToSupabase({
    ...DEFAULT_CONFIG,
    admin: {
      ...DEFAULT_CONFIG.admin,
      storageMode: "database",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.synced, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 0);
});

test("decrementCountdownWithServiceRole creates a countdown row when config is missing", async () => {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? String(init.body) : undefined });

    if (url.includes("/rest/v1/funnel_configs?id=eq.1&select=data")) {
      return {
        ok: true,
        json: async () => [],
      } as Response;
    }

    if (url.includes("/rest/v1/funnel_configs?id=eq.1")) {
      return { ok: true } as Response;
    }

    return { ok: true, json: async () => ({ access_token: "token" }) } as Response;
  };

  const { decrementCountdownWithServiceRole } = await import(
    "../src/services/config.functions.ts"
  );

  const result = await decrementCountdownWithServiceRole({
    data: { url: "https://example.supabase.co" },
  });

  assert.deepEqual(result, { ok: true, changed: true });
  assert.ok(
    calls.some(
      (call) =>
        call.method === "PATCH" &&
        call.url.includes("/rest/v1/funnel_configs?id=eq.1") &&
        String(call.body ?? "").includes("\"slotsLeft\":11"),
    ),
  );
});
