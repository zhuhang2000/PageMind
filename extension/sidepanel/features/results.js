import { resultArea, submittedContentViewer, submittedContentTitle, submittedContentMeta, submittedContentQuestion, submittedContentText, qaSelectToggleBtn } from "../lib/dom-refs.js";
import { getLastResult } from "../lib/state.js";
import { escapeHtml } from "../lib/text-utils.js";
import { openDrawerById } from "./drawers.js";
import { pmCopySuccess } from "./modal.js";

const RESULT_COLLAPSE_LINES = 6;

export function renderLoading() {
  const loading = document.createElement("div");
  loading.className = "loading";
  loading.innerHTML = `
    <div class="gemini-loader"></div>
    <span class="loading-label">PageMind 正在分析中…</span>
  `;
  resultArea.appendChild(loading);
}

export function renderUserQuestion(question) {
  const card = document.createElement("div");
  card.className = "user-question-card";
  card.innerHTML = `
    <div class="user-question-text">${escapeHtml(question)}</div>
  `;
  resultArea.appendChild(card);
  updateQaSelectControl();
}

export function renderError(msg) {
  const error = document.createElement("div");
  error.className = "error-card";
  error.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    <span>${msg}</span>
  `;
  resultArea.appendChild(error);
}

export function renderResult(summary, isSelection, context = {}) {
  const lastResult = getLastResult();
  const tag = isSelection
    ? `<span class="result-tag selection">选中文本</span>`
    : `<span class="result-tag ${escapeHtml(context.provider || "default")}">${escapeHtml(formatProviderLabel(context.provider))}</span>`;
  const qaText = formatQaRecordText({
    title: context.title || lastResult?.title || "",
    url: context.url || lastResult?.url || "",
    content: context.contentPreview || lastResult?.contentPreview || "",
    contentCharCount: context.contentCharCount || lastResult?.contentCharCount || 0,
    question: context.question || "",
    summary,
  });
  const submittedContent = String(context.contentPreview || "");
  const contentCharCount = Number(context.contentCharCount || submittedContent.length || 0);
  const hasSubmittedContent = submittedContent.trim().length > 0;
  const contentPreviewText = makeSubmittedContentPreview(submittedContent, 260);

  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    <div class="result-meta">
      ${tag}
      <div class="result-actions">
        <button class="mini-action-btn copy-answer-btn" data-tooltip="复制回复" aria-label="复制回复">
          <svg class="icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="mini-action-btn copy-qa-btn" data-tooltip="复制完整内容" aria-label="复制完整内容">
          <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>
        </button>
      </div>
    </div>
    <div class="result-text" spellcheck="false">${escapeHtml(summary)}</div>
    <button class="result-expand-btn" type="button" style="display:none">
      <span>展开</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
    ${
      hasSubmittedContent
        ? `<details class="submitted-content-preview">
            <summary>
              <span>提交内容预览</span>
              <span class="submitted-content-count">${contentCharCount} 字${contentCharCount > submittedContent.length ? " · 已截断保存" : ""}</span>
            </summary>
            <div class="submitted-content-text">${escapeHtml(contentPreviewText)}</div>
            <button class="mini-action-btn submitted-view-btn" type="button" data-tooltip="查看提交全文" aria-label="查看提交全文">
              <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>
              <span>查看全文</span>
            </button>
          </details>`
        : ""
    }
  `;

  // Store context for multi-select export
  card._qaExport = {
    question: context.question || "",
    content: submittedContent,
    title: context.title || lastResult?.title || "",
    url: context.url || lastResult?.url || "",
  };

  resultArea.appendChild(card);

  const copyQaBtn = card.querySelector(".copy-qa-btn");
  copyQaBtn.addEventListener("click", () => {
    copyQaBtn.disabled = true;
    navigator.clipboard.writeText(qaText)
      .then(() => pmCopySuccess({
        text: qaText,
        pairCount: 1,
        contentCount: hasSubmittedContent ? 1 : 0,
      }))
      .catch(() => {
        renderError("复制失败，请检查浏览器剪贴板权限");
      })
      .finally(() => {
        copyQaBtn.disabled = false;
      });
  });

  const copyAnswerBtn = card.querySelector(".copy-answer-btn");
  copyAnswerBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(summary).then(() => {
      const originalIcon = copyAnswerBtn.innerHTML;
      copyAnswerBtn.innerHTML = `<svg class="icon" style="color:var(--success)" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => (copyAnswerBtn.innerHTML = originalIcon), 2000);
    });
  });

  // Expand / collapse for long answers
  const resultText = card.querySelector(".result-text");
  const expandBtn = card.querySelector(".result-expand-btn");
  let isResultExpanded = false;
  let expandMeasureFrame = 0;

  const scheduleRefreshExpandState = () => {
    cancelAnimationFrame(expandMeasureFrame);
    expandMeasureFrame = requestAnimationFrame(refreshExpandState);
  };

  const refreshExpandState = () => {
    resultText.classList.remove("clamped");

    if (shouldCollapseResultText(resultText)) {
      expandBtn.style.display = "";
      resultText.classList.toggle("clamped", !isResultExpanded);
      expandBtn.classList.toggle("expanded", isResultExpanded);
      expandBtn.querySelector("span").textContent = isResultExpanded ? "收起" : "展开";
    } else {
      expandBtn.style.display = "none";
      expandBtn.classList.remove("expanded");
      expandBtn.querySelector("span").textContent = "展开";
      resultText.classList.remove("clamped");
    }
  };

  expandBtn.addEventListener("click", () => {
    isResultExpanded = !isResultExpanded;
    resultText.classList.toggle("clamped", !isResultExpanded);
    expandBtn.classList.toggle("expanded", isResultExpanded);
    expandBtn.querySelector("span").textContent = isResultExpanded ? "收起" : "展开";
  });

  scheduleRefreshExpandState();
  document.fonts?.ready?.then(scheduleRefreshExpandState);

  if ("ResizeObserver" in window) {
    const expandResizeObserver = new ResizeObserver(scheduleRefreshExpandState);
    expandResizeObserver.observe(card);
    expandResizeObserver.observe(resultArea);
  } else {
    window.addEventListener("resize", scheduleRefreshExpandState);
  }

  const submittedViewBtn = card.querySelector(".submitted-view-btn");
  submittedViewBtn?.addEventListener("click", () => {
    openSubmittedContentViewer({
      title: context.title || lastResult?.title || "提交内容",
      url: context.url || lastResult?.url || "",
      question: context.question || "",
      content: submittedContent,
      contentCharCount,
    });
  });

  document.dispatchEvent(
    new CustomEvent("aiWebAssistant:result-card-rendered", {
      detail: {
        card,
        summary,
        context: {
          ...context,
          title: context.title || lastResult?.title || "",
          url: context.url || lastResult?.url || "",
          question: context.question || "",
        },
      },
    })
  );
}

function toPixels(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldCollapseResultText(resultText) {
  const wasClamped = resultText.classList.contains("clamped");
  resultText.classList.remove("clamped");

  const style = getComputedStyle(resultText);
  const lineHeight = toPixels(style.lineHeight);
  if (!lineHeight) {
    resultText.classList.toggle("clamped", wasClamped);
    return false;
  }

  const paddingY = toPixels(style.paddingTop) + toPixels(style.paddingBottom);
  const contentHeight = Math.max(0, resultText.scrollHeight - paddingY);
  const maxContentHeight = lineHeight * RESULT_COLLAPSE_LINES;
  const tolerance = Math.max(3, lineHeight * 0.2);

  resultText.classList.toggle("clamped", wasClamped);
  return contentHeight > maxContentHeight + tolerance;
}

function formatQaRecordText({ title = "", url = "", content = "", contentCharCount = 0, question = "", summary = "" }) {
  const savedContent = String(content || "").trim();
  const originalContentLength = Number(contentCharCount || savedContent.length || 0);
  const contentLabel =
    originalContentLength > savedContent.length
      ? `根据网页内容（已保存前 ${savedContent.length} 字，原始提交约 ${originalContentLength} 字）：`
      : "根据网页内容：";

  return [
    title ? `网页标题：\n${title}` : "",
    url ? `网页链接：\n${url}` : "",
    savedContent ? `${contentLabel}\n${savedContent}` : "根据网页内容：\n（未保存提交内容）",
    `用户提问：\n${question || "无"}`,
    `模型回复：\n${summary || ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatProviderLabel(provider) {
  const value = String(provider || "").toLowerCase();
  if (value === "deepseek") return "DeepSeek";
  if (value === "codex") return "Codex";
  if (value === "gemini") return "Gemini";
  return "默认模型";
}

function makeSubmittedContentPreview(text, maxLength = 260) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function openSubmittedContentViewer({ title, url, question, content, contentCharCount }) {
  if (!submittedContentViewer || !submittedContentText) return;

  submittedContentTitle.textContent = title || "提交内容";
  submittedContentMeta.textContent = `${contentCharCount || content.length || 0} 字${contentCharCount > content.length ? " · 已截断保存" : ""}${url ? ` · ${url}` : ""}`;
  submittedContentQuestion.textContent = question || "无问题";
  submittedContentText.textContent = content || "";
  openDrawerById("submittedContentViewer");
}

// ── Multi-select Q&A for export ──────────────────────────────────────

let qaSelectActive = false;
let qaBar = null;

export function initQaSelectToggle() {
  if (qaSelectActive) qaExit();
  qaSelectActive = false;
  updateQaSelectControl();
}

export function toggleQaSelectMode() {
  if (!resultArea.querySelector(".result-card")) return;
  qaSelectActive ? qaExit() : qaEnter();
}

function updateQaSelectControl() {
  if (!qaSelectToggleBtn) return;
  const hasResults = Boolean(resultArea.querySelector(".result-card"));
  qaSelectToggleBtn.disabled = !hasResults;
  qaSelectToggleBtn.classList.toggle("active", qaSelectActive);
  qaSelectToggleBtn.title = qaSelectActive ? "取消多选导出" : "多选导出聊天记录";
  qaSelectToggleBtn.setAttribute("aria-pressed", String(qaSelectActive));
  const label = qaSelectToggleBtn.querySelector("span");
  if (label) label.textContent = qaSelectActive ? "取消" : "多选导出聊天记录";
}

function qaEnter() {
  qaSelectActive = true;
  resultArea.classList.add("qa-select-mode");
  updateQaSelectControl();

  // Wrap consecutive question → answer into .qa-pair
  const nodes = [...resultArea.children];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el.classList.contains("user-question-card")) continue;
    const next = el.nextElementSibling;
    if (!next || !next.classList.contains("result-card")) continue;
    const wrap = document.createElement("div");
    wrap.className = "qa-pair";
    el.before(wrap);
    wrap.appendChild(el);
    wrap.appendChild(next);
    const mark = document.createElement("div");
    mark.className = "qa-check";
    mark.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    wrap.prepend(mark);
  }

  resultArea.addEventListener("click", qaHandleClick);
  qaShowBar();
}

function qaExit() {
  qaSelectActive = false;
  resultArea.classList.remove("qa-select-mode");
  resultArea.removeEventListener("click", qaHandleClick);
  updateQaSelectControl();

  resultArea.querySelectorAll(".qa-pair").forEach((p) => {
    p.querySelector(".qa-check")?.remove();
    while (p.firstChild) p.before(p.firstChild);
    p.remove();
  });

  qaHideBar();
}

function qaHandleClick(e) {
  const pair = e.target.closest(".qa-pair");
  if (!pair) return;
  if (e.target.closest("button, a, details, input, label, .result-actions, .submitted-content-preview, .result-expand-btn")) return;
  pair.classList.toggle("selected");
  qaUpdateBar();
}

function qaShowBar() {
  if (qaBar) return;
  qaBar = document.createElement("div");
  qaBar.className = "qa-select-bar";
  qaBar.innerHTML = `
    <span class="qa-select-count">已选 0 条</span>
    <div class="qa-select-actions">
      <button class="mini-btn" data-qa="all">全选</button>
      <button class="mini-btn primary" data-qa="copy" disabled>复制选中</button>
    </div>`;
  qaBar.addEventListener("click", (e) => {
    const action = e.target.closest("[data-qa]")?.dataset.qa;
    if (action === "all") qaToggleAll();
    if (action === "copy") qaCopy();
  });
  resultArea.after(qaBar);
}

function qaHideBar() {
  qaBar?.remove();
  qaBar = null;
}

function qaUpdateBar() {
  if (!qaBar) return;
  const total = resultArea.querySelectorAll(".qa-pair").length;
  const count = resultArea.querySelectorAll(".qa-pair.selected").length;
  qaBar.querySelector(".qa-select-count").textContent = `已选 ${count} 条`;
  qaBar.querySelector('[data-qa="copy"]').disabled = count === 0;
  qaBar.querySelector('[data-qa="all"]').textContent = count === total ? "取消全选" : "全选";
}

function qaToggleAll() {
  const pairs = resultArea.querySelectorAll(".qa-pair");
  const allOn = resultArea.querySelectorAll(".qa-pair.selected").length === pairs.length;
  pairs.forEach((p) => (allOn ? p.classList.remove("selected") : p.classList.add("selected")));
  qaUpdateBar();
}

function qaCopy() {
  const selected = [...resultArea.querySelectorAll(".qa-pair.selected")];
  if (!selected.length) return;

  // Collect Q&A pairs
  const qaParts = [];
  const seenContent = new Set();
  const contentBlocks = [];
  let pageTitle = "";
  let pageUrl = "";

  for (const pair of selected) {
    const q = pair.querySelector(".user-question-text")?.textContent?.trim() || "";
    const a = pair.querySelector(".result-text")?.textContent?.trim() || "";
    qaParts.push(`问：${q}\n答：${a}`);

    // Collect unique webpage content
    const card = pair.querySelector(".result-card");
    const exported = card?._qaExport;
    if (exported) {
      if (!pageTitle && exported.title) pageTitle = exported.title;
      if (!pageUrl && exported.url) pageUrl = exported.url;
      const content = exported.content?.trim();
      if (content && !seenContent.has(content)) {
        seenContent.add(content);
        contentBlocks.push(content);
      }
    }
  }

  // Build final text: header + content + Q&A
  const sections = [];
  if (pageTitle) sections.push(`网页标题：${pageTitle}`);
  if (pageUrl) sections.push(`网页链接：${pageUrl}`);
  if (contentBlocks.length) {
    sections.push(`网页内容：\n${contentBlocks.join("\n\n")}`);
  }
  sections.push(qaParts.join("\n\n---\n\n"));

  const text = sections.join("\n\n");
  const copyBtn = qaBar?.querySelector('[data-qa="copy"]');
  if (copyBtn) copyBtn.disabled = true;

  navigator.clipboard.writeText(text)
    .then(() => pmCopySuccess({
      text,
      pairCount: selected.length,
      contentCount: contentBlocks.length,
    }))
    .then(() => {
      qaExit();
    })
    .catch(() => {
      renderError("复制失败，请检查浏览器剪贴板权限");
    })
    .finally(() => {
      qaUpdateBar();
    });
}
