import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnv(path.join(__dirname, ".env"));

const PORT = parseInt(process.env.DEEPSEEK_DEMO_PORT || "18888", 10);
const BASE_URL = trimTrailingSlash(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com");
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const SERVER_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEMO_TOKEN = process.env.DEEPSEEK_DEMO_TOKEN || "";
const TIMEOUT_MS = parseInt(process.env.DEEPSEEK_TIMEOUT_MS || "60000", 10);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const routes = new Set(["/deepseek-web-analyse", "/geminiwebanalse", "/summarize"]);

export const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        provider: "deepseek",
        model: DEFAULT_MODEL,
        version: "0.1.0",
      });
    }

    if (req.method !== "POST" || !routes.has(url.pathname)) {
      return sendJson(res, 404, { ok: false, error: "未找到接口" });
    }

    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: "鉴权失败" });
    }

    const body = await readJsonBody(req);
    const result = await analyseWithDeepSeek(body, req);
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message || "服务异常",
    });
  }
});

if (isMainModule()) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`DeepSeek demo 已启动：http://127.0.0.1:${PORT}`);
    console.log(`接口：http://127.0.0.1:${PORT}/deepseek-web-analyse`);
    console.log(`模型：${DEFAULT_MODEL}`);
    console.log(`API Key：${SERVER_API_KEY ? "已从环境变量读取" : "未配置，可通过请求头 x-deepseek-api-key 传入"}`);
    console.log(`Demo Token：${DEMO_TOKEN ? "已启用" : "未启用"}`);
  });
}

async function analyseWithDeepSeek(body, req) {
  const {
    title = "",
    url = "",
    content = "",
    instruction = "请用中文总结这个网页的核心观点",
    model = DEFAULT_MODEL,
    apiKey = "",
    temperature = 0.2,
    max_tokens = 1200,
  } = body || {};

  if (!String(content).trim()) {
    throw httpError(400, "content 不能为空");
  }

  const keyFromHeader = String(req.headers["x-deepseek-api-key"] || "").trim();
  const deepseekApiKey = keyFromHeader || String(apiKey || "").trim() || SERVER_API_KEY;

  if (!deepseekApiKey) {
    throw httpError(400, "未配置 DeepSeek API Key。请设置 DEEPSEEK_API_KEY，或传入 x-deepseek-api-key 请求头");
  }

  const prompt = buildWebAnalysePrompt({
    title: String(title || ""),
    url: String(url || ""),
    content: String(content || ""),
    instruction: String(instruction || ""),
  });

  const data = await callDeepSeek({
    apiKey: deepseekApiKey,
    model: String(model || DEFAULT_MODEL),
    messages: [
      {
        role: "system",
        content: "你是一个网页内容分析助手。只分析用户提供的网页内容，不访问外部网页，不编造未提供的信息。",
      },
      { role: "user", content: prompt },
    ],
    temperature,
    max_tokens,
  });

  const summary = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!summary) {
    throw httpError(502, "DeepSeek 未返回文本结果");
  }

  return {
    ok: true,
    provider: "deepseek",
    model: data.model || model || DEFAULT_MODEL,
    summary,
    usage: data.usage || null,
  };
}

export function buildWebAnalysePrompt({ title, url, content, instruction }) {
  return `任务指令：${instruction}

网页标题：${title}
网页URL：${url}

---网页内容开始---
${content}
---网页内容结束---

请用中文直接输出结果，不要重复大段原文。`;
}

async function callDeepSeek({ apiKey, model, messages, temperature, max_tokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = parseJson(text);

    if (!response.ok) {
      const message = data?.error?.message || data?.message || text.slice(0, 500) || `DeepSeek HTTP ${response.status}`;
      throw httpError(response.status, `DeepSeek API 调用失败：${message}`);
    }

    if (!data) {
      throw httpError(502, "DeepSeek 返回了非 JSON 响应");
    }

    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw httpError(504, `DeepSeek API 调用超时（${TIMEOUT_MS}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        reject(httpError(413, "请求体过大，最多 2MB"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      const data = parseJson(raw);
      if (!data) {
        reject(httpError(400, "请求体不是合法 JSON"));
        return;
      }
      resolve(data);
    });

    req.on("error", reject);
  });
}

function isAuthorized(req) {
  if (!DEMO_TOKEN) return true;
  const auth = String(req.headers.authorization || "");
  return auth.replace(/^Bearer\s+/i, "").trim() === DEMO_TOKEN;
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-deepseek-api-key");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  if (statusCode === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
