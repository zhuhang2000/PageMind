import {
  promptInput, summarizeBtn, resultArea, pageTitle, pageUrl,
  promptExpandBtn, promptExpandOverlay, promptExpandInput, closePromptExpandBtn,
  applyPromptExpandBtn, sendPromptExpandBtn,
  includePageContent, refreshPageBtn, loadDemoDataBtn,
  attachmentBtn, attachmentMenu, imageInput, fileInput, addImageBtn, addFileBtn,
  promptDrawerBtn, promptDrawer, closePromptDrawerBtn, closeEditorBtn,
  createNewPromptBtn, savePromptBtn, deletePromptBtn,
  historyDrawerBtn, historyDrawer, closeHistoryDrawerBtn, historySearchInput,
  clearHistoryBtn, newSessionBtn,
  expandContentPanelBtn, qaSelectToggleBtn, contentPreviewPanel, closePreviewBtn,
  selectAllModulesBtn, clearModulesBtn,
  drawerOverlay,
  closeFullContentBtn, addSelectedTextBtn, applyFullContentSelectionsBtn,
  clearFullContentSelectionsBtn, fullContentText,
  closeSubmittedContentBtn, submittedContentViewer,
} from "./lib/dom-refs.js";
import { getAttachedImages, setLastResult, getEditingPromptId, getContentModules, getSelectedModuleIds, setSelectedModuleIds, getActiveFullContentAction } from "./lib/state.js";
import { api } from "./lib/api.js";
import { openDrawerById, closeAllDrawers, closeDrawer, closeAttachmentMenu, initDraggableDrawers, initResizableDrawerPersistence } from "./features/drawers.js";
import { renderPromptList, openPromptEditor, savePrompt, deletePrompt, loadSavedPrompts } from "./features/prompts.js";
import { addFiles, addImages, buildAttachedFileContent, captureWindowsSnip, clearAttachedImages, renderImageAttachments } from "./features/images.js";
import { clearPageContentContext, clearSelectedModules, renderContentModules, CONTENT_CONTEXT_CHANGED_EVENT } from "./features/content-modules.js";
import { closeFullContent, setFullContentAction, rememberFullContentSelection, removePendingSelectionAt, handleFullContentTextInput, isCurrentSelectionInsideFullContent, applyPendingFullContentSelections, clearPendingFullContentSelections, saveFullContentViewPosition } from "./features/full-content.js";
import { saveHistoryRecord, openHistoryDrawer, handleHistorySearchInput, clearHistoryRecords, createNewSession, ensureActiveSession, initHistory } from "./features/history.js";
import { renderLoading, renderUserQuestion, renderError, renderResult, toggleQaSelectMode } from "./features/results.js";
import { checkBridge, refreshPageInfo, buildSelectedPageContent, ensureCurrentPageData } from "./features/page-bridge.js";
import { pmConfirm, pmPrompt } from "./features/modal.js";
import { initGoogleDocsExport } from "./features/google-docs-export.js";
import { initQaNotes } from "./features/qa-notes.js";
import { FEATURE_FLAGS } from "./lib/build-flags.js";
import { clearInviteCode, getInviteCode, saveInviteCode } from "./lib/invite-code.js";

