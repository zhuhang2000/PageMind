import { BRIDGE_URL } from "./constants.js";
import { getInviteCode } from "./invite-code.js";

async function request(path, options = {}) {
  const { method = "POST", body, timeout = 120000 } = options;
  const headers = {};
  const inviteCode = getInviteCode();

  if (inviteCode) {
    headers["X-PageMind-Invite-Code"] = inviteCode;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Bridge 返回格式错误" }));
  if (!res.ok || !data.ok) {
    const error = new Error(data.error || "Bridge 返回未知错误");
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  checkHealth: () => request("/health", { method: "GET", timeout: 3000 }),
  summarize: (body) => request("/summarize", { body }),
  captureWindowsSnip: () => request("/screenshot/windows-snip", { body: {}, timeout: 70000 }),
  exportGoogleDocs: (body) => request("/export/google-docs", { body, timeout: 60000 }),
};
