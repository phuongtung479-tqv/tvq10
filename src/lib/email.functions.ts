/**
 * AUTOMATED EMAIL SEQUENCER (auto-responder).
 * Gửi email cảm ơn ngay sau khi khách đăng ký. Chạy phía server.
 * API key lấy từ payload (Admin nhập trong UI) hoặc env var nếu có.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["resend", "gmail"]).default("resend"),
  to: z.string().email(),
  // Cho phép rỗng: handler tự kiểm tra và trả về missing_from_email/invalid_from_email
  // thay vì để validator throw trước khi handler kịp xử lý.
  from: z
    .string()
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Invalid email",
    })
    .optional()
    .default(""),
  subject: z.string().min(1),
  text: z.string().min(1),
  html: z.string().optional(),
  resendApiKey: z.string().optional(),
  gmailClientId: z.string().optional(),
  gmailClientSecret: z.string().optional(),
  gmailRefreshToken: z.string().optional(),
});

export const checkEmailConfig = createServerFn({ method: "GET" }).handler(
  () => ({
    resendConfigured: Boolean(process.env["RESEND_API_KEY"]),
    resendFromConfigured: Boolean(
      process.env["RESEND_FROM_EMAIL"] || process.env["BACKUP_FROM_EMAIL"],
    ),
    gmailConfigured: Boolean(
      process.env["GMAIL_CLIENT_ID"] &&
      process.env["GMAIL_CLIENT_SECRET"] &&
      process.env["GMAIL_REFRESH_TOKEN"],
    ),
  }),
);

async function sendWithGmail(data: z.infer<typeof schema>) {
  const clientId = data.gmailClientId || process.env["GMAIL_CLIENT_ID"];
  const clientSecret =
    data.gmailClientSecret || process.env["GMAIL_CLIENT_SECRET"];
  const refreshToken =
    data.gmailRefreshToken || process.env["GMAIL_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken)
    return { sent: false as const, reason: "missing_gmail_secrets" as const };

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok)
    return { sent: false as const, reason: "gmail_token_error" as const };
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token)
    return { sent: false as const, reason: "gmail_token_error" as const };

  const raw = [
    `From: ${data.from}`,
    `To: ${data.to}`,
    `Subject: ${data.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    data.text,
  ].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
  );
  return response.ok
    ? { sent: true as const }
    : { sent: false as const, reason: "gmail_send_error" as const };
}

function providerFailure(status: number, detail: string) {
  return {
    sent: false as const,
    reason: "provider_error" as const,
    status,
    detail: explainProviderFailure(status, detail),
  };
}

function explainProviderFailure(status: number, detail: string): string {
  if (status === 403 && detail.includes("testing emails")) {
    return "Resend đang ở chế độ testing: chỉ gửi được tới email chủ tài khoản. Hãy verify domain trên Resend để gửi cho khách hàng.";
  }
  return detail.replace(/\s+/g, " ").trim().slice(0, 240);
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
]);

export const sendLeadEmail = createServerFn({ method: "POST" })
  .validator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    if (data.provider === "gmail") return sendWithGmail(data);
    const apiKey = data.resendApiKey || process.env["RESEND_API_KEY"];
    if (!apiKey) return { sent: false, reason: "missing_api_key" as const };
    const from =
      data.from ||
      process.env["RESEND_FROM_EMAIL"] ||
      process.env["BACKUP_FROM_EMAIL"] ||
      "";
    if (!from) return { sent: false, reason: "missing_from_email" as const };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
      return { sent: false, reason: "invalid_from_email" as const };
    const fromDomain = from.slice(from.lastIndexOf("@") + 1).toLowerCase();
    if (FREE_EMAIL_DOMAINS.has(fromDomain))
      return {
        sent: false,
        reason: "unverified_from_domain" as const,
        detail:
          "Resend yêu cầu From thuộc domain đã xác minh; không dùng Gmail/Yahoo/Outlook làm From.",
      };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [data.to],
          subject: data.subject,
          text: data.text,
          ...(data.html ? { html: data.html } : {}),
        }),
      });
      if (res.ok) return { sent: true as const };
      const detail = await res.text();
      console.error(
        `Resend failed [${res.status}] attempt ${attempt + 1}: ${detail}`,
      );
      if (res.status < 500 && res.status !== 429) {
        return providerFailure(res.status, detail);
      }
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
    return providerFailure(503, "Resend không phản hồi sau 3 lần thử.");
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .validator((data) => schema.parse(data))
  .handler(async ({ data }) => sendLeadEmail({ data }));
