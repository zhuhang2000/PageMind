import { BRIDGE_URL, PAGEMIND_BETA_TOKEN } from "./constants.js";

async function request(path, options = {}) {
  const { method = "POST", body, timeout = 120000 } = options;
  const headers = {
    "X-PageMind-Beta-Token": PAGEMIND_BETA_TOKEN,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers,
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
