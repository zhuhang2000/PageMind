export function normalizePanelText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function makePanelPreview(text, maxLen = 260) {
  const compact = normalizePanelText(text).replace(/\n+/g, " ");
  return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact;
}

export function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
