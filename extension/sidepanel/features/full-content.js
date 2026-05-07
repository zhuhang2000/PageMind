import { fullContentViewer, fullContentTitle, fullContentText, addSelectedTextBtn, fullContentMeta, fullContentModeGuide, fullContentSelectionStatus, fullContentSelectionText, applyFullContentSelectionsBtn, fullContentSelectionPreviewList, includePageContent } from "../lib/dom-refs.js";
import { getCurrentPageData, getContentModules, setContentModules, getSelectedModuleIds, getActiveFullContentModuleId, setActiveFullContentModuleId, getFullContentDirty, setFullContentDirty, getActiveFullContentAction, setActiveFullContentAction as setActiveFullContentActionState, getPendingFullContentSelections, setPendingFullContentSelections, getActiveFullContentTextContent, setActiveFullContentTextContent } from "../lib/state.js";
import { normalizePanelText, makePanelPreview } from "../lib/text-utils.js";
import { openDrawer, closeAllDrawers } from "./drawers.js";

export function updateFullContentMeta(message = "") {
  const contentModules = getContentModules();
  const activeId = getActiveFullContentModuleId();
  const module = contentModules.find((item) => item.id === activeId);
  if (!module) {
    fullContentMeta.textContent = message || "可直接编辑正文；需要摘录时点击“摘录”后拖选片段";
    return;
  }
  const suffix = message ? ` · ${message}` : "";
  fullContentMeta.textContent = `${module.charCount || module.content?.length || 0} 字${suffix}`;
}

export function saveFullContentViewPosition() {
  const contentModules = getContentModules();
  const activeId = getActiveFullContentModuleId();
  const module = contentModules.find((item) => item.id === activeId);
  if (!module) return;

  module.fullContentScrollTop = fullContentText.scrollTop || 0;
  const selectionRange = getFullContentSelectionRange();
  if (selectionRange) {
    module.fullContentSelectionStart = selectionRange.start;
    module.fullContentSelectionEnd = selectionRange.end;
  }
}

function restoreFullContentViewPosition(module) {
  const scrollTop = Number.isFinite(module.fullContentScrollTop) ? module.fullContentScrollTop : 0;
  requestAnimationFrame(() => { fullContentText.scrollTop = scrollTop; });
}

export function renderFullContentText() {
  const ranges = normalizeSelectionRanges(getPendingFullContentSelections());
  const highlightClass = getActiveFullContentAction() || "";
  const textContent = getActiveFullContentTextContent();
  fullContentText.innerHTML = "";

  if (ranges.length === 0) {
    fullContentText.appendChild(document.createTextNode(textContent));
    return;
  }

  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      fullContentText.appendChild(document.createTextNode(textContent.slice(cursor, range.start)));
    }
    const mark = document.createElement("span");
    mark.className = `content-highlight ${highlightClass}`;
    mark.dataset.rangeIndex = String(index);
    mark.title = "点击取消此段";
    mark.textContent = textContent.slice(range.start, range.end);
    fullContentText.appendChild(mark);
    cursor = range.end;
  });

  if (cursor < textContent.length) {
    fullContentText.appendChild(document.createTextNode(textContent.slice(cursor)));
  }
}

function normalizeFullContentEditableText() {
  return normalizePanelText(fullContentText.innerText || fullContentText.textContent || "");
}

function syncFullContentTextFromDom() {
  const text = normalizeFullContentEditableText();
  setActiveFullContentTextContent(text);
  return text;
}

export function handleFullContentTextInput() {
  syncFullContentTextFromDom();
  setFullContentDirty(true);
  setPendingFullContentSelections([]);
  setActiveFullContentActionState("");
  addSelectedTextBtn.classList.remove("active");
  addSelectedTextBtn.setAttribute("aria-pressed", "false");
  addSelectedTextBtn.title = "进入摘录模式";
  addSelectedTextBtn.setAttribute("aria-label", addSelectedTextBtn.title);
  updateFullContentSelectionStatus();
    updateFullContentMeta("已编辑正文，点“保存”写回内容列表");
}

function getFullContentModeInstruction(action) {
  if (action === "add") return "摘录模式：拖选正文，可连续选择多段，再点底部“写入”";
  return "可直接编辑正文；需要摘录时点击“摘录”后拖选片段";
}

function updateFullContentModeGuide() {
  const action = getActiveFullContentAction();
  if (!action) {
    fullContentModeGuide.hidden = false;
    fullContentModeGuide.textContent = "可直接修改正文；想单独保存某段内容时，点“摘录”后拖选文本";
    return;
  }
  const segments = getPendingSelectionSegments();
  fullContentModeGuide.hidden = false;
  fullContentModeGuide.textContent = segments.length
    ? `已选 ${segments.length} 段，继续拖选可追加；点高亮可取消，底部点"写入 ${segments.length} 段"。`
    : "摘录模式：在正文中拖选多个片段；选错可点高亮取消；选完后点底部“写入”。";
}

