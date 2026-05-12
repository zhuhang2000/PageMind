import { includePageContent, expandContentPanelBtn, refreshPageBtn, selectAllModulesBtn, clearModulesBtn, contentModuleList, fullContentTitle } from "../lib/dom-refs.js";
import { getCurrentPageData, setCurrentPageDataRaw, getContentModules, setContentModules, getSelectedModuleIds, setSelectedModuleIds, getActiveFullContentModuleId } from "../lib/state.js";
import { normalizePanelText, makePanelPreview } from "../lib/text-utils.js";
import { openFullContent, resetFullContentState } from "./full-content.js";
import { pmConfirm } from "./modal.js";

export const CONTENT_CONTEXT_CHANGED_EVENT = "aiWebAssistant:content-context-changed";

let isApplyingContext = false;

export function getCurrentContentContext() {
  return {
    modules: getContentModules().map((module) => ({ ...module })),
    selectedIds: [...getSelectedModuleIds()],
    includeChecked: includePageContent?.checked ?? false,
  };
}

export function applyContentContext(ctx) {
  isApplyingContext = true;
  try {
    const modules = Array.isArray(ctx?.modules) ? ctx.modules.map((module) => ({ ...module })) : [];
    const selectedIds = Array.isArray(ctx?.selectedIds) ? ctx.selectedIds : [];
    setContentModules(modules);
    setSelectedModuleIds(new Set(selectedIds));
    setCurrentPageDataRaw(null);
    resetFullContentState();
    if (includePageContent) {
      includePageContent.checked = Boolean(ctx?.includeChecked) && modules.length > 0;
    }
    renderContentModules();
  } finally {
    isApplyingContext = false;
  }
}

function notifyContentContextChanged() {
  if (isApplyingContext) return;
  document.dispatchEvent(new CustomEvent(CONTENT_CONTEXT_CHANGED_EVENT));
}

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
  notifyContentContextChanged();
}

export function clearPageContentContext() {
  setCurrentPageDataRaw(null);
  setContentModules([]);
  setSelectedModuleIds(new Set());
  resetFullContentState();
  renderContentModules();
  notifyContentContextChanged();
}

export function clearSelectedModules() {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  if (selectedModuleIds.size === 0) return;

  const remaining = contentModules.filter((module) => !selectedModuleIds.has(module.id));

  // If a full-content view is open for a selected module, close it
  const activeId = getActiveFullContentModuleId();
  if (activeId && selectedModuleIds.has(activeId)) {
    resetFullContentState();
  }

  setContentModules(remaining);
  setSelectedModuleIds(new Set());
  setCurrentPageDataRaw(null);
  renderContentModules();
  notifyContentContextChanged();
}

export function getSelectedModules() {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  return contentModules.filter((module) => selectedModuleIds.has(module.id));
}

export function getSelectedContentLength() {
  return getSelectedModules().reduce((sum, module) => sum + (module.content?.length || 0), 0);
}

export function addQaNoteModule(moduleData) {
  const contentModules = getContentModules();
  const selectedModuleIds = getSelectedModuleIds();
  const id = `${Date.now()}-${contentModules.length}-${moduleData.id || "qa"}`;
  const module = { ...moduleData, id };
  contentModules.push(module);
  setContentModules(contentModules);
  selectedModuleIds.add(id);
  renderContentModules();
  notifyContentContextChanged();
  return id;
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
  notifyContentContextChanged();
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
  notifyContentContextChanged();
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

// Track which QA children groups are expanded (keyed by parent module id or "orphan")
const expandedQaGroups = new Set();

function renderModuleItem(module, { isEnabled, selectedModuleIds, contentModules, isChild = false }) {
  const item = document.createElement("div");
  item.className = isChild ? "content-module-item qa-child-item" : "content-module-item";
  item.dataset.moduleId = module.id;
  if (selectedModuleIds.has(module.id)) item.classList.add("selected");

  const header = document.createElement("div");
  header.className = "module-header";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  if (module.isQaNote) {
    icon.setAttribute("class", "icon module-type-icon qa-note-icon");
    icon.innerHTML = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
  } else {
    icon.setAttribute("class", "icon module-type-icon");
    icon.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>';
  }

  const title = document.createElement("div");
  title.className = "module-title";
  title.textContent = module.label || "内容模块";
  title.title = module.label || "内容模块";

  let typeTag = null;
  if (module.isQaNote) {
    typeTag = document.createElement("span");
    typeTag.className = "module-type-tag qa-note-tag";
    typeTag.textContent = "问答笔记";
  }

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
  if (typeTag) header.appendChild(typeTag);
  header.appendChild(checkbox);
  item.appendChild(header);
  item.appendChild(preview);
  item.appendChild(footer);

  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    if (e.target.checked) {
      selectedModuleIds.add(module.id);
    } else {
      selectedModuleIds.delete(module.id);
    }
    renderContentModules();
    notifyContentContextChanged();
  });

  item.addEventListener("click", (e) => {
    if (e.target.closest(".mini-btn") || e.target.closest(".module-checkbox") || e.target.closest(".module-title-input") || e.target.closest(".qa-children-toggle")) return;
    openFullContent(module.id);
  });

  renameBtn.addEventListener("click", (e) => { e.stopPropagation(); startEditingModuleTitle(module, title); });
  viewBtn.addEventListener("click", (e) => { e.stopPropagation(); openFullContent(module.id); });
  deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); removeContentModule(module.id); });

  return item;
}

