import { drawerOverlay, attachmentMenu, promptInput } from "../lib/dom-refs.js";

const DRAWER_LAYOUT_STORAGE_KEY = "gemini.sidepanel.drawerLayouts.v1";
let drawerLayouts = loadDrawerLayouts();
const openedDrawersThisSession = new Set();

function resolveDrawerPanel(panel) {
  if (typeof panel === "string") return document.getElementById(panel);
  return panel;
}

function isDrawerPanel(panel) {
  return Boolean(panel?.classList?.contains("drawer-panel"));
}

export function openDrawer(panel) {
  const drawerPanel = resolveDrawerPanel(panel);
  if (!isDrawerPanel(drawerPanel)) {
    console.warn("openDrawer skipped: invalid drawer panel", panel);
    return;
  }

  closeAttachmentMenu();
  closeAllDrawers({ includePinned: false });
  const shouldCenterOnOpen = !openedDrawersThisSession.has(drawerPanel.id || "");
  restoreDrawerLayout(drawerPanel, { centerPosition: shouldCenterOnOpen });
  if (drawerPanel.id) openedDrawersThisSession.add(drawerPanel.id);
  drawerPanel.classList.add("active");
  syncDrawerOverlay();
}

export function openDrawerById(panelId) {
  openDrawer(document.getElementById(panelId));
}

export function closeAllDrawers({ includePinned = true } = {}) {
  document.querySelectorAll(".drawer-panel").forEach((panel) => {
    if (!includePinned && panel.dataset.pinned === "true") return;
    panel.classList.remove("active");
  });
  syncDrawerOverlay();
}

export function closeDrawer(panel) {
  const drawerPanel = resolveDrawerPanel(panel);
  if (!isDrawerPanel(drawerPanel)) return;
  drawerPanel.classList.remove("active");
  syncDrawerOverlay();
}

export function closeAttachmentMenu() {
  attachmentMenu.classList.remove("open");
}

