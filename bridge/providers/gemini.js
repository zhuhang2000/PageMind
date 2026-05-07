import { spawn } from "node:child_process";
import { buildWebAnalysisPrompt } from "../lib/prompt-builder.js";

const DEFAULT_TIMEOUT_MS = 300000;
const TIMEOUT_MS = parseInt(process.env.CLI_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
const MCP_SERVER_PATH =
  process.env.GEMINI_MCP_SERVER_PATH ||
  "C:\\Users\\hang\\mcp-servers\\gemini-agent-mcp\\dist\\index.js";
const MAX_MCP_PROMPT_CHARS = parseInt(process.env.GEMINI_MCP_MAX_PROMPT_CHARS || "0", 10);

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function readTextContent(response) {
  const parts = response?.result?.content || [];
  return parts
    .filter((part) => part?.type === "text")
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

/**
 * 通过 Gemini MCP 调用网页助手专用 gemini_analyse_web。
 */
export async function runGemini(prompt) {
  return new Promise((resolve, reject) => {
    const trimmedPrompt =
      MAX_MCP_PROMPT_CHARS > 0 && prompt.length > MAX_MCP_PROMPT_CHARS
        ? `${prompt.slice(0, MAX_MCP_PROMPT_CHARS)}\n...[内容过长，已由 bridge 截断以避免 Windows 命令行长度限制]`
        : prompt;
    const mcpPrompt = trimmedPrompt;
    const child = spawn(process.execPath, [MCP_SERVER_PATH], {
      cwd: process.cwd(),
      shell: false,
      env: { ...process.env, LANG: "en_US.UTF-8" },
    });

    let stdoutBuffer = "";
    let stderr = "";
    let isFinished = false;
    let nextId = 1;
    let initialized = false;
    const pending = new Map();

    function finish(error, value) {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      pending.clear();
      child.stdin.end();
      child.kill();

      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }

    function request(method, params) {
      const id = nextId++;
      writeMessage(child, { jsonrpc: "2.0", id, method, params });
      return new Promise((resolveRequest, rejectRequest) => {
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
      });
    }

    async function callGeminiRun() {
      try {
        await request("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "chrome-plugin-bridge", version: "1.0.0" },
        });

        initialized = true;
        writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

        const response = await request("tools/call", {
          name: "gemini_analyse_web",
          arguments: {
            prompt: mcpPrompt,
            cwd: process.cwd(),
            timeout: Math.ceil(TIMEOUT_MS / 1000),
          },
        });

        const text = readTextContent(response);
        if (!text) {
          finish(new Error(stderr.trim() || "Gemini MCP 未返回文本结果"));
          return;
        }
        if (text.startsWith("错误:")) {
          finish(new Error(text));
          return;
        }
        finish(null, text);
      } catch (err) {
        finish(err);
      }
    }

    const timer = setTimeout(() => {
      const details = stderr.trim().slice(0, 2000);
      finish(new Error(`Gemini MCP 调用超时（${TIMEOUT_MS}ms）${details ? `：${details}` : ""}`));
    }, TIMEOUT_MS + 5000);

    child.stdout.on("data", (data) => {
      stdoutBuffer += data.toString("utf8");

      let newlineIndex;
      while ((newlineIndex = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (!line) continue;

        let message;
        try {
          message = JSON.parse(line);
        } catch {
          stderr += `\n[Invalid MCP stdout] ${line}`;
          continue;
        }

        const pendingRequest = pending.get(message.id);
        if (!pendingRequest) continue;
        pending.delete(message.id);

        if (message.error) {
          pendingRequest.reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          pendingRequest.resolve(message);
        }
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf8");
    });

    child.on("close", (code) => {
      if (!isFinished) {
        const phase = initialized ? "调用中断" : "启动失败";
        finish(new Error(stderr.trim() || `Gemini MCP ${phase}，退出码 ${code}`));
      }
    });

    child.on("error", (err) => {
      finish(new Error(`Gemini MCP 启动失败：${err.message}`));
    });

    callGeminiRun();
  });
}

/**
 * 构造发给 Gemini 的完整 prompt
 */
export function buildGeminiPrompt({ title, url, content, instruction, images = [] }) {
  return buildWebAnalysisPrompt({
    role: "你是一个网页内容分析助手。请只分析用户提供的网页内容，不要分析当前目录的任何文件。",
    title,
    url,
    content,
    instruction,
    images,
    imageInstruction: "请同时结合上述图片内容进行分析。如果任务主要针对图片，请优先分析图片。",
    footer: "请用中文回答，直接输出结果，不要重复引用原文，不要分析本地文件。",
  });
}
