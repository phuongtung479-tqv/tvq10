import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const relaySchema = z.object({
  endpoint: z.string().url(),
  body: z.unknown(),
  headers: z.record(z.string(), z.string()).optional(),
});

function isAllowedEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export const relayWebhook = createServerFn({ method: "POST" })
  .validator((data) => relaySchema.parse(data))
  .handler(async ({ data }) => {
    if (!isAllowedEndpoint(data.endpoint)) {
      return { ok: false, status: 400, detail: "invalid_endpoint" };
    }

    try {
      const response = await fetch(data.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...data.headers,
        },
        body: JSON.stringify(data.body),
      });
      return {
        ok: response.ok,
        status: response.status,
        detail: response.ok
          ? undefined
          : (await response.text()).trim().slice(0, 180),
      };
    } catch (error) {
      return {
        ok: false,
        status: 502,
        detail: error instanceof Error ? error.message : "relay_failed",
      };
    }
  });
