import { includePageContent, expandContentPanelBtn, refreshPageBtn, selectAllModulesBtn, clearModulesBtn, contentModuleList, fullContentTitle } from "../lib/dom-refs.js";
import { getCurrentPageData, setCurrentPageDataRaw, getContentModules, setContentModules, getSelectedModuleIds, setSelectedModuleIds, getActiveFullContentModuleId } from "../lib/state.js";
import { normalizePanelText, makePanelPreview } from "../lib/text-utils.js";
import { openFullContent, resetFullContentState } from "./full-content.js";
import { pmConfirm } from "./modal.js";

function normalizeContentModules(pageData) {
  const modules = Array.isArray(pageData?.contentModules) ? pageData.contentModules : [];
  if (modules.length > 0) return modules;

  if (pageData?.content?.trim()) {
    return [
      {
        id: "full-content",
        label: pageData.isSelection ? "选中文本" : "当前网页内容",
        selectorHint: pageData.isSelection ? "window.getSelection()" : "document",
        content: pageData.content,
        preview: pageData.content.slice(0, 260),
        charCount: pageData.content.length,
        defaultChecked: true,
      },
    ];
  }

  return [];
}

export { normalizePanelText, makePanelPreview };

function moduleSignature(module) {
  const text = normalizePanelText(module?.content || "");
  return `${module?.sourceUrl || ""}|${text.length}|${text.slice(0, 600)}|${text.slice(-600)}`;
}

function prepareIncomingModules(pageData) {
  return normalizeContentModules(pageData).map((module, index) => ({
    ...module,
    id: `${Date.now()}-${index}-${module.id}`,
    sourceUrl: pageData?.url || "",
    sourceTitle: pageData?.title || "",
  }));
}

export function setCurrentPageData(pageData) {
  const incomingUrl = pageData?.url || "";
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  const existingModules = contentModules
    .filter((module) => {
      if (!incomingUrl || module.sourceUrl !== incomingUrl) return true;
      return module.isManualSelection || module.isEdited || module.isRenamed;
    })
    .map((module) => ({
      ...module,
      defaultChecked: selectedModuleIds.has(module.id),
    }));
  const seen = new Set(existingModules.map(moduleSignature).filter(Boolean));
  const incomingModules = prepareIncomingModules(pageData).filter((module) => {
    const signature = moduleSignature(module);
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  setCurrentPageDataRaw(pageData);
  setContentModules([...existingModules, ...incomingModules]);
  const newSelectedIds = new Set(
    [...existingModules, ...incomingModules]
      .filter((module) => module.defaultChecked !== false)
      .map((module) => module.id)
  );
  setSelectedModuleIds(newSelectedIds);
  resetFullContentState();
  renderContentModules();
}

export function clearPageContentContext() {
  setCurrentPageDataRaw(null);
  setContentModules([]);
  setSelectedModuleIds(new Set());
  resetFullContentState();
  renderContentModules();
}

export function getSelectedModules() {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  return contentModules.filter((module) => selectedModuleIds.has(module.id));
}

export function getSelectedContentLength() {
  return getSelectedModules().reduce((sum, module) => sum + (module.content?.length || 0), 0);
}

export async function removeContentModule(moduleId) {
  if (!await pmConfirm("删除这个内容模块？", { message: "删除后需要重新获取", confirmText: "删除" })) return;
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  setContentModules(contentModules.filter((module) => module.id !== moduleId));
  selectedModuleIds.delete(moduleId);

  if (getActiveFullContentModuleId() === moduleId) {
    resetFullContentState();
  }

  renderContentModules();
}

function normalizeModuleLabel(label) {
  return normalizePanelText(label).replace(/\s+/g, " ").slice(0, 60);
}

export function renameContentModule(moduleId, nextLabel) {
  const contentModules = getContentModules();
  const module = contentModules.find((item) => item.id === moduleId);
  if (!module) return false;

  const label = normalizeModuleLabel(nextLabel);
  if (!label) return false;

  module.label = label;
  module.isRenamed = true;
  if (getActiveFullContentModuleId() === module.id) {
    fullContentTitle.textContent = label;
    fullContentTitle.title = label;
  }
  renderContentModules();
  return true;
}

function startEditingModuleTitle(module, titleElement) {
  const originalLabel = module.label || "内容模块";
  const input = document.createElement("input");
  input.className = "module-title-input";
  input.type = "text";
  input.value = originalLabel;
  input.maxLength = 60;
  input.setAttribute("aria-label", "修改文档标题");

  let isFinished = false;
  const save = () => {
    if (isFinished) return;
    isFinished = true;
    const nextLabel = normalizeModuleLabel(input.value) || originalLabel;
    renameContentModule(module.id, nextLabel);
  };
  const cancel = () => {
    if (isFinished) return;
    isFinished = true;
    renderContentModules();
  };

  titleElement.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("blur", save);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); save(); }
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
  });
}

