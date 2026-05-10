#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

process.env.LANG = process.env.LANG || "en_US.UTF-8";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, "..", "logs", "gemini-web-agent");
const PROMPT_DIR = path.join(LOG_DIR, "prompts");
const DEFAULT_TIMEOUT_MS = 300000;
const MAX_COMMAND_PROMPT_CHARS = 6000;
const GEMINI_CMD = process.env.GEMINI_CMD || "gemini";

ensureDir(LOG_DIR);
ensureDir(PROMPT_DIR);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeResponse(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function makeTextResult(text) {
  return { content: [{ type: "text", text: String(text || "") }] };
}

function createPromptFile(prompt) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const promptPath = path.join(PROMPT_DIR, `prompt-${id}.txt`);
  fs.writeFileSync(promptPath, prompt, { encoding: "utf8" });
  return promptPath;
}

function removePromptFile(promptPath) {
  if (!promptPath) return;
  try {
    fs.unlinkSync(promptPath);
  } catch {
    // 临时 prompt 文件清理失败不影响本次响应。
  }
}

function buildWebCliPrompt(promptFilePath) {
  return `请读取并分析这个 UTF-8 文本文件中的完整网页助手请求：${promptFilePath}
该文件中可能包含网页正文、用户指令以及用户上传图片的本地路径。请只根据该文件明确提供的网页内容和图片路径进行回答，不要主动分析 cwd 中的其他无关本地文件。`;
}

function cleanOutput(text) {
  const noisePatterns = [
    /MCP issues detected\. Run \/mcp list for status\./gi,
    /Warning: 256-color support not detected\./gi,
    /Using a terminal with at least 256-color support is recommended/gi,
    /Ripgrep is not available\. Falling back to GrepTool\./gi,
    /Skill ".*" from ".*" is overriding the built-in skill\./gi,
    /\(node:\d+\) \[DEP0190\] DeprecationWarning:.*/gi,
  ];
  return noisePatterns.reduce((value, pattern) => value.replace(pattern, ""), String(text || "")).trim();
}

function getAuditLogPath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `audit-${date}.log`);
}

function logAudit(params, result, error) {
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const separator = "=".repeat(80);
  const entry = [
    "",
    separator,
    `[${timestamp}] TOOL: gemini_analyse_web`,
    `> CWD: ${params.cwd || process.cwd()}`,
    `> PROMPT:\n${params.prompt || ""}`,
    result?.command ? `> COMMAND:\n${result.command}` : "",
    error ? `[STATUS] ERROR\n${error.message || String(error)}` : `[STATUS] ${result?.exitCode === 0 ? "SUCCESS" : `FAILED (${result?.exitCode})`}`,
    result?.stdout ? `[RESPONSE STDOUT]:\n${result.stdout}` : "",
    result?.stderr ? `[RESPONSE STDERR]:\n${result.stderr}` : "",
    separator,
  ].filter(Boolean).join("\n");

  try {
    fs.appendFileSync(getAuditLogPath(), `${entry}\n`, { encoding: "utf8" });
  } catch (err) {
    process.stderr.write(`写入 Gemini 审计日志失败: ${err.message}\n`);
  }
}

async function runGeminiAnalyseWeb({ prompt, cwd, timeout }) {
  const timeoutMs = timeout && timeout > 0 ? timeout * 1000 : DEFAULT_TIMEOUT_MS;
  const promptFilePath = prompt.length > MAX_COMMAND_PROMPT_CHARS || /\r?\n/.test(prompt)
    ? createPromptFile(prompt)
    : "";
  const cliPrompt = promptFilePath ? buildWebCliPrompt(promptFilePath) : prompt;
  const args = ["--yolo", "--skip-trust"];

  if (promptFilePath) {
    args.push("--include-directories", PROMPT_DIR);
  }
  args.push("--prompt", cliPrompt);

  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : GEMINI_CMD;
  const spawnArgs = isWin ? ["/c", GEMINI_CMD, ...args] : args;
  const command = promptFilePath
    ? `${GEMINI_CMD} --yolo --skip-trust --include-directories "[prompt dir]" --prompt "[web prompt file: ${promptFilePath}]"`
    : `${GEMINI_CMD} --yolo --skip-trust --prompt "${prompt.slice(0, 50)}..."`;

  return new Promise((resolve) => {
    const child = spawn(cmd, spawnArgs, {
      cwd: cwd || process.cwd(),
      shell: false,
      env: {
        ...process.env,
        LANG: "en_US.UTF-8",
        GEMINI_CLI_TRUST_WORKSPACE: "true",
      },
    });

    let stdout = "";
    let stderr = "";
    let isFinished = false;

    function finish(result) {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      removePromptFile(promptFilePath);
      resolve(result);
    }

    const timer = setTimeout(() => {
      child.kill();
      finish({
        stdout: cleanOutput(stdout),
        stderr: `${cleanOutput(stderr)}\n[Execution Timeout]`.trim(),
        exitCode: null,
        command,
      });
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString("utf8");
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf8");
    });

    child.on("close", (code) => {
      finish({
        stdout: cleanOutput(stdout),
        stderr: cleanOutput(stderr),
        exitCode: code,
        command,
      });
    });

    child.on("error", (err) => {
      finish({
        stdout: cleanOutput(stdout),
        stderr: `${cleanOutput(stderr)}\n[Spawn Error: ${err.message}]`.trim(),
        exitCode: 1,
        command,
      });
    });
  });
}

async function handleRequest(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "pagemind-gemini-web-agent", version: "1.0.0" },
    };
  }

  if (message.method === "tools/list") {
    return {
      tools: [
        {
          name: "gemini_analyse_web",
          title: "Analyse Web Content",
          description: "网页助手专用接口，支持长网页内容和图片路径。",
          inputSchema: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              cwd: { type: "string" },
              timeout: { type: "number" },
            },
            required: ["prompt"],
            additionalProperties: false,
          },
        },
      ],
    };
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments || {};
    if (name !== "gemini_analyse_web") {
      throw new Error(`未知工具: ${name}`);
    }
    if (!args.prompt || typeof args.prompt !== "string") {
      throw new Error("gemini_analyse_web requires string argument: prompt");
    }

    const result = await runGeminiAnalyseWeb(args);
    logAudit(args, result);
    return makeTextResult(result.stdout || `错误: ${result.stderr || "Gemini CLI 未返回文本结果"}`);
  }

  throw new Error(`不支持的 MCP 方法: ${message.method}`);
}

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;

  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch (err) {
      writeResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `JSON parse error: ${err.message}` },
      });
      continue;
    }

    if (!Object.hasOwn(message, "id")) {
      continue;
    }

    handleRequest(message)
      .then((result) => {
        writeResponse({ jsonrpc: "2.0", id: message.id, result });
      })
      .catch((err) => {
        logAudit(message.params?.arguments || {}, null, err);
        writeResponse({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32000, message: err.message || String(err) },
        });
      });
  }
});

process.stderr.write("PageMind Gemini Web Agent MCP shim running (stdio)\n");
