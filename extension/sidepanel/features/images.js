import { attachmentBtn, captureSnipBtn, imagePreviewList } from "../lib/dom-refs.js";
import {
  MAX_FILE_BYTES,
  MAX_FILE_COUNT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TOTAL_FILE_CHARS,
  MAX_TOTAL_IMAGE_BYTES,
} from "../lib/constants.js";
import { getAttachedFiles, getAttachedImages, setAttachedFiles, setAttachedImages } from "../lib/state.js";
import { api } from "../lib/api.js";
import { renderError } from "./results.js";

const ALLOWED_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
  "xml",
  "log",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "sql",
  "yaml",
  "yml",
]);

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function getFileExtension(fileName = "") {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function isSupportedTextFile(file) {
  if (file.type?.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml") return true;
  return ALLOWED_FILE_EXTENSIONS.has(getFileExtension(file.name));
}

async function readTextAttachment(file) {
  const text = await file.text();
  return {
    name: file.name,
    mimeType: file.type || "text/plain",
    size: file.size,
    text,
  };
}

export async function addImages(files) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const nextImages = [];

  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      throw new Error(`不支持的图片格式：${file.name}`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`图片过大：${file.name}，单张最多 8MB`);
    }
    nextImages.push(await readImageFile(file));
  }

  appendImages(nextImages);
}

export async function addFiles(files) {
  const nextFiles = [];

  for (const file of files) {
    if (!isSupportedTextFile(file)) {
      throw new Error(`暂不支持此文件格式：${file.name}`);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`文件过大：${file.name}，单个文件最多 2MB`);
    }
    nextFiles.push(await readTextAttachment(file));
  }

  appendFiles(nextFiles);
}

function appendImages(nextImages) {
  const attachedImages = getAttachedImages();
  const merged = [...attachedImages, ...nextImages].slice(0, MAX_IMAGE_COUNT);
  const totalSize = merged.reduce((sum, image) => sum + (image.size || 0), 0);
  if (totalSize > MAX_TOTAL_IMAGE_BYTES) {
    throw new Error("图片总大小过大，最多约 12MB");
  }

  setAttachedImages(merged);
  renderImageAttachments();
}

function appendFiles(nextFiles) {
  const attachedFiles = getAttachedFiles();
  const merged = [...attachedFiles, ...nextFiles].slice(0, MAX_FILE_COUNT);
  const totalChars = merged.reduce((sum, file) => sum + (file.text?.length || 0), 0);
  if (totalChars > MAX_TOTAL_FILE_CHARS) {
    throw new Error("文件内容过长，最多约 12 万字");
  }

  setAttachedFiles(merged);
  renderImageAttachments();
}

export function clearAttachedImages() {
  setAttachedImages([]);
  renderImageAttachments();
}

export async function captureWindowsSnip() {
  setSnipButtonsDisabled(true);

  try {
    const data = await api.captureWindowsSnip();
    if (!data.image?.dataUrl) {
      throw new Error("截图失败，请确认 Windows 截图工具可用");
    }
    appendImages([data.image]);
  } catch (err) {
    renderError(err.message || "截图失败，请重试");
    renderImageAttachments();
  } finally {
    setSnipButtonsDisabled(false);
  }
}

function setSnipButtonsDisabled(disabled) {
  attachmentBtn.disabled = disabled;
  captureSnipBtn.disabled = disabled;
}

function removeImageAt(index) {
  const attachedImages = getAttachedImages();
  attachedImages.splice(index, 1);
  setAttachedImages(attachedImages);
  renderImageAttachments();
}

function removeFileAt(index) {
  const attachedFiles = getAttachedFiles();
  attachedFiles.splice(index, 1);
  setAttachedFiles(attachedFiles);
  renderImageAttachments();
}

function formatFileSize(size = 0) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${size} B`;
}

export function buildAttachedFileContent() {
  const attachedFiles = getAttachedFiles();
  if (attachedFiles.length === 0) return "";

  return attachedFiles
    .map((file, index) => {
      const title = file.name || `文件 ${index + 1}`;
      return `## 附件文件：${title}\n${file.text || ""}`;
    })
    .join("\n\n");
}

export function renderImageAttachments() {
  const attachedImages = getAttachedImages();
  const attachedFiles = getAttachedFiles();
  imagePreviewList.innerHTML = "";
  imagePreviewList.classList.toggle("has-images", attachedImages.length + attachedFiles.length > 0);

  if (attachedImages.length + attachedFiles.length === 0) return;

  attachedImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const preview = document.createElement("img");
    preview.className = "image-preview";
    preview.src = image.dataUrl;
    preview.alt = image.name || "图片";
    preview.title = image.name || "图片";

    const removeBtn = document.createElement("button");
    removeBtn.className = "image-remove-btn";
    removeBtn.type = "button";
    removeBtn.title = "删除这张图片";
    removeBtn.setAttribute("aria-label", "删除这张图片");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeImageAt(index));

    item.appendChild(preview);
    item.appendChild(removeBtn);
    imagePreviewList.appendChild(item);
  });

  attachedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-preview-item";

    const icon = document.createElement("div");
    icon.className = "file-preview-icon";
    icon.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>';

    const body = document.createElement("div");
    body.className = "file-preview-body";

    const name = document.createElement("div");
    name.className = "file-preview-name";
    name.textContent = file.name || "文件";
    name.title = file.name || "文件";

    const meta = document.createElement("div");
    meta.className = "file-preview-meta";
    meta.textContent = `${formatFileSize(file.size)} · ${file.text?.length || 0} 字`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "image-remove-btn file-remove-btn";
    removeBtn.type = "button";
    removeBtn.title = "删除这个文件";
    removeBtn.setAttribute("aria-label", "删除这个文件");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeFileAt(index));

    body.appendChild(name);
    body.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(removeBtn);
    imagePreviewList.appendChild(item);
  });
}
