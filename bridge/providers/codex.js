import { spawn } from "node:child_process";
import { buildWebAnalysisPrompt } from "../lib/prompt-builder.js";

const CODEX_CMD = process.env.CODEX_CMD;
const TIMEOUT_MS = process.env.CLI_TIMEOUT_MS;

/**
 * 通过 codex exec 调用 Codex CLI（非交互模式）
 * 明确限制：只做文本分析，不修改文件，不执行命令
 */
export async function runCodex(prompt) {
    return new Promise((resolve, reject) => {
        const child = spawn(CODEX_CMD, ["exec", prompt], {
            shell: true,
            env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));

        const timer = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error("Codex CLI 调用超时"));
        }, TIMEOUT_MS);

        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0 && stdout.trim()) {
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr.trim() || `Codex CLI 退出码 ${code}`));
            }
        });

        child.on("error", (err) => {
            clearTimeout(timer);
            reject(new Error(`Codex CLI 启动失败：${err.message}`));
        });
    });
}

/**
 * 构造发给 Codex 的完整 prompt
 * 明确禁止文件操作，确保只做文本分析
 */
export function buildCodexPrompt({ title, url, content, instruction }) {
    return buildWebAnalysisPrompt({
        role: `你是一个网页内容分析助手。请严格遵守以下规则：
- 只分析用户提供的文本内容，给出回答
- 禁止修改任何文件
- 禁止执行任何 shell 命令
- 禁止创建任何计划任务或代码
- 只输出文字回答`,
        title,
        url,
        content,
        instruction,
        instructionLabel: "用户指令",
        instructionPosition: "after-content",
        footer: "请用中文直接输出分析结果。",
    });
}
