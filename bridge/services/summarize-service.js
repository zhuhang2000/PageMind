import { getProvider } from "../providers/registry.js";
import { saveRequestImages, cleanupFiles } from "./image-service.js";

const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || "gemini";

export async function summarize({
  provider: providerName = DEFAULT_PROVIDER,
  title = "",
  url = "",
  content = "",
  images = [],
  instruction = "请用中文总结这个网页的核心观点",
}) {
  if (!content.trim() && (!Array.isArray(images) || images.length === 0)) {
    throw Object.assign(new Error("网页内容和图片都为空"), { statusCode: 400 });
  }

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
    console.log(`[bridge] ${providerName} 调用成功`);
    console.log(summary);

    return { provider: providerName, summary };
  } finally {
    await cleanupFiles(cleanupPaths);
  }
}
