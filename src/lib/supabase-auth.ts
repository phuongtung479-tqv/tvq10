const ACCESS_TOKEN_KEY = "funnel_supabase_access_token_v1";

export type SupabaseSignInResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_credentials"
        | "email_not_confirmed"
        | "email_provider_disabled"
        | "auth_failed"
        | "user_lookup_failed"
        | "admin_lookup_failed"
        | "not_admin"
        | "network_error";
    };

function tokenIsExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(
        normalizedPayload.padEnd(
          Math.ceil(normalizedPayload.length / 4) * 4,
          "=",
        ),
      ),
    ) as {
      exp?: unknown;
    };
    return (
      typeof claims.exp === "number" &&
      claims.exp <= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function clearSupabaseAccessToken(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* storage may be blocked */
  }
}

export function getSupabaseAccessToken(): string {
  if (!isBrowser()) return "";
  try {
    const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
    if (token && tokenIsExpired(token)) {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      return "";
    }
    return token;
  } catch {
    return "";
  }
}

export async function signInWithSupabase(
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<SupabaseSignInResult> {
  if (!url || !anonKey || !email || !password || !isBrowser())
    return { ok: false, reason: "auth_failed" };
  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({ email, password }),
      },
    );
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        error_code?: unknown;
        error?: unknown;
      } | null;
      if (
        error?.error_code === "email_not_confirmed" ||
        error?.error === "email_not_confirmed"
      )
        return { ok: false, reason: "email_not_confirmed" };
      if (
        error?.error_code === "email_provider_disabled" ||
        error?.error === "email_provider_disabled"
      )
        return { ok: false, reason: "email_provider_disabled" };
      if (
        error?.error_code === "invalid_credentials" ||
        error?.error === "invalid_credentials"
      )
        return { ok: false, reason: "invalid_credentials" };
      return { ok: false, reason: "auth_failed" };
    }
    const payload = (await response.json()) as {
      access_token?: unknown;
      user?: { id?: unknown };
    };
    if (typeof payload.access_token !== "string" || !payload.access_token) {
      return { ok: false, reason: "auth_failed" };
    }
    const userResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${payload.access_token}`,
      },
    });
    if (!userResponse.ok) return { ok: false, reason: "user_lookup_failed" };
    const user = (await userResponse.json()) as { id?: unknown };
    if (typeof user.id !== "string" || !user.id)
      return { ok: false, reason: "user_lookup_failed" };
    const adminResponse = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&select=user_id&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${payload.access_token}`,
        },
      },
    );
    if (!adminResponse.ok) return { ok: false, reason: "admin_lookup_failed" };
    const admins = (await adminResponse.json()) as unknown[];
    if (!Array.isArray(admins) || admins.length === 0)
      return { ok: false, reason: "not_admin" };
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, payload.access_token);
    return { ok: true };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
