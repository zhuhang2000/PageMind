import { runGemini, buildGeminiPrompt } from "./gemini.js";
import { runDeepSeek, buildDeepSeekPrompt } from "./deepseek.js";
import { runCodex, buildCodexPrompt } from "./codex.js";

const providers = new Map([
  ["gemini", { run: runGemini, buildPrompt: buildGeminiPrompt, supportsImages: true }],
  ["deepseek", { run: runDeepSeek, buildPrompt: buildDeepSeekPrompt, supportsImages: false }],
  ["codex", { run: runCodex, buildPrompt: buildCodexPrompt, supportsImages: false }],
]);

export function getProvider(name) {
  const provider = providers.get(name);
  if (!provider) {
    throw Object.assign(new Error(`未知 provider: ${name}`), { statusCode: 400 });
  }
  return provider;
}

export function listProviderNames() {
  return [...providers.keys()];
}
