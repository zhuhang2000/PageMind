import { BRIDGE_URL } from "./constants.js";

async function request(path, options = {}) {
  const { method = "POST", body, timeout = 120000 } = options;
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Bridge 返回未知错误");
  return data;
}

export const api = {
  checkHealth: () => request("/health", { method: "GET", timeout: 3000 }),
  summarize: (body) => request("/summarize", { body }),
  captureWindowsSnip: () => request("/screenshot/windows-snip", { body: {}, timeout: 70000 }),
  exportGoogleDocs: (body) => request("/export/google-docs", { body, timeout: 60000 }),
};
