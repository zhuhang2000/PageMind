import { captureSnipBtn, imagePreviewList } from "../lib/dom-refs.js";
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, MAX_TOTAL_IMAGE_BYTES } from "../lib/constants.js";
import { getAttachedImages, setAttachedImages } from "../lib/state.js";
import { api } from "../lib/api.js";
import { renderError } from "./results.js";

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

export async function captureWindowsSnip() {
  captureSnipBtn.disabled = true;

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
    captureSnipBtn.disabled = false;
  }
}

function removeImageAt(index) {
  const attachedImages = getAttachedImages();
  attachedImages.splice(index, 1);
  setAttachedImages(attachedImages);
  renderImageAttachments();
}

export function renderImageAttachments() {
  const attachedImages = getAttachedImages();
  imagePreviewList.innerHTML = "";
  imagePreviewList.classList.toggle("has-images", attachedImages.length > 0);

  if (attachedImages.length === 0) return;

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
}
