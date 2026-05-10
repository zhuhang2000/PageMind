import { buildWebAnalysisPrompt } from "../lib/prompt-builder.js";

const BASE_URL = trimTrailingSlash(process.env.DEEPSEEK_BASE_URL);
const MODEL = process.env.DEEPSEEK_MODEL;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const TIMEOUT_MS = process.env.DEEPSEEK_TIMEOUT_MS;

export async function runDeepSeek(prompt, options = {}) {
    const apiKey = API_KEY;
    if (!apiKey) {
        throw new Error("未配置 DEEPSEEK_API_KEY");
    }

    const fetchImpl = options.fetchImpl || fetch;
    const model = options.model || MODEL;
    const baseUrl = trimTrailingSlash(options.baseUrl || BASE_URL);
    const timeoutMs = options.timeoutMs || TIMEOUT_MS;
    const payload = buildDeepSeekPayload({ prompt, model });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const text = await response.text();
        const data = parseJson(text);

        if (!response.ok) {
            const message =
                data?.error?.message || data?.message || text.slice(0, 500) || `HTTP ${response.status}`;
            throw new Error(`DeepSeek API 调用失败：${message}`);
        }

        const summary = readDeepSeekSummary(data);
        if (!summary) {
            throw new Error("DeepSeek 未返回文本结果");
        }

        return summary;
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error(`DeepSeek API 调用超时（${timeoutMs}ms）`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

export function buildDeepSeekPayload({ prompt, model = MODEL }) {
    return {
        model,
        messages: [
            {
                role: "system",
                content: "你是一个网页内容分析助手。只分析用户提供的网页内容，不访问外部网页，不编造未提供的信息。",
            },
            { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        stream: false,
    };
}

export function readDeepSeekSummary(data) {
    return data?.choices?.[0]?.message?.content?.trim() || "";
}

export function buildDeepSeekPrompt({ content, instruction }) {
    return buildWebAnalysisPrompt({
        role: "你是一个网页内容分析助手。请分析用户提供的网页内容与任务指令。",
        content,
        instruction,
        footer: "请用中文回答，直接输出结果，不要重复引用原文，不要分析本地文件。",
    });
}

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
}