function loadDrawerLayouts() {
  try {
    return JSON.parse(localStorage.getItem(DRAWER_LAYOUT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDrawerLayouts() {
  localStorage.setItem(DRAWER_LAYOUT_STORAGE_KEY, JSON.stringify(drawerLayouts));
}

function hasBlockingDrawer() {
  return Boolean(document.querySelector('.drawer-panel.active:not([data-pinned="true"])'));
}

function syncDrawerOverlay() {
  drawerOverlay.classList.toggle("active", hasBlockingDrawer());
}

function clampDrawerPosition(panel, left, top) {
  if (!isDrawerPanel(panel)) return { left: 0, top: 0 };

  const padding = 10;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
  const maxTop = Math.max(padding, window.innerHeight - rect.height - padding);

  return {
    left: Math.min(Math.max(left, padding), maxLeft),
    top: Math.min(Math.max(top, padding), maxTop),
  };
}

function positionDrawer(panel, left, top) {
  if (!isDrawerPanel(panel)) return { left: 0, top: 0 };

  const next = clampDrawerPosition(panel, left, top);
  panel.classList.add("drawer-positioned");
  panel.style.left = `${next.left}px`;
  panel.style.top = `${next.top}px`;
  return next;
}

function resizeDrawer(panel, width, height) {
  if (!isDrawerPanel(panel)) return { width: 0, height: 0 };

  const padding = 10;
  const maxWidth = Math.max(240, window.innerWidth - padding * 2);
  const maxHeight = Math.max(180, window.innerHeight - padding * 2);
  const minWidth = panel.classList.contains("full") ? 420 : 320;
  const minHeight = panel.classList.contains("full") ? 360 : 180;
  const nextWidth = Math.min(Math.max(width || panel.offsetWidth, minWidth), maxWidth);
  const nextHeight = Math.min(Math.max(height || panel.offsetHeight, minHeight), maxHeight);

  panel.style.width = `${nextWidth}px`;
  panel.style.height = `${nextHeight}px`;
  return { width: nextWidth, height: nextHeight };
}

function saveDrawerLayout(panel) {
  if (!isDrawerPanel(panel) || !panel.id || !panel.classList.contains("active")) return;

  const rect = panel.getBoundingClientRect();
  drawerLayouts[panel.id] = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  saveDrawerLayouts();
}

function resetDrawerLayout(panel) {
  if (!isDrawerPanel(panel)) return;

  panel.classList.remove("drawer-positioned", "is-dragging");
  panel.style.left = "";
  panel.style.top = "";
  panel.style.width = "";
  panel.style.height = "";
}

function restoreDrawerLayout(panel, { centerPosition = false } = {}) {
  if (!isDrawerPanel(panel)) return;

  const savedLayout = drawerLayouts[panel.id];
  if (centerPosition) {
    resetDrawerLayout(panel);
    if (savedLayout) resizeDrawer(panel, savedLayout.width, savedLayout.height);
    return;
  }

  if (savedLayout) {
    resizeDrawer(panel, savedLayout.width, savedLayout.height);
    positionDrawer(panel, savedLayout.left, savedLayout.top);
    return;
  }

  resetDrawerLayout(panel);
}

function updateDrawerPinButton(panel) {
  if (!isDrawerPanel(panel)) return;

  const pinButton = panel.querySelector(".drawer-pin-btn");
  if (!pinButton) return;

  const isPinned = panel.dataset.pinned === "true";
  pinButton.classList.toggle("active", isPinned);
  pinButton.title = isPinned ? "已固定：点击外部仍保持显示" : "固定：点击外部仍保持显示";
  pinButton.setAttribute("aria-pressed", String(isPinned));
  pinButton.querySelector("span").textContent = isPinned ? "已固定" : "固定";
}

function toggleDrawerPinned(panel) {
  if (!isDrawerPanel(panel)) return;

  const shouldPin = panel.dataset.pinned !== "true";
  panel.dataset.pinned = shouldPin ? "true" : "false";
  updateDrawerPinButton(panel);
  syncDrawerOverlay();

  if (shouldPin) {
    promptInput.focus({ preventScroll: true });
  }
}

function startDrawerDrag(panel, event) {
  if (!isDrawerPanel(panel)) return;
  if (event.button !== 0) return;
  if (!panel.classList.contains("active")) return;

  event.preventDefault();
  const rect = panel.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  panel.classList.add("is-dragging");
  positionDrawer(panel, rect.left, rect.top);

  const handlePointerMove = (moveEvent) => {
    positionDrawer(panel, moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
  };

  const handlePointerUp = () => {
    panel.classList.remove("is-dragging");
    saveDrawerLayout(panel);
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
  };

  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp, { once: true });
}

function ensureDrawerPinButton(panel) {
  if (!isDrawerPanel(panel)) return;
  if (panel.querySelector(".drawer-pin-btn")) return;

  const header = panel.querySelector(".drawer-header");
  if (!header) return;

  const pinButton = document.createElement("button");
  pinButton.className = "drawer-pin-btn";
  pinButton.type = "button";
  pinButton.title = "固定：点击外部仍保持显示";
  pinButton.setAttribute("aria-pressed", "false");
  pinButton.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 17-5 5v-5H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"></path>
      <path d="M12 8v5"></path>
      <path d="M9.5 10.5h5"></path>
    </svg>
    <span>固定</span>
  `;

  pinButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDrawerPinned(panel);
  });

  const closeButton = header.querySelector(".close-drawer-btn");
  if (closeButton) {
    closeButton.before(pinButton);
  } else {
    const actions = header.querySelector(".drawer-actions");
    if (actions) {
      actions.appendChild(pinButton);
    } else {
      header.appendChild(pinButton);
    }
  }
}

export function initDraggableDrawers() {
  document.querySelectorAll(".drawer-panel").forEach((panel) => {
    ensureDrawerPinButton(panel);
    updateDrawerPinButton(panel);

    const header = panel.querySelector(".drawer-header");
    if (!header) return;

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      startDrawerDrag(panel, event);
    });
  });
}

export function initResizableDrawerPersistence() {
  if (!("ResizeObserver" in window)) return;

  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const panel = entry.target;
      if (!panel.classList.contains("active")) return;
      saveDrawerLayout(panel);
    });
  });

  document.querySelectorAll(".drawer-panel").forEach((panel) => {
    resizeObserver.observe(panel);
  });
}
