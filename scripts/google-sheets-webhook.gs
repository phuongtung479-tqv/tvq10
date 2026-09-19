const SHEET_NAME = "Leads";
const DEDUPE_PREFIX = "tvq10_lead_";

function removeLegacyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (
      handler === "autoRemoveEmptyRows" ||
      handler === "myFunction" ||
      handler === "removeLegacyTriggers"
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  return "Legacy triggers removed";
}

function doGet() {
  return jsonResponse({ ok: true, service: "tvq10-google-sheets-webhook" });
}

// Chạy thủ công hàm này trong Apps Script để kiểm tra quyền ghi vào Sheet.
// Không chạy doPost bằng nút Run vì doPost cần HTTP event từ Web App.
function testWebhookInSheet() {
  var payload = {
    event: "sheets_manual_test",
    webhook_delivery_id: "manual-test-" + new Date().getTime(),
    idempotency_key: "manual-test-" + new Date().getTime(),
    full_name: "Test Google Sheets webhook",
    phone: "0900000000",
    email: "",
    city: "Hà Nội",
    major: "manual_test",
    source: "apps_script_test",
  };
  var result = writePayload(payload);
  Logger.log(JSON.stringify(result));
  return result;
}

function doPost(event) {
  try {
    const payload = parsePayload(event);
    return jsonResponse(writePayload(payload));
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function writePayload(payload) {
  const idempotencyKey = String(payload.idempotency_key || payload.webhook_delivery_id || "").trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const properties = PropertiesService.getScriptProperties();
    if (idempotencyKey && properties.getProperty(DEDUPE_PREFIX + idempotencyKey)) {
      return { ok: true, duplicate: true, idempotency_key: idempotencyKey };
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error("Script chưa được gắn với Google Sheet");
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    const headers = [
      "received_at", "event", "webhook_delivery_id", "idempotency_key",
      "full_name", "phone", "email", "city", "major", "source",
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "landing_url", "ai_score", "ai_rank", "risk_level", "recommended_action",
      "sale_advice", "behavior_summary", "device_tech_info", "traffic_ads_source",
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
    return { ok: true, duplicate: false, idempotency_key: idempotencyKey };
  } finally {
    lock.releaseLock();
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