export function setFullContentAction(action, message = "") {
  setActiveFullContentActionState(action === "add" ? "add" : "");
  setPendingFullContentSelections([]);
  const isAdd = getActiveFullContentAction() === "add";

  addSelectedTextBtn.classList.toggle("active", isAdd);
  addSelectedTextBtn.setAttribute("aria-pressed", String(isAdd));
  addSelectedTextBtn.title = isAdd ? "当前为摘录模式" : "进入摘录模式";
  addSelectedTextBtn.setAttribute("aria-label", addSelectedTextBtn.title);
  addSelectedTextBtn.querySelector(".action-label").textContent = "摘录";
  renderFullContentText();
  updateFullContentSelectionStatus();

  if (message) { updateFullContentMeta(message); return; }
  updateFullContentMeta(getFullContentModeInstruction(action));
}

export function openFullContent(moduleId) {
  const contentModules = getContentModules();
  const module = contentModules.find((item) => item.id === moduleId);
  if (!module) return;

  closeAllDrawers();

  setActiveFullContentModuleId(module.id);
  fullContentTitle.textContent = module.label || "全文内容";
  fullContentTitle.title = module.label || "全文内容";
  setActiveFullContentTextContent(module.content || "");
  setFullContentDirty(false);
  setFullContentAction("");

  openDrawer(fullContentViewer);

  updateFullContentMeta();
  restoreFullContentViewPosition(module);
}

export function resetFullContentState() {
  setActiveFullContentModuleId("");
  setActiveFullContentTextContent("");
  setPendingFullContentSelections([]);
  setActiveFullContentActionState("");
  setFullContentDirty(false);
  fullContentText.innerHTML = "";
  updateFullContentSelectionStatus();
}

function saveFullContentEdits() {
  const activeId = getActiveFullContentModuleId();
  if (!activeId) return false;
  syncFullContentTextFromDom();

  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  const moduleIndex = contentModules.findIndex((item) => item.id === activeId);
  if (moduleIndex < 0) return false;

  const updatedContent = normalizePanelText(getActiveFullContentTextContent());
  if (!updatedContent) {
    contentModules.splice(moduleIndex, 1);
    selectedModuleIds.delete(activeId);
    setFullContentDirty(false);
    return false;
  }

  const module = contentModules[moduleIndex];
  module.content = updatedContent;
  module.preview = makePanelPreview(updatedContent);
  module.charCount = updatedContent.length;
  module.defaultChecked = selectedModuleIds.has(module.id);
  module.isEdited = module.isEdited || getFullContentDirty();
  setFullContentDirty(false);
  return true;
}

export function closeFullContent({ save = true } = {}) {
  saveFullContentViewPosition();
  if (save) saveFullContentEdits();
  resetFullContentState();
  // renderContentModules is called by the caller (app.js) after this
}

export function getFullContentSelectionRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!isNodeInsideFullContent(range.startContainer) || !isNodeInsideFullContent(range.endContainer)) return null;

  const start = getTextOffsetFromDomPosition(range.startContainer, range.startOffset);
  const end = getTextOffsetFromDomPosition(range.endContainer, range.endOffset);
  if (end <= start) return null;

  const textContent = getActiveFullContentTextContent();
  const safeStart = Math.max(0, Math.min(start, textContent.length));
  const safeEnd = Math.max(0, Math.min(end, textContent.length));
  if (safeEnd <= safeStart) return null;

  const text = normalizePanelText(textContent.slice(safeStart, safeEnd));
  if (!text) return null;

  return { start: safeStart, end: safeEnd };
}

function isNodeInsideFullContent(node) {
  if (!node) return false;
  if (node === fullContentText) return true;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return Boolean(element && fullContentText.contains(element));
}

export function isCurrentSelectionInsideFullContent() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  return isNodeInsideFullContent(range.startContainer) && isNodeInsideFullContent(range.endContainer);
}

function getTextOffsetFromDomPosition(node, offset) {
  const range = document.createRange();
  range.selectNodeContents(fullContentText);
  range.setEnd(node, offset);
  return range.toString().length;
}

function normalizeSelectionRanges(ranges) {
  const sorted = ranges.filter((range) => range && range.end > range.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) { last.end = Math.max(last.end, range.end); }
    else { merged.push({ start: range.start, end: range.end }); }
  }
  return merged;
}

function getPendingSelectionSegments() {
  const textContent = getActiveFullContentTextContent();
  return normalizeSelectionRanges(getPendingFullContentSelections())
    .map((range) => normalizePanelText(textContent.slice(range.start, range.end)))
    .filter(Boolean);
}