function renderQaChildrenSection(parentId, children, { isEnabled, selectedModuleIds, contentModules }) {
  const section = document.createElement("div");
  section.className = "qa-children-section";

  const isExpanded = expandedQaGroups.has(parentId);

  // Toggle bar
  const toggle = document.createElement("div");
  toggle.className = `qa-children-toggle${isExpanded ? " expanded" : ""}`;
  toggle.innerHTML = `
    <svg class="icon toggle-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    <span>问答笔记</span>
    <span class="qa-children-count">(${children.length})</span>
  `;
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (expandedQaGroups.has(parentId)) {
      expandedQaGroups.delete(parentId);
    } else {
      expandedQaGroups.add(parentId);
    }
    renderContentModules();
  });
  section.appendChild(toggle);

  // Children list (only if expanded)
  if (isExpanded) {
    const list = document.createElement("div");
    list.className = "qa-children-list";
    for (const child of children) {
      const childItem = renderModuleItem(child, { isEnabled, selectedModuleIds, contentModules, isChild: true });
      list.appendChild(childItem);
    }
    section.appendChild(list);
  }

  return section;
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
  clearModulesBtn.disabled = selectedCount === 0;
  contentModuleList.innerHTML = "";

  if (contentModules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "content-module-empty";
    empty.textContent = currentPageData ? "未提取到可预览内容" : "暂无预览内容";
    contentModuleList.appendChild(empty);
    return;
  }

  // Separate modules into regular and QA notes
  const regularModules = contentModules.filter((m) => !m.isQaNote);
  const qaModules = contentModules.filter((m) => m.isQaNote);

  // Build parent-children map
  const childrenMap = new Map(); // parentId -> QA modules[]
  const orphanQa = [];

  for (const qa of qaModules) {
    const sourceIds = Array.isArray(qa.sourceModuleIds) ? qa.sourceModuleIds : [];
    const matchedParents = sourceIds.filter((id) => regularModules.find((m) => m.id === id));

    if (matchedParents.length > 0) {
      // Add to each matched parent's children list
      for (const parentId of matchedParents) {
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(qa);
      }
    } else {
      orphanQa.push(qa);
    }
  }

  const renderCtx = { isEnabled, selectedModuleIds, contentModules };

  // Render each regular module with its QA children
  for (const parent of regularModules) {
    const item = renderModuleItem(parent, renderCtx);
    const children = childrenMap.get(parent.id);

    // Parent checkbox linkage: toggling parent also toggles children
    const parentCheckbox = item.querySelector(".module-checkbox");
    parentCheckbox.removeEventListener("change", parentCheckbox._handler);
    const parentHandler = (e) => {
      e.stopPropagation();
      const checked = e.target.checked;
      if (checked) {
        selectedModuleIds.add(parent.id);
      } else {
        selectedModuleIds.delete(parent.id);
      }
      // Linkage: also toggle all children
      if (children) {
        for (const child of children) {
          if (checked) selectedModuleIds.add(child.id);
          else selectedModuleIds.delete(child.id);
        }
      }
      renderContentModules();
      notifyContentContextChanged();
    };
    parentCheckbox._handler = parentHandler;
    parentCheckbox.addEventListener("change", parentHandler);

    contentModuleList.appendChild(item);

    // Render QA children section if any
    if (children && children.length > 0) {
      const childSection = renderQaChildrenSection(parent.id, children, renderCtx);
      contentModuleList.appendChild(childSection);
    }
  }

  // Render orphan QA group
  if (orphanQa.length > 0) {
    const orphanGroup = document.createElement("div");
    orphanGroup.className = "orphan-qa-group";

    const orphanHeader = document.createElement("div");
    orphanHeader.className = `qa-children-toggle${expandedQaGroups.has("orphan") ? " expanded" : ""}`;
    orphanHeader.innerHTML = `
      <svg class="icon toggle-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <span>未关联来源</span>
      <span class="qa-children-count">(${orphanQa.length})</span>
    `;
    orphanHeader.addEventListener("click", (e) => {
      e.stopPropagation();
      if (expandedQaGroups.has("orphan")) {
        expandedQaGroups.delete("orphan");
      } else {
        expandedQaGroups.add("orphan");
      }
      renderContentModules();
    });
    orphanGroup.appendChild(orphanHeader);

    if (expandedQaGroups.has("orphan")) {
      const list = document.createElement("div");
      list.className = "qa-children-list";
      for (const qa of orphanQa) {
        const childItem = renderModuleItem(qa, { ...renderCtx, isChild: true });
        list.appendChild(childItem);
      }
      orphanGroup.appendChild(list);
    }

    contentModuleList.appendChild(orphanGroup);
  }
}
