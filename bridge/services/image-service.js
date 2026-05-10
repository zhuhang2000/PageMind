import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const GEMINI_MCP_ASSET_DIR = process.env.GEMINI_MCP_ASSET_DIR
  ? path.resolve(BRIDGE_ROOT, process.env.GEMINI_MCP_ASSET_DIR)
  : path.resolve(BRIDGE_ROOT, "assets", "gemini");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_EXT_MAP = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function imageExtension(mimeType) {
  return MIME_EXT_MAP[mimeType] || "";
}

export async function saveRequestImages(images = []) {
  const saved = [];
  const cleanupPaths = [];

  if (!Array.isArray(images) || images.length === 0) {
    return { saved, cleanupPaths };
  }

  await fs.mkdir(GEMINI_MCP_ASSET_DIR, { recursive: true });

  for (const image of images.slice(0, 5)) {
    const dataUrl = image?.dataUrl || "";
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
    if (!match) continue;

    const mimeType = match[1];
    const ext = imageExtension(mimeType);
    if (!ext) continue;

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`图片过大：${image.name || mimeType}`);
    }

    const safeName = String(image.name || "image")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 60);
    const fileName = `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}${ext}`;
    const filePath = path.join(GEMINI_MCP_ASSET_DIR, fileName);

    await fs.writeFile(filePath, bytes);
    cleanupPaths.push(filePath);
    saved.push({
      name: image.name || fileName,
      mimeType,
      path: filePath,
    });
  }

  return { saved, cleanupPaths };
}

export async function cleanupFiles(paths) {
  await Promise.all(
    paths.map((filePath) =>
      fs.unlink(filePath).catch(() => {})
    )
  );
}
