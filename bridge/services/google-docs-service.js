const GOOGLE_DOCS_WEBHOOK_URL = process.env.GOOGLE_DOCS_WEBHOOK_URL || "";
const GOOGLE_DOCS_WEBHOOK_SECRET = process.env.GOOGLE_DOCS_WEBHOOK_SECRET || "";

export function redactSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/secret|token|password|key/i.test(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactSensitiveFields(item)];
    })
  );
}

export async function exportToGoogleDocs({ title = "AI 网页助手总结", url = "", summary = "" }) {
  if (!GOOGLE_DOCS_WEBHOOK_URL) {
    throw Object.assign(
      new Error("未配置 GOOGLE_DOCS_WEBHOOK_URL，请先在 .env 中配置 Google Apps Script Web App URL"),
      { statusCode: 400 }
    );
  }

  if (!summary.trim()) {
    throw Object.assign(
      new Error("summary 为空，无法导出"),
      { statusCode: 400 }
    );
  }

  const response = await fetch(GOOGLE_DOCS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, url, summary, secret: GOOGLE_DOCS_WEBHOOK_SECRET }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: response.ok, raw: text };
  }

  console.log("[bridge] Google Docs webhook response:", {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type") || "",
    rawPreview: text.slice(0, 1000),
    parsed: redactSensitiveFields(data),
  });

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Google Docs webhook 返回 ${response.status}`);
  }

  return { url: data.url || data.documentUrl || "" };
}