export function resizePromptInput() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${promptInput.scrollHeight}px`;
}

let isPromptExpandOpen = false;
let pendingInviteCodePrompt = null;

function syncMainPromptFromExpanded() {
  promptInput.value = promptExpandInput.value;
  resizePromptInput();
}

function openPromptExpandEditor() {
  if (isPromptExpandOpen) return;

  isPromptExpandOpen = true;
  closeAttachmentMenu();
  promptExpandInput.value = promptInput.value;
  promptExpandOverlay.hidden = false;

  requestAnimationFrame(() => {
    promptExpandOverlay.classList.add("active");
    promptExpandInput.focus({ preventScroll: true });
    const cursorPosition = promptExpandInput.value.length;
    promptExpandInput.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function closePromptExpandEditor() {
  if (!isPromptExpandOpen) return;

  syncMainPromptFromExpanded();
  isPromptExpandOpen = false;
  promptExpandOverlay.classList.remove("active");

  window.setTimeout(() => {
    if (!isPromptExpandOpen) {
      promptExpandOverlay.hidden = true;
    }
  }, 180);
}

function sendFromPromptExpandEditor() {
  syncMainPromptFromExpanded();
  closePromptExpandEditor();
  summarizeBtn.click();
}

function clearResultPlaceholder() {
  resultArea.querySelector(".result-placeholder")?.remove();
}

async function ensureInviteCode() {
  const currentCode = getInviteCode();
  if (currentCode) return currentCode;
  if (pendingInviteCodePrompt) return pendingInviteCodePrompt;

  pendingInviteCodePrompt = pmPrompt("请输入邀请码", {
    message: "邀请码会保存在当前浏览器本地，用于访问 PageMind 内测接口。",
    placeholder: "输入邀请码",
    confirmText: "保存并发送",
  }).then((code) => {
    if (code === null) return "";
    return saveInviteCode(code);
  }).finally(() => {
    pendingInviteCodePrompt = null;
  });

  return pendingInviteCodePrompt;
}

async function handleSummarize() {
  if (summarizeBtn.disabled) return;

  const instruction = promptInput.value.trim();
  if (!instruction) {
    renderError("请先输入问题或提示词");
    return;
  }

  const inviteCode = await ensureInviteCode();
  if (!inviteCode) {
    renderError("请先输入邀请码");
    return;
  }

  summarizeBtn.disabled = true;

  clearResultPlaceholder();

  try {
    const includePageContext = includePageContent.checked;
    const pageData = includePageContext
      ? await ensureCurrentPageData()
      : { title: "", url: "", isSelection: false };
    pageTitle.textContent = pageData.title || (includePageContext ? "未知标题" : "未附带网页");
    pageUrl.textContent = pageData.url || "";

    const selectedContent = [buildSelectedPageContent(), buildAttachedFileContent()].filter(Boolean).join("\n\n");
    const attachedImages = getAttachedImages();
    if (includePageContext && !selectedContent.trim() && attachedImages.length === 0) {
      throw new Error("请先勾选要发送的网页内容，或添加图片/文件");
    }

    await ensureActiveSession({
      pageTitle: pageData.title,
      pageUrl: pageData.url,
    });
    clearResultPlaceholder();
    renderUserQuestion(instruction);
    renderLoading();
    resultArea.scrollTo({ top: resultArea.scrollHeight, behavior: "smooth" });

    const data = await api.summarize({
      title: pageData.title,
      url: pageData.url,
      content: selectedContent,
      images: attachedImages,
      instruction,
    });

    setLastResult({
      title: pageData.title || "AI 网页助手总结",
      url: pageData.url || "",
      question: instruction,
      provider: data.provider,
      contentPreview: selectedContent.slice(0, 20000),
      contentCharCount: selectedContent.length,
      summary: data.summary,
    });

    saveHistoryRecord({
      provider: data.provider,
      title: pageData.title,
      url: pageData.url,
      instruction,
      content: selectedContent,
      summary: data.summary,
    }).catch((err) => {
      console.warn("保存历史记录失败", err);
    });

    const loadingElem = resultArea.querySelector(".loading");
    if (loadingElem) loadingElem.remove();

    renderResult(data.summary, pageData.isSelection, {
      provider: data.provider,
      title: pageData.title,
      url: pageData.url,
      question: instruction,
      contentPreview: selectedContent.slice(0, 20000),
      contentCharCount: selectedContent.length,
    });
    resultArea.scrollTo({ top: resultArea.scrollHeight, behavior: "smooth" });

    promptInput.value = "";
    promptInput.style.height = "auto";
  } catch (err) {
    const loadingElem = resultArea.querySelector(".loading");
    if (loadingElem) loadingElem.remove();
    if (err.status === 401 || err.status === 403) {
      clearInviteCode();
      renderError("邀请码无效或已过期，请重新输入后再试");
      return;
    }
    renderError(err.message || "发生未知错误，请检查 bridge 服务是否启动");
  } finally {
    summarizeBtn.disabled = false;
  }
}

// --- Event Bindings ---

summarizeBtn.addEventListener("click", handleSummarize);
refreshPageBtn.addEventListener("click", () => {
  refreshPageInfo();
});

loadDemoDataBtn?.addEventListener("click", () => {
  import("./demo-data.js").then(({ loadDemoData }) => {
    loadDemoData().catch((error) => {
      console.error("Load demo data failed", error);
      renderError(error.message || "Demo 数据加载失败");
    });
  });
});

function initScreenshotCaptureControls() {
  if (!FEATURE_FLAGS.screenshotCapture) {
    attachmentBtn.hidden = true;
    return;
  }

  attachmentBtn.hidden = false;
  attachmentBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeAttachmentMenu();
    captureWindowsSnip();
  });
}

attachmentMenu.addEventListener("click", (event) => {
  event.stopPropagation();
});

promptDrawerBtn.addEventListener("click", () => {
  renderPromptList();
  openDrawerById("promptDrawer");
});

historyDrawerBtn.addEventListener("click", () => {
  openHistoryDrawer();
});

createNewPromptBtn.addEventListener("click", () => {
  openPromptEditor();
});

savePromptBtn.addEventListener("click", savePrompt);
deletePromptBtn.addEventListener("click", () => deletePrompt(getEditingPromptId()));
closePromptDrawerBtn.addEventListener("click", () => closeDrawer(promptDrawer));
closeEditorBtn.addEventListener("click", () => openDrawerById("promptDrawer"));
closeHistoryDrawerBtn.addEventListener("click", () => closeDrawer(historyDrawer));
historySearchInput.addEventListener("input", handleHistorySearchInput);

clearHistoryBtn.addEventListener("click", async () => {
  if (await pmConfirm("清空全部会话？", { message: "所有会话记录将被永久删除", confirmText: "全部清空" })) {
    await clearHistoryRecords();
    clearCurrentSendContext();
    closeDrawer(historyDrawer);
    promptInput.focus();
  }
});

function clearCurrentSendContext() {
  clearAttachedImages();
  includePageContent.checked = false;
  pageTitle.textContent = "未附带网页";
  pageUrl.textContent = "";
  clearPageContentContext();
}

newSessionBtn.addEventListener("click", async () => {
  await createNewSession();
  clearCurrentSendContext();
  closeDrawer(historyDrawer);
  promptInput.focus();
});

drawerOverlay.addEventListener("click", () => {
  // If fullContentViewer is open, save and return to content preview instead of main interface
  const fullViewer = document.getElementById("fullContentViewer");
  if (fullViewer?.classList.contains("active")) {
    closeFullContent({ save: true });
    renderContentModules();
    document.dispatchEvent(new CustomEvent(CONTENT_CONTEXT_CHANGED_EVENT));
    openDrawerById("contentPreviewPanel");
    return;
  }
  closeAllDrawers({ includePinned: false });
});

promptInput.addEventListener("input", resizePromptInput);

promptExpandBtn.addEventListener("click", openPromptExpandEditor);

promptExpandInput.addEventListener("input", syncMainPromptFromExpanded);

promptExpandInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closePromptExpandEditor();
    return;
  }

  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
    event.preventDefault();
    sendFromPromptExpandEditor();
  }
});

promptExpandOverlay.addEventListener("click", (event) => {
  if (event.target === promptExpandOverlay) {
    closePromptExpandEditor();
  }
});

closePromptExpandBtn.addEventListener("click", closePromptExpandEditor);
applyPromptExpandBtn.addEventListener("click", closePromptExpandEditor);
sendPromptExpandBtn.addEventListener("click", sendFromPromptExpandEditor);

promptInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  summarizeBtn.click();
});

addImageBtn.addEventListener("click", () => {
  closeAttachmentMenu();
  imageInput.click();
});

addFileBtn.addEventListener("click", () => {
  closeAttachmentMenu();
  fileInput.click();
});

imageInput.addEventListener("change", async () => {
  const files = Array.from(imageInput.files || []);
  imageInput.value = "";
  if (files.length === 0) return;

  try {
    await addImages(files);
  } catch (err) {
    renderError(err.message || "图片读取失败");
  }
});

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  fileInput.value = "";
  if (files.length === 0) return;

  try {
    await addFiles(files);
  } catch (err) {
    renderError(err.message || "文件读取失败");
  }
});

includePageContent.addEventListener("change", () => {
  renderContentModules();
  document.dispatchEvent(new CustomEvent(CONTENT_CONTEXT_CHANGED_EVENT));
});

expandContentPanelBtn.addEventListener("click", () => {
  openDrawerById("contentPreviewPanel");
});

qaSelectToggleBtn.addEventListener("click", () => {
  toggleQaSelectMode();
});

selectAllModulesBtn.addEventListener("click", () => {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  const allSelected = contentModules.length > 0 && selectedModuleIds.size === contentModules.length;
  if (allSelected) {
    setSelectedModuleIds(new Set());
  } else {
    setSelectedModuleIds(new Set(contentModules.map((module) => module.id)));
  }
  renderContentModules();
  document.dispatchEvent(new CustomEvent(CONTENT_CONTEXT_CHANGED_EVENT));
});

clearModulesBtn.addEventListener("click", async () => {
  const selectedCount = document.querySelectorAll(".content-module-item.selected").length;
  if (selectedCount === 0) return;
  const msg = `清除已勾选的 ${selectedCount} 个内容模块？`;
  if (await pmConfirm(msg, { message: "这些模块将从当前上下文中移除", confirmText: "清除选中", icon: "warning", danger: false })) {
    clearSelectedModules();
  }
});

closePreviewBtn.addEventListener("click", () => closeDrawer(contentPreviewPanel));

closeFullContentBtn.addEventListener("click", () => {
  closeFullContent({ save: true });
  renderContentModules();
  document.dispatchEvent(new CustomEvent(CONTENT_CONTEXT_CHANGED_EVENT));
  openDrawerById("contentPreviewPanel");
});

closeSubmittedContentBtn.addEventListener("click", () => closeDrawer(submittedContentViewer));

addSelectedTextBtn.addEventListener("click", () => {
  if (getActiveFullContentAction() === "add") {
    window.getSelection()?.removeAllRanges();
    setFullContentAction("", "已退出摘录模式，已清空选择");
    return;
  }
  setFullContentAction("add");
});

applyFullContentSelectionsBtn.addEventListener("click", () => {
  applyPendingFullContentSelections();
});

clearFullContentSelectionsBtn.addEventListener("click", () => {
  clearPendingFullContentSelections();
});

["mouseup", "keyup", "blur"].forEach((eventName) => {
  fullContentText.addEventListener(eventName, () => {
    rememberFullContentSelection();
  });
});

fullContentText.addEventListener("scroll", () => {
  saveFullContentViewPosition();
});

fullContentText.addEventListener("input", () => {
  handleFullContentTextInput();
});

fullContentText.addEventListener("click", (event) => {
  const highlight = event.target.closest(".content-highlight");
  if (!highlight || !fullContentText.contains(highlight)) return;
  removePendingSelectionAt(Number(highlight.dataset.rangeIndex));
});

document.addEventListener("pointerup", () => {
  if (getActiveFullContentAction() && isCurrentSelectionInsideFullContent()) {
    rememberFullContentSelection();
  }
});

document.addEventListener("click", () => {
  closeAttachmentMenu();
});

// --- Initialization ---

initGoogleDocsExport();
initQaNotes();
initScreenshotCaptureControls();
initDraggableDrawers();
initResizableDrawerPersistence();

checkBridge();
loadSavedPrompts();
renderImageAttachments();
renderContentModules();
initHistory().catch((error) => {
  console.warn("初始化历史会话失败", error);
});
refreshPageInfo({ extractContent: false });