export function updateFullContentSelectionStatus() {
  const isActive = Boolean(getActiveFullContentAction());
  fullContentSelectionStatus.classList.toggle("active", isActive);
  fullContentSelectionPreviewList.innerHTML = "";

  if (!isActive) {
    fullContentSelectionText.textContent = "未选择片段";
    applyFullContentSelectionsBtn.disabled = true;
    applyFullContentSelectionsBtn.querySelector("span").textContent = "执行";
    updateFullContentModeGuide();
    return;
  }

  const segments = getPendingSelectionSegments();
  const totalChars = segments.reduce((sum, text) => sum + text.length, 0);
  applyFullContentSelectionsBtn.disabled = segments.length === 0;
  applyFullContentSelectionsBtn.querySelector("span").textContent = segments.length ? `写入 ${segments.length} 段` : "写入";
  applyFullContentSelectionsBtn.title = segments.length ? `写入 ${segments.length} 段摘录文本` : "请先在正文中拖选文本";
  applyFullContentSelectionsBtn.setAttribute("aria-label", applyFullContentSelectionsBtn.title);
  fullContentSelectionText.textContent = segments.length
    ? `已选择 ${segments.length} 段 / ${totalChars} 字，继续拖选可追加`
    : "摘录模式：拖选正文，可连续选择多段";
  updateFullContentModeGuide();

  segments.forEach((text, index) => {
    const item = document.createElement("div");
    item.className = `selection-preview-item ${getActiveFullContentAction()}`;
    item.textContent = `${index + 1}. ${makePanelPreview(text)}`;
    item.title = text;
    fullContentSelectionPreviewList.appendChild(item);
  });
}

export function clearPendingFullContentSelections(message = "") {
  setPendingFullContentSelections([]);
  renderFullContentText();
  updateFullContentSelectionStatus();
  updateFullContentMeta(message || getFullContentModeInstruction(getActiveFullContentAction()));
}

export function applyPendingFullContentSelections() {
  if (getActiveFullContentAction() !== "add") {
    updateFullContentMeta("请先点击“摘录”，再拖选要写入的片段");
    return false;
  }

  rememberFullContentSelection();
  const segments = getPendingSelectionSegments();
  const segmentCount = segments.length;
  const totalChars = segments.reduce((sum, text) => sum + text.length, 0);
  if (segmentCount === 0) {
    updateFullContentMeta("请先在正文中拖选一个或多个片段");
    return false;
  }

  if (!addPendingFullContentSelections()) return false;
  clearPendingFullContentSelections(`已写入 ${segmentCount} 段 / ${totalChars} 字，可继续选择或点"保存"返回`);
  return true;
}

export function rememberFullContentSelection() {
  if (!getActiveFullContentAction()) return false;

  const range = getFullContentSelectionRange();
  if (!range) return false;

  const pending = getPendingFullContentSelections();
  const beforeCount = pending.length;
  const merged = normalizeSelectionRanges([...pending, range]);
  setPendingFullContentSelections(merged);
  renderFullContentText();
  const segments = getPendingSelectionSegments();
  const totalChars = segments.reduce((sum, text) => sum + text.length, 0);
  updateFullContentSelectionStatus();
  updateFullContentMeta(`已选择 ${segments.length} 段 / ${totalChars} 字，继续拖选可追加`);
  return merged.length !== beforeCount;
}

export function removePendingSelectionAt(index) {
  const ranges = normalizeSelectionRanges(getPendingFullContentSelections());
  if (index < 0 || index >= ranges.length) {
    renderFullContentText();
    updateFullContentSelectionStatus();
    return;
  }

  ranges.splice(index, 1);
  setPendingFullContentSelections(ranges);
  renderFullContentText();
  updateFullContentSelectionStatus();

  if (getActiveFullContentAction() === "add") {
    updateFullContentMeta(ranges.length ? "已取消一个摘录片段" : getFullContentModeInstruction("add"));
  }
}

function addManualContentModule({ sourceModule, content, labelPrefix }) {
  if (!sourceModule) return false;
  const normalizedContent = normalizePanelText(content);
  if (!normalizedContent) {
    updateFullContentMeta("没有可加入的文本");
    return false;
  }

  const currentPageData = getCurrentPageData();
  const module = {
    id: `manual-selection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: `${labelPrefix} - ${sourceModule.label || "内容模块"}`.slice(0, 48),
    selectorHint: `手动选择自 ${sourceModule.selectorHint || "全文内容"}`.slice(0, 80),
    content: normalizedContent,
    preview: makePanelPreview(normalizedContent),
    charCount: normalizedContent.length,
    defaultChecked: true,
    isManualSelection: true,
    sourceUrl: sourceModule.sourceUrl || currentPageData?.url || "",
    sourceTitle: sourceModule.sourceTitle || currentPageData?.title || "",
  };

  includePageContent.checked = true;
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  contentModules.unshift(module);
  selectedModuleIds.add(module.id);
  // Caller should call renderContentModules() after this
  return true;
}

function addPendingFullContentSelections() {
  const contentModules = getContentModules();
  const activeId = getActiveFullContentModuleId();
  const sourceModule = contentModules.find((item) => item.id === activeId);
  const selectedText = getPendingSelectionSegments().join("\n\n");

  if (!selectedText) {
    updateFullContentMeta("请先在全文中选择一个或多个段落");
    return false;
  }

  const result = addManualContentModule({ sourceModule, content: selectedText, labelPrefix: "摘录文本" });
  if (result) {
    // Dynamically import to avoid circular dependency at module load time
    import("./content-modules.js").then(({ renderContentModules }) => renderContentModules());
  }
  return result;
}
