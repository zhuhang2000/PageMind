/**
 * PageMind Modal — 统一弹窗系统
 * 替代原生 alert / confirm，匹配 paper + sage 主题
 */

let modalRoot = null;

function ensureModalRoot() {
  if (modalRoot) return modalRoot;
  modalRoot = document.createElement("div");
  modalRoot.className = "pm-modal-overlay";
  modalRoot.addEventListener("click", (e) => {
    if (e.target === modalRoot) dismissTopModal();
  });
  document.body.appendChild(modalRoot);
  return modalRoot;
}

function dismissTopModal() {
  const overlay = modalRoot;
  if (!overlay) return;
  const dialog = overlay.querySelector(".pm-modal");
  if (!dialog) return;
  // Trigger reject for confirm modals
  const rejectBtn = dialog.querySelector(".pm-modal-btn.cancel");
  if (rejectBtn) rejectBtn.click();
  else hideModal();
}

function showModal(dialog) {
  const overlay = ensureModalRoot();
  overlay.innerHTML = "";
  overlay.appendChild(dialog);
  // Force reflow then animate in
  void dialog.offsetHeight;
  overlay.classList.add("visible");
  dialog.classList.add("visible");
  // Focus first action button
  const firstBtn = dialog.querySelector(".pm-modal-btn.primary, .pm-modal-btn");
  firstBtn?.focus();

  // Esc to close
  const onKey = (e) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKey);
      dismissTopModal();
    }
  };
  document.addEventListener("keydown", onKey);
}

function hideModal() {
  if (!modalRoot) return;
  const dialog = modalRoot.querySelector(".pm-modal");
  if (dialog) dialog.classList.remove("visible");
  modalRoot.classList.remove("visible");
  setTimeout(() => { if (modalRoot) modalRoot.innerHTML = ""; }, 200);
}

function escapeModalHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createDialog({ icon, title, message, buttons, className = "" }) {
  const dialog = document.createElement("div");
  dialog.className = `pm-modal ${className}`.trim();
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");

  const iconMap = {
    warning: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    danger: `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    success: `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  };

  dialog.innerHTML = `
    <div class="pm-modal-icon ${icon || "info"}">${iconMap[icon] || iconMap.info}</div>
    <div class="pm-modal-title">${title}</div>
    ${message ? `<div class="pm-modal-message">${message}</div>` : ""}
    <div class="pm-modal-actions"></div>
  `;

  const actionsEl = dialog.querySelector(".pm-modal-actions");
  for (const btn of buttons) {
    const buttonEl = document.createElement("button");
    buttonEl.className = `pm-modal-btn ${btn.class || ""}`;
    buttonEl.textContent = btn.label;
    buttonEl.addEventListener("click", () => {
      hideModal();
      btn.onClick?.();
    });
    actionsEl.appendChild(buttonEl);
  }

  return dialog;
}

/**
 * 提示弹窗 — 替代 alert()
 * @param {string} title
 * @param {string} [message]
 * @param {"info"|"warning"|"success"} [icon]
 */
export function pmAlert(title, message = "", icon = "warning") {
  return new Promise((resolve) => {
    const dialog = createDialog({
      icon,
      title,
      message,
      buttons: [
        { label: "知道了", class: "primary", onClick: resolve },
      ],
    });
    showModal(dialog);
  });
}

/**
 * 复制成功弹窗 — 展示已复制的完整导出文本
 * @param {object} options
 * @param {string} options.text
 * @param {number} [options.pairCount]
 * @param {number} [options.contentCount]
 */
export function pmCopySuccess({ text = "", pairCount = 0, contentCount = 0 } = {}) {
  const copyMeta = [
    pairCount ? `${pairCount} 条问答` : "",
    `${contentCount} 段网页内容已去重`,
  ].filter(Boolean).join(" · ");

  return new Promise((resolve) => {
    const dialog = createDialog({
      icon: "success",
      title: "内容已复制，可交给 AI 深度分析",
      message: `
        <div class="pm-copy-success-summary">${escapeModalHtml(copyMeta || "已复制选中内容")}</div>
        <pre class="pm-copy-success-text">${escapeModalHtml(text)}</pre>
      `,
      className: "pm-copy-success-modal",
      buttons: [
        { label: "知道了", class: "primary", onClick: resolve },
      ],
    });
    showModal(dialog);
  });
}

/**
 * 确认弹窗 — 替代 confirm()
 * @param {string} title
 * @param {object} [options]
 * @param {string} [options.message]
 * @param {string} [options.confirmText="确定"]
 * @param {string} [options.cancelText="取消"]
 * @param {"danger"|"warning"|"info"} [options.icon="danger"]
 * @param {boolean} [options.danger=false] 确认按钮是否为危险红色
 * @returns {Promise<boolean>}
 */
export function pmConfirm(title, options = {}) {
  const {
    message = "",
    confirmText = "确定",
    cancelText = "取消",
    icon = "danger",
    danger = true,
  } = options;

  return new Promise((resolve) => {
    const dialog = createDialog({
      icon,
      title,
      message,
      buttons: [
        { label: cancelText, class: "cancel", onClick: () => resolve(false) },
        { label: confirmText, class: danger ? "primary danger" : "primary", onClick: () => resolve(true) },
      ],
    });
    showModal(dialog);
  });
}
