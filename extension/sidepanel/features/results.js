import { resultArea, submittedContentViewer, submittedContentTitle, submittedContentMeta, submittedContentQuestion, submittedContentText } from "../lib/dom-refs.js";
import { getLastResult } from "../lib/state.js";
import { escapeHtml } from "../lib/text-utils.js";
import { openDrawerById } from "./drawers.js";

export function renderLoading() {
  const loading = document.createElement("div");
  loading.className = "loading";
  loading.innerHTML = `
    <div class="gemini-loader"></div>
    <span class="loading-label">Gemini 正在分析中…</span>
  `;
  resultArea.appendChild(loading);
}

export function renderUserQuestion(question) {
  const card = document.createElement("div");
  card.className = "user-question-card";
  card.innerHTML = `
    <div class="user-question-meta">我的问题</div>
    <div class="user-question-text">${escapeHtml(question)}</div>
  `;
  resultArea.appendChild(card);
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
    : `<span class="result-tag ${escapeHtml(context.provider || "gemini")}">${escapeHtml(formatProviderLabel(context.provider))}</span>`;
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
        <button class="mini-action-btn copy-answer-btn" title="复制回复">
          <svg class="icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="mini-action-btn copy-qa-btn" title="复制完整上下文">
          <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>
        </button>
      </div>
    </div>
    <div class="result-text">${escapeHtml(summary)}</div>
    ${
      hasSubmittedContent
        ? `<details class="submitted-content-preview">
            <summary>
              <span>提交内容预览</span>
              <span class="submitted-content-count">${contentCharCount} 字${contentCharCount > submittedContent.length ? " · 已截断保存" : ""}</span>
            </summary>
            <div class="submitted-content-text">${escapeHtml(contentPreviewText)}</div>
            <button class="mini-action-btn submitted-view-btn" type="button" title="查看提交全文">
              <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>
              <span>查看全文</span>
            </button>
          </details>`
        : ""
    }
  `;

  resultArea.appendChild(card);

  const copyQaBtn = card.querySelector(".copy-qa-btn");
  copyQaBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(qaText).then(() => {
      const originalIcon = copyQaBtn.innerHTML;
      copyQaBtn.innerHTML = `<svg class="icon" style="color:var(--success)" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => (copyQaBtn.innerHTML = originalIcon), 2000);
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
  const value = String(provider || "gemini").toLowerCase();
  if (value === "deepseek") return "DeepSeek";
  if (value === "codex") return "Codex";
  return "Gemini";
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
