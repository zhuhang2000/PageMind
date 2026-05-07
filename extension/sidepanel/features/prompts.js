import { promptInput } from "../lib/dom-refs.js";
import { getSavedPrompts, setSavedPrompts, getEditingPromptId, setEditingPromptId } from "../lib/state.js";
import { openDrawerById, closeAllDrawers } from "./drawers.js";

let promptDragState = null;
let promptDragRafPending = false;
let suppressPromptCardClick = false;

function makePromptId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fillPromptInput(text) {
  promptInput.value = text;
  promptInput.dispatchEvent(new Event("input"));
  promptInput.focus();
}

export function renderPromptList() {
  const promptListEl = document.getElementById("promptList");
  if (!promptListEl) return;

  const savedPrompts = getSavedPrompts();
  promptListEl.innerHTML = "";

  if (savedPrompts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "content-module-empty";
    empty.textContent = "还没有提示词模板，点击上方“新增”创建一个。";
    promptListEl.appendChild(empty);
    return;
  }

  savedPrompts.forEach((prompt, index) => {
    const card = document.createElement("div");
    card.className = "prompt-card";
    card.dataset.promptId = prompt.id;
    card.dataset.promptIndex = String(index);

    card.innerHTML = `
      <div class="prompt-card-body">
        <div class="prompt-card-main">
          <div class="prompt-card-header">
            <div class="prompt-card-name">${prompt.name || "未命名"}</div>
            <div class="prompt-card-actions">
              <button class="mini-btn edit-btn" title="编辑">
                <svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span>编辑</span>
              </button>
              <button class="mini-btn delete-btn subtle-danger" title="删除">
                <svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>删除</span>
              </button>
            </div>
          </div>
          <div class="prompt-card-preview">${prompt.text}</div>
        </div>
        <button class="prompt-drag-handle" type="button" title="拖拽调整模板位置" aria-label="拖拽调整模板位置">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="6" r="1.4"></circle><circle cx="15" cy="6" r="1.4"></circle>
            <circle cx="9" cy="12" r="1.4"></circle><circle cx="15" cy="12" r="1.4"></circle>
            <circle cx="9" cy="18" r="1.4"></circle><circle cx="15" cy="18" r="1.4"></circle>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (suppressPromptCardClick) { e.preventDefault(); return; }
      if (e.target.closest(".mini-btn")) return;
      fillPromptInput(prompt.text);
      closeAllDrawers();
    });

    card.querySelector(".edit-btn").addEventListener("click", (e) => { e.stopPropagation(); openPromptEditor(prompt.id); });
    card.querySelector(".delete-btn").addEventListener("click", (e) => { e.stopPropagation(); deletePrompt(prompt.id); });

    bindPromptDragEvents(card);
    promptListEl.appendChild(card);
  });
}

function bindPromptDragEvents(card) {
  const handle = card.querySelector(".prompt-drag-handle");
  if (!handle) return;
  handle.addEventListener("click", (event) => event.stopPropagation());
  handle.addEventListener("dragstart", (event) => event.preventDefault());
  handle.addEventListener("pointerdown", (event) => startPromptPointerDrag(event, card));
}

function startPromptPointerDrag(event, card) {
  if (event.button !== 0) return;
  const list = card.closest(".prompt-list");
  if (!list) return;

  event.preventDefault();
  event.stopPropagation();

  const scrollContainer = card.closest(".drawer-content");
  const cardRect = card.getBoundingClientRect();
  promptDragRafPending = false;
  promptDragState = {
    card, list, scrollContainer,
    originalNextSibling: card.nextElementSibling,
    originPlaceholder: createPromptOriginPlaceholder(card),
    startY: event.clientY, startTop: cardRect.top, startLeft: cardRect.left,
    grabOffsetY: event.clientY - cardRect.top,
    cardHeight: cardRect.height, currentTop: cardRect.top, previousTop: cardRect.top,
    dragDirection: 0, lastPointerY: event.clientY, autoScrollFrame: 0,
    placeholder: createPromptDropPlaceholder(card),
    moved: false, lastIndicatorTargetId: null, lastIndicatorInsertAfter: null,
  };
  card.style.left = `${cardRect.left}px`;
  card.style.top = `${cardRect.top}px`;
  card.style.width = `${cardRect.width}px`;
  card.after(promptDragState.originPlaceholder);
  card.classList.add("dragging");
  document.body.appendChild(card);
  list.classList.add("is-sorting");
  list.style.setProperty("--prompt-drag-space", `${card.offsetHeight + 44}px`);
  scrollContainer?.classList.add("prompt-sort-scroll-region");

  document.addEventListener("pointermove", handlePromptPointerMove);
  document.addEventListener("pointerup", handlePromptPointerUp, { once: true });
}

function handlePromptPointerMove(event) {
  if (!promptDragState) return;
  promptDragState.lastPointerY = event.clientY;
  if (!promptDragRafPending) {
    promptDragRafPending = true;
    requestAnimationFrame(() => {
      promptDragRafPending = false;
      if (!promptDragState) return;
      applyPromptDragPosition(promptDragState.lastPointerY);
      autoScrollPromptList(promptDragState.lastPointerY);
    });
  }
}

function applyPromptDragPosition(pointerY) {
  if (!promptDragState) return;
  const { card, list, scrollContainer, startTop, grabOffsetY, cardHeight } = promptDragState;
  let nextTop = pointerY - grabOffsetY;
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const minTop = containerRect.top + 8;
    const maxTop = containerRect.bottom - cardHeight - 8;
    if (maxTop > minTop) nextTop = Math.min(Math.max(nextTop, minTop), maxTop);
  }
  if (Math.abs(nextTop - startTop) > 3) promptDragState.moved = true;

  const dy = nextTop - startTop;
  card.style.transform = `translate3d(0, ${dy}px, 0) scale(1.015)`;

  const delta = nextTop - promptDragState.currentTop;
  if (Math.abs(delta) > 5) promptDragState.dragDirection = Math.sign(delta);
  promptDragState.previousTop = promptDragState.currentTop;
  promptDragState.currentTop = nextTop;
  updatePromptDropIndicator(list, card);
}

function handlePromptPointerUp() {
  if (!promptDragState) return;
  const { card, list, scrollContainer, placeholder, originPlaceholder, originalNextSibling, moved } = promptDragState;
  const hasPlaceholder = Boolean(placeholder?.isConnected);

  document.removeEventListener("pointermove", handlePromptPointerMove);
  if (promptDragState.autoScrollFrame) cancelAnimationFrame(promptDragState.autoScrollFrame);
  suppressPromptCardClick = moved;

  if (hasPlaceholder) {
    const beforeRect = card.getBoundingClientRect();
    placeholder.replaceWith(card);
    finishFloatingPromptDrop(card, beforeRect);
    persistPromptOrderFromDom(list);
  } else {
    if (originalNextSibling?.isConnected && originalNextSibling.parentElement === list) {
      list.insertBefore(card, originalNextSibling);
    } else {
      list.appendChild(card);
    }
  }

  removePromptDropPlaceholder();
  originPlaceholder?.remove();
  list.classList.remove("is-sorting");
  list.style.removeProperty("--prompt-drag-space");
  scrollContainer?.classList.remove("prompt-sort-scroll-region");
  if (!hasPlaceholder) clearFloatingPromptCard(card);
  promptDragState = null;
  setTimeout(() => { suppressPromptCardClick = false; }, 0);
}

function autoScrollPromptList(pointerY) {
  const scrollContainer = promptDragState?.scrollContainer;
  if (!scrollContainer) return;
  const rect = scrollContainer.getBoundingClientRect();
  const edgeSize = 72;
  const maxStep = 18;
  let step = 0;
  if (pointerY > rect.bottom - edgeSize) step = Math.min(maxStep, Math.max(4, pointerY - (rect.bottom - edgeSize)) / 3);
  else if (pointerY < rect.top + edgeSize) step = -Math.min(maxStep, Math.max(4, rect.top + edgeSize - pointerY) / 3);

  if (step) {
    scrollContainer.scrollTop += step;
    applyPromptDragPosition(pointerY);
    if (!promptDragState.autoScrollFrame) {
      promptDragState.autoScrollFrame = requestAnimationFrame(() => {
        if (!promptDragState) return;
        promptDragState.autoScrollFrame = 0;
        autoScrollPromptList(promptDragState.lastPointerY);
      });
    }
  }
}

function updatePromptDropIndicator(list, draggedCard) {
  const cards = Array.from(list.querySelectorAll(".prompt-card:not(.prompt-origin-placeholder)")).filter((item) => item !== draggedCard);
  const placeholder = promptDragState?.placeholder;
  if (!placeholder) return;
  if (cards.length === 0) { list.appendChild(placeholder); return; }

  let target = null;
  let insertAfter = false;
  const dragRect = draggedCard.getBoundingClientRect();
  const direction = promptDragState?.dragDirection || 0;
  const probeY = direction < 0 ? dragRect.top + dragRect.height * 0.12 : dragRect.top + dragRect.height * 0.88;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (probeY < rect.top + rect.height / 2) { target = card; insertAfter = false; break; }
    target = card;
    insertAfter = true;
  }

  if (!target) return;
  const targetId = target.dataset.promptId ?? null;
  if (targetId === promptDragState.lastIndicatorTargetId && insertAfter === promptDragState.lastIndicatorInsertAfter) return;
  promptDragState.lastIndicatorTargetId = targetId;
  promptDragState.lastIndicatorInsertAfter = insertAfter;

  if (insertAfter) target.after(placeholder);
  else target.before(placeholder);
}

function createPromptDropPlaceholder(card) {
  const placeholder = document.createElement("div");
  placeholder.className = "prompt-drop-placeholder";
  placeholder.style.minHeight = `${card.offsetHeight}px`;
  placeholder.innerHTML = `
    <div class="prompt-drop-placeholder-title">${card.querySelector(".prompt-card-name")?.textContent || "模板位置"}</div>
    <div class="prompt-drop-placeholder-copy">松开后放到这里</div>
  `;
  return placeholder;
}

function createPromptOriginPlaceholder(card) {
  const clone = card.cloneNode(true);
  clone.classList.add("prompt-origin-placeholder");
  clone.removeAttribute("data-prompt-id");
  clone.removeAttribute("data-prompt-index");
  clone.querySelectorAll("button").forEach((button) => { button.disabled = true; button.setAttribute("tabindex", "-1"); });
  return clone;
}

function removePromptDropPlaceholder() { promptDragState?.placeholder?.remove(); }

function finishFloatingPromptDrop(card, beforeRect) {
  card.classList.remove("dragging");
  card.style.left = ""; card.style.top = ""; card.style.width = ""; card.style.transform = ""; card.style.transition = "none";
  const afterRect = card.getBoundingClientRect();
  const deltaY = beforeRect.top - afterRect.top;
  const deltaX = beforeRect.left - afterRect.left;
  card.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1.015)`;
  requestAnimationFrame(() => {
    card.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    card.style.transform = "";
    card.addEventListener("transitionend", () => { card.style.transition = ""; }, { once: true });
  });
}

function clearFloatingPromptCard(card, options = {}) {
  card.classList.remove("dragging");
  card.style.left = ""; card.style.top = ""; card.style.width = "";
  if (!options.keepTransform) card.style.transform = "";
}

function persistPromptOrderFromDom(list) {
  const ids = Array.from(list.querySelectorAll(".prompt-card:not(.prompt-origin-placeholder)"))
    .map((card) => card.dataset.promptId).filter(Boolean);
  const savedPrompts = getSavedPrompts();
  const byId = new Map(savedPrompts.map((prompt) => [prompt.id, prompt]));
  setSavedPrompts(ids.map((id) => byId.get(id)).filter(Boolean));
  persistSavedPrompts().catch((error) => console.warn("保存提示词顺序失败", error));
}

export function openPromptEditor(promptId = "") {
  const editorTitle = document.getElementById("editorTitle");
  const promptNameInputEl = document.getElementById("promptNameInput");
  const promptTextInputEl = document.getElementById("promptTextInput");
  const deleteBtn = document.getElementById("deletePromptBtn");

  setEditingPromptId(promptId);
  const savedPrompts = getSavedPrompts();

  if (promptId) {
    const prompt = savedPrompts.find((p) => p.id === promptId);
    editorTitle.textContent = "编辑模板";
    promptNameInputEl.value = prompt.name;
    promptTextInputEl.value = prompt.text;
    deleteBtn.style.display = "flex";
  } else {
    editorTitle.textContent = "新增模板";
    promptNameInputEl.value = "";
    promptTextInputEl.value = "";
    deleteBtn.style.display = "none";
  }

  openDrawerById("promptEditorDrawer");
}

export async function savePrompt() {
  const name = document.getElementById("promptNameInput").value.trim();
  const text = document.getElementById("promptTextInput").value.trim();

  if (!text) { alert("请填写提示词内容"); return; }

  const savedPrompts = getSavedPrompts();
  const editingPromptId = getEditingPromptId();

  if (editingPromptId) {
    const index = savedPrompts.findIndex((p) => p.id === editingPromptId);
    if (index !== -1) savedPrompts[index] = { ...savedPrompts[index], name: name || "未命名", text };
  } else {
    savedPrompts.unshift({ id: makePromptId(), name: name || "未命名", text });
  }

  setSavedPrompts(savedPrompts);
  await persistSavedPrompts();
  renderPromptList();
  openDrawerById("promptDrawer");
}

export async function deletePrompt(id) {
  if (!confirm("确定要删除这个提示词模板吗？")) return;

  const savedPrompts = getSavedPrompts();
  setSavedPrompts(savedPrompts.filter((p) => p.id !== id));
  await persistSavedPrompts();
  renderPromptList();

  if (getEditingPromptId() === id) openDrawerById("promptDrawer");
}

export async function loadSavedPrompts() {
  if (!globalThis.chrome?.storage?.local) {
    setSavedPrompts(loadLocalPromptFallback());
    renderPromptList();
    return;
  }
  const data = await chrome.storage.local.get({ savedPrompts: [] });
  setSavedPrompts(data.savedPrompts);
  renderPromptList();
}

async function persistSavedPrompts() {
  const savedPrompts = getSavedPrompts();
  if (globalThis.chrome?.storage?.local) {
    await chrome.storage.local.set({ savedPrompts });
    return;
  }
  localStorage.setItem("aiWebAssistant.savedPrompts.demoFallback.v1", JSON.stringify(savedPrompts));
}

function loadLocalPromptFallback() {
  try {
    const raw = localStorage.getItem("aiWebAssistant.savedPrompts.demoFallback.v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
