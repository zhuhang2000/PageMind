import { getProvider } from "../providers/registry.js";
import { saveRequestImages, cleanupFiles } from "./image-service.js";

const SHORT_TEXT_PROVIDER = "deepseek";
const LONG_TEXT_PROVIDER = "gemini";
const IMAGE_PROVIDER = "gemini";
const SHORT_TEXT_MAX_CHARS = 2000;

export async function summarize({
  title = "",
  url = "",
  content = "",
  images = [],
  instruction = "请用中文总结这个网页的核心观点",
}) {
  if (!content.trim() && (!Array.isArray(images) || images.length === 0)) {
    throw Object.assign(new Error("网页内容和图片都为空"), { statusCode: 400 });
  }

  const providerName = selectProviderName({ content, images });
  const provider = getProvider(providerName);

  if (Array.isArray(images) && images.length > 0 && !provider.supportsImages) {
    throw Object.assign(new Error("图片输入目前仅支持 Gemini"), { statusCode: 400 });
  }

  let cleanupPaths = [];
  try {
    let savedImages = { saved: [], cleanupPaths: [] };
    if (provider.supportsImages) {
      savedImages = await saveRequestImages(images);
      cleanupPaths = savedImages.cleanupPaths;
    }

    const prompt = provider.buildPrompt({
      title,
      url,
      content,
      instruction,
      images: savedImages.saved,
    });

    const summary = await provider.run(prompt);
    console.log(`[bridge] ${providerName} 调用成功（${describeProviderRouting({ content, images })}）`);
    console.log(summary);

    return { provider: providerName, summary };
  } finally {
    await cleanupFiles(cleanupPaths);
  }
}

function selectProviderName({ content = "", images = [] }) {
  if (hasImages(images)) {
    return IMAGE_PROVIDER;
  }

  return getTextLength(content) < SHORT_TEXT_MAX_CHARS ? SHORT_TEXT_PROVIDER : LONG_TEXT_PROVIDER;
}

function describeProviderRouting({ content = "", images = [] }) {
  if (hasImages(images)) {
    return "包含图片，使用 Gemini";
  }

  const textLength = getTextLength(content);
  return textLength < SHORT_TEXT_MAX_CHARS
    ? `文本 ${textLength} 字，小于 ${SHORT_TEXT_MAX_CHARS}，使用 DeepSeek`
    : `文本 ${textLength} 字，大于等于 ${SHORT_TEXT_MAX_CHARS}，使用 Gemini`;
}

function hasImages(images) {
  return Array.isArray(images) && images.length > 0;
}

function getTextLength(content) {
  return String(content || "").trim().length;
}
