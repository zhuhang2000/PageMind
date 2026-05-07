import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonFromStdout } from "../lib/parse-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_DIR = path.resolve(__dirname, "..");
const WINDOWS_SNIP_TIMEOUT_MS = parseInt(process.env.WINDOWS_SNIP_TIMEOUT_MS || "60000", 10);
const WINDOWS_SNIP_SCRIPT = path.join(BRIDGE_DIR, "scripts", "capture-screenclip.ps1");
const SCREENSHOT_TEMP_DIR = path.join(os.tmpdir(), "ai-web-assistant-screenshots");
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

let isWindowsSnipRunning = false;

export function getIsWindowsSnipRunning() {
  return isWindowsSnipRunning;
}

export async function captureWindowsSnip() {
  if (isWindowsSnipRunning) {
    throw Object.assign(
      new Error("已有截图任务正在进行，请先完成或取消当前截图"),
      { statusCode: 409 }
    );
  }

  isWindowsSnipRunning = true;
  try {
    return await doCapture();
  } finally {
    isWindowsSnipRunning = false;
  }
}

async function doCapture() {
  await fs.mkdir(SCREENSHOT_TEMP_DIR, { recursive: true });
  const outputPath = path.join(
    SCREENSHOT_TEMP_DIR,
    `windows-snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  );

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Sta",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_SNIP_SCRIPT,
        "-OutputPath",
        outputPath,
        "-TimeoutSeconds",
        String(Math.ceil(WINDOWS_SNIP_TIMEOUT_MS / 1000)),
      ],
      {
        cwd: BRIDGE_DIR,
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";
    let finished = false;

    function finish(error, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!child.killed) child.kill();

      if (error) {
        fs.unlink(outputPath).catch(() => {});
        reject(error);
      } else {
        resolve(value);
      }
    }

    const timer = setTimeout(() => {
      finish(new Error("截图已取消或超时"));
    }, WINDOWS_SNIP_TIMEOUT_MS + 5000);

    child.stdout.on("data", (data) => {
      stdout += data.toString("utf8");
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf8");
    });

    child.on("error", (err) => {
      finish(new Error(`启动 Windows 截图工具失败：${err.message}`));
    });

    child.on("close", async (code) => {
      if (finished) return;

      const result = parseJsonFromStdout(stdout);
      if (!result?.ok) {
        finish(new Error(result?.error || stderr.trim() || `截图工具退出码 ${code}`));
        return;
      }

      try {
        const bytes = await fs.readFile(result.path || outputPath);
        if (bytes.length > MAX_SCREENSHOT_BYTES) {
          finish(new Error("截图图片过大，单张最多 8MB"));
          return;
        }

        await fs.unlink(result.path || outputPath).catch(() => {});
        finish(null, {
          name: result.name || `windows-snip-${Date.now()}.png`,
          mimeType: "image/png",
          size: bytes.length,
          dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
        });
      } catch (err) {
        finish(new Error(`读取截图失败：${err.message}`));
      }
    });
  });
}
