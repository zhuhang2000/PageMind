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
  const allCards = [...list.querySelectorAll(".prompt-card")];
  const dragIndex = allCards.indexOf(card);
  const gap = 10; // matches CSS gap

  // Collect sibling rects before any DOM changes
  const siblings = allCards
    .filter((c) => c !== card)
    .map((el, i) => ({
      el,
      originalIndex: i >= dragIndex ? i + 1 : i,
      rect: el.getBoundingClientRect(),
      displaced: false,
    }));

  // Insert invisible spacer to hold the card's space in the list
  const spacer = document.createElement("div");
  spacer.className = "prompt-drag-spacer";
  spacer.style.height = `${cardRect.height}px`;
  card.replaceWith(spacer);

  promptDragRafPending = false;
  promptDragState = {
    card, list, scrollContainer, spacer,
    startY: event.clientY, startTop: cardRect.top, startLeft: cardRect.left,
    grabOffsetY: event.clientY - cardRect.top,
    cardHeight: cardRect.height, currentTop: cardRect.top,
    lastPointerY: event.clientY, autoScrollFrame: 0,
    moved: false,
    siblings, dragIndex, currentIndex: dragIndex, gap,
    initialScrollTop: scrollContainer?.scrollTop || 0,
  };

  card.style.left = `${cardRect.left}px`;
  card.style.top = `${cardRect.top}px`;
  card.style.width = `${cardRect.width}px`;
  card.classList.add("dragging");
  document.body.appendChild(card);
  list.classList.add("is-sorting");
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
  const s = promptDragState;
  let nextTop = pointerY - s.grabOffsetY;
  if (s.scrollContainer) {
    const containerRect = s.scrollContainer.getBoundingClientRect();
    const minTop = containerRect.top + 8;
    const maxTop = containerRect.bottom - s.cardHeight - 8;
    if (maxTop > minTop) nextTop = Math.min(Math.max(nextTop, minTop), maxTop);
  }
  if (Math.abs(nextTop - s.startTop) > 3) s.moved = true;

  const dy = nextTop - s.startTop;
  s.card.style.transform = `translate3d(0, ${dy}px, 0) scale(1.02)`;
  s.currentTop = nextTop;

  // Edge-based hit detection: use top/bottom edges of the dragged card
  // instead of center. Triggers swaps ~half a card height sooner → feels
  // much more responsive and iOS-like.
  const dragTop = s.startTop + dy;
  const dragBottom = dragTop + s.cardHeight;

  // Compensate for scroll changes since drag started
  const scrollDelta = s.scrollContainer
    ? s.scrollContainer.scrollTop - s.initialScrollTop
    : 0;

  let newIndex = s.dragIndex;
  for (const sib of s.siblings) {
    const sibMid = sib.rect.top + sib.rect.height / 2 - scrollDelta;
    if (s.dragIndex < sib.originalIndex && dragBottom > sibMid) {
      // Dragging downward: bottom edge past sibling midpoint → take furthest
      newIndex = Math.max(newIndex, sib.originalIndex);
    } else if (s.dragIndex > sib.originalIndex && dragTop < sibMid) {
      // Dragging upward: top edge past sibling midpoint → take furthest
      newIndex = Math.min(newIndex, sib.originalIndex);
    }
  }

  // Update sibling transforms only when index changes
  if (newIndex !== s.currentIndex) {
    s.currentIndex = newIndex;
    const shiftH = s.cardHeight + s.gap;
    for (const sib of s.siblings) {
      const shouldDisplace =
        (sib.originalIndex > s.dragIndex && sib.originalIndex <= newIndex) ||
        (sib.originalIndex < s.dragIndex && sib.originalIndex >= newIndex);
      if (shouldDisplace && !sib.displaced) {
        sib.el.style.transform = sib.originalIndex > s.dragIndex
          ? `translateY(-${shiftH}px)` : `translateY(${shiftH}px)`;
        sib.displaced = true;
      } else if (!shouldDisplace && sib.displaced) {
        sib.el.style.transform = "";
        sib.displaced = false;
      }
    }
  }
}

function handlePromptPointerUp() {
  if (!promptDragState) return;
  const s = promptDragState;

  document.removeEventListener("pointermove", handlePromptPointerMove);
  if (s.autoScrollFrame) cancelAnimationFrame(s.autoScrollFrame);
  suppressPromptCardClick = s.moved;

  // ── FLIP: First — snapshot visual positions while still in drag state ──
  const firstPos = new Map();
  firstPos.set(s.card, s.card.getBoundingClientRect());
  for (const sib of s.siblings) {
    firstPos.set(sib.el, sib.el.getBoundingClientRect());
  }

  // ── Freeze: kill ALL transitions BEFORE any DOM/transform changes ──
  // .prompt-card base CSS has `transition: transform 220ms`, which would
  // animate siblings back to their DOM positions when we clear their
  // transforms. Setting transition:none prevents this flash.
  for (const sib of s.siblings) sib.el.style.transition = "none";
  s.card.style.transition = "none";

  // ── DOM batch: rearrange everything to final state ──
  s.list.classList.remove("is-sorting");
  s.spacer?.remove();
  for (const sib of s.siblings) sib.el.style.transform = "";
  s.card.classList.remove("dragging");
  s.card.style.left = "";
  s.card.style.top = "";
  s.card.style.width = "";
  s.card.style.transform = "";

  const listCards = [...s.list.querySelectorAll(".prompt-card")];
  if (s.currentIndex >= listCards.length) {
    s.list.appendChild(s.card);
  } else {
    listCards[s.currentIndex].before(s.card);
  }

  // ── FLIP: Invert — measure final positions, apply compensating transforms ──
  const allEls = [s.card, ...s.siblings.map((x) => x.el)];
  const animating = [];
  for (const el of allEls) {
    const first = firstPos.get(el);
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      animating.push(el);
    } else {
      // Already in place — restore base CSS transitions
      el.style.transition = "";
    }
  }

  // ── FLIP: Play — animate to final layout positions ──
  if (animating.length > 0) {
    requestAnimationFrame(() => {
      for (const el of animating) {
        el.style.transition = "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        el.style.transform = "";
      }
      const cleanup = () => {
        for (const el of animating) {
          el.style.transition = "";
        }
      };
      animating[0].addEventListener("transitionend", cleanup, { once: true });
      setTimeout(cleanup, 280);
    });
  }

  // Persist new order
  if (s.moved && s.currentIndex !== s.dragIndex) {
    persistPromptOrderFromDom(s.list);
  }

  s.scrollContainer?.classList.remove("prompt-sort-scroll-region");
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

function persistPromptOrderFromDom(list) {
  const ids = Array.from(list.querySelectorAll(".prompt-card"))
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
