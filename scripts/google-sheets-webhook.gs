const SHEET_NAME = "Leads";
const DEDUPE_PREFIX = "tvq10_lead_";

function doPost(event) {
  try {
    const payload = parsePayload(event);
    const idempotencyKey = String(payload.idempotency_key || payload.webhook_delivery_id || "").trim();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const properties = PropertiesService.getScriptProperties();
      if (idempotencyKey && properties.getProperty(DEDUPE_PREFIX + idempotencyKey)) {
        return jsonResponse({ ok: true, duplicate: true, idempotency_key: idempotencyKey });
      }

      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
      const headers = [
        "received_at",
        "event",
        "webhook_delivery_id",
        "idempotency_key",
        "full_name",
        "phone",
        "email",
        "city",
        "major",
        "source",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "landing_url",
        "ai_score",
        "ai_rank",
        "risk_level",
        "recommended_action",
        "sale_advice",
        "behavior_summary",
        "device_tech_info",
        "traffic_ads_source",
        "raw_payload"
      ];

      ensureHeaders(sheet, headers);
      sheet.appendRow(headers.map(function(header) {
        if (header === "received_at") return new Date();
        if (header === "raw_payload") return JSON.stringify(payload);
        return valueForSheet(payload[header]);
      }));

      if (idempotencyKey) {
        properties.setProperty(DEDUPE_PREFIX + idempotencyKey, new Date().toISOString());
      }
      return jsonResponse({ ok: true, duplicate: false, idempotency_key: idempotencyKey });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function parsePayload(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("Missing JSON request body");
  }
  const payload = JSON.parse(event.postData.contents);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload must be a JSON object");
  }
  return payload;
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const matches = headers.every(function(header, index) {
    return current[index] === header;
  });
  if (!matches) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function valueForSheet(value) {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).slice(0, 49000);
}

function jsonResponse(body, status) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
