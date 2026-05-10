const WEB_CONTENT_START = "---网页内容开始---";
const WEB_CONTENT_END = "---网页内容结束---";
const IMAGE_SECTION_START = "---用户上传图片---";
const IMAGE_SECTION_END = "---用户上传图片结束---";

export function buildWebAnalysisPrompt({
  role,
  content = "",
  instruction = "",
  instructionLabel = "任务指令",
  instructionPosition = "before-content",
  images = [],
  imageInstruction = "",
  footer,
}) {
  const instructionBlock = `${instructionLabel}：${instruction}`;
  const contentBlock = `${WEB_CONTENT_START}\n${content}\n${WEB_CONTENT_END}${buildImageSection({
    images,
    imageInstruction,
  })}`;

  const sections =
    instructionPosition === "after-content"
      ? [role, contentBlock, instructionBlock, footer]
      : [role, instructionBlock, contentBlock, footer];

  return sections.filter(Boolean).join("\n\n");
}

export function buildImageSection({ images = [], imageInstruction = "" } = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    return "";
  }

  const imageList = images
    .map(
      (image, index) =>
        `${index + 1}. ${image.name || "image"} (${image.mimeType || "image"})：${image.path}`
    )
    .join("\n");

  const instruction = imageInstruction ? `\n\n${imageInstruction}` : "";
  return `\n\n${IMAGE_SECTION_START}\n${imageList}\n${IMAGE_SECTION_END}${instruction}`;
}