export function renderContentModules() {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  const currentPageData = getCurrentPageData();
  const isEnabled = includePageContent.checked;
  const selectedCount = getSelectedModules().length;
  const selectedChars = getSelectedContentLength();
  const hasModules = contentModules.length > 0;
  const hasSelection = selectedCount > 0;
  const stateClass = hasSelection ? "context-state-selected" : hasModules ? "context-state-unselected" : "context-state-empty";
  const titleText = hasSelection ? "已选网页内容" : hasModules ? "未选择网页内容" : "还没有网页内容";
  const metaText = hasSelection ? `${selectedCount} 个模块 · ${selectedChars} 字` : hasModules ? `${contentModules.length} 个模块可选` : "获取内容后会显示在这里";

  expandContentPanelBtn.className = `context-summary-btn ${stateClass}`;
  expandContentPanelBtn.title = hasModules ? "管理网页上下文内容" : "查看网页上下文内容";
  expandContentPanelBtn.setAttribute("aria-label", `${titleText}，${metaText}`);
  expandContentPanelBtn.innerHTML = `
    <span class="context-main">
      <svg class="icon context-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <path d="M14 2v6h6"></path>
        <path d="M8 13h8"></path>
        <path d="M8 17h5"></path>
      </svg>
      <span class="context-title">${titleText}</span>
    </span>
    <span class="context-meta">${metaText}</span>
  `;


  selectAllModulesBtn.disabled = !isEnabled || contentModules.length === 0;
  clearModulesBtn.disabled = !isEnabled || contentModules.length === 0;
  contentModuleList.innerHTML = "";

  if (contentModules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "content-module-empty";
    empty.textContent = currentPageData ? "未提取到可预览内容" : "暂无预览内容";
    contentModuleList.appendChild(empty);
    return;
  }

  for (const module of contentModules) {
    const item = document.createElement("div");
    item.className = "content-module-item";
    if (selectedModuleIds.has(module.id)) item.classList.add("selected");

    const header = document.createElement("div");
    header.className = "module-header";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "icon module-type-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>';

    const title = document.createElement("div");
    title.className = "module-title";
    title.textContent = module.label || "内容模块";
    title.title = module.label || "内容模块";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "module-checkbox";
    checkbox.checked = selectedModuleIds.has(module.id);
    checkbox.disabled = !isEnabled;

    const preview = document.createElement("div");
    preview.className = "module-preview";
    preview.textContent = module.preview || module.content || "";

    const footer = document.createElement("div");
    footer.className = "module-footer";

    const count = document.createElement("span");
    count.className = "module-count";
    count.textContent = `${module.charCount || module.content?.length || 0} 字`;

    const actions = document.createElement("div");
    actions.className = "module-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "mini-btn view-btn";
    viewBtn.type = "button";
    viewBtn.title = "打开全文并摘录或编辑文本";
    viewBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path><path d="M18 3h-6v6"></path><path d="M12 9 21 0"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg><span>全文</span>';

    const renameBtn = document.createElement("button");
    renameBtn.className = "mini-btn rename-btn";
    renameBtn.type = "button";
    renameBtn.title = "修改文档标题";
    renameBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg><span>重命名</span>';

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mini-btn delete-btn subtle-danger";
    deleteBtn.type = "button";
    deleteBtn.title = "删除这个内容模块";
    deleteBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg><span>删除</span>';

    actions.appendChild(renameBtn);
    actions.appendChild(viewBtn);
    actions.appendChild(deleteBtn);
    footer.appendChild(count);
    footer.appendChild(actions);
    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(checkbox);
    item.appendChild(header);
    item.appendChild(preview);
    item.appendChild(footer);

    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        selectedModuleIds.add(module.id);
        item.classList.add("selected");
      } else {
        selectedModuleIds.delete(module.id);
        item.classList.remove("selected");
      }
      renderContentModules();
    });

    item.addEventListener("click", (e) => {
      if (e.target.closest(".mini-btn") || e.target.closest(".module-checkbox") || e.target.closest(".module-title-input")) return;
      openFullContent(module.id);
    });

    renameBtn.addEventListener("click", (e) => { e.stopPropagation(); startEditingModuleTitle(module, title); });
    viewBtn.addEventListener("click", (e) => { e.stopPropagation(); openFullContent(module.id); });
    deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); removeContentModule(module.id); });

    contentModuleList.appendChild(item);
  }
}
