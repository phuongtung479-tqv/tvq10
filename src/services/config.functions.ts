import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const saveSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

const countdownSchema = z.object({
  url: z.string().url(),
});

function stripSecrets(config: Record<string, unknown>) {
  const copy = structuredClone(config);
  const admin = (copy["admin"] || {}) as Record<string, unknown>;
  admin["supabaseAnonKey"] = "";
  admin["password"] = "";
  admin["backupCronToken"] = "";
  copy["admin"] = admin;
  const emailAutomation = (copy["emailAutomation"] || {}) as Record<
    string,
    unknown
  >;
  for (const key of [
    "resendApiKey",
    "gmailClientId",
    "gmailClientSecret",
    "gmailRefreshToken",
  ])
    emailAutomation[key] = "";
  copy["emailAutomation"] = emailAutomation;
  const tracking = (copy["tracking"] || {}) as Record<string, unknown>;
  tracking["tiktokAccessToken"] = "";
  copy["tracking"] = tracking;
  return copy;
}

export const saveConfigWithSupabaseAuth = createServerFn({ method: "POST" })
  .validator((input) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const authResponse = await fetch(
      `${data.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: data.anonKey },
        body: JSON.stringify({ email: data.email, password: data.password }),
      },
    );
    if (!authResponse.ok) return { ok: false, reason: "auth_failed" } as const;
    const authPayload = (await authResponse.json()) as {
      access_token?: string;
    };
    if (!authPayload.access_token)
      return { ok: false, reason: "auth_failed" } as const;

    const response = await fetch(
      `${data.url.replace(/\/$/, "")}/rest/v1/funnel_configs?on_conflict=id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: data.anonKey,
          Authorization: `Bearer ${authPayload.access_token}`,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([
          {
            id: 1,
            data: stripSecrets(data.config),
            updated_at: new Date().toISOString(),
          },
        ]),
      },
    );
    if (!response.ok)
      return { ok: false, reason: "config_write_failed" } as const;
    return { ok: true, accessToken: authPayload.access_token } as const;
  });

export const decrementCountdownWithServiceRole = createServerFn({
  method: "POST",
})
  .validator((input) => countdownSchema.parse(input))
  .handler(async ({ data }) => {
    const url = (process.env["SUPABASE_URL"] || data.url).replace(/\/$/, "");
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!serviceKey) return { ok: false, reason: "missing_service_key" };
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };
    const read = await fetch(
      `${url}/rest/v1/funnel_configs?id=eq.1&select=data`,
      { headers },
    );
    if (!read.ok) return { ok: false, reason: "read_failed" };
    const rows = (await read.json()) as Array<{
      data?: { countdown?: { slotsLeft?: number; enabled?: boolean; headline?: string } };
    }>;
    const dataRow = rows[0]?.data as Record<string, unknown> | undefined;
    const countdown = dataRow?.["countdown"] as
      | Record<string, unknown>
      | undefined;
    const nextData = structuredClone((dataRow ?? {}) as Record<string, unknown>);
    const currentSlots = Number(
      countdown && typeof countdown["slotsLeft"] !== "undefined"
        ? countdown["slotsLeft"]
        : 12,
    );
    const nextCountdown = {
      ...(countdown ?? {}),
      enabled: true,
      autoDecrement: true,
      headline:
        typeof countdown?.["headline"] === "string"
          ? countdown["headline"]
          : "suất học bổng miễn 100% KTX tháng này",
      slotsLeft: Math.max(0, currentSlots - 1),
      template:
        typeof countdown?.["template"] === "string"
          ? countdown["template"]
          : "premium",
    };
    nextData["countdown"] = nextCountdown;

    const write = await fetch(`${url}/rest/v1/funnel_configs?on_conflict=id`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
          id: 1,
          data: nextData,
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    return write.ok
      ? { ok: true, changed: true }
      : { ok: false, reason: "write_failed" };
  });
