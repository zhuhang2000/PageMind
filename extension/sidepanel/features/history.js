import { resultArea, historyList, historyCount, clearHistoryBtn, historySearchInput, historyDrawer } from "../lib/dom-refs.js";
import { renderUserQuestion, renderResult, initQaSelectToggle } from "./results.js";
import { closeDrawer, openDrawerById } from "./drawers.js";
import { pmConfirm } from "./modal.js";

const SESSION_STORAGE_KEY = "aiWebAssistant.sessions.v1";
const LEGACY_HISTORY_STORAGE_KEY = "aiWebAssistant.history.v1";
const ACTIVE_SESSION_STORAGE_KEY = "aiWebAssistant.activeSessionId.v1";
const MAX_SESSIONS = 20;
const MAX_TOTAL_MESSAGES = 50;
const MAX_HISTORY_CONTENT_CHARS = 20000;
const MAX_HISTORY_ANSWER_CHARS = 5000;

let sessions = [];
let activeSessionId = "";
let sessionSearchQuery = "";
let sessionSearchTimer = null;

function makeHistoryId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSessionTitle(value) {
  return String(value || "新会话").replace(/\s+/g, " ").trim().slice(0, 60) || "新会话";
}

function formatHistoryTime(value) {
  const date = new Date(value || Date.now());
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateHistoryText(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function createSession({ title, pageTitle, pageUrl } = {}) {
  const now = Date.now();
  const resolvedTitle = normalizeSessionTitle(title || pageTitle || "新会话");
  return {
    id: makeHistoryId(),
    title: resolvedTitle,
    createdAt: now,
    updatedAt: now,
    pageTitle: String(pageTitle || ""),
    pageUrl: String(pageUrl || ""),
    messages: [],
  };
}

function createSessionMessage({ provider, question, instruction, content, summary }) {
  const contentText = String(content || "");
  const answerText = String(summary || "");
  const questionText = String(question || instruction || "");

  return {
    id: makeHistoryId(),
    createdAt: Date.now(),
    provider: String(provider || "unknown"),
    question: questionText,
    answer: answerText.slice(0, MAX_HISTORY_ANSWER_CHARS),
    contentPreview: contentText.slice(0, MAX_HISTORY_CONTENT_CHARS),
    contentCharCount: contentText.length,
    answerCharCount: answerText.length,
  };
}

function trimSessions(inputSessions) {
  const nextSessions = [...inputSessions]
    .map((session) => ({
      ...session,
      messages: [...(session.messages || [])]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, MAX_TOTAL_MESSAGES),
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_SESSIONS);

  let remainingMessages = MAX_TOTAL_MESSAGES;
  return nextSessions.map((session) => {
    const messages = (session.messages || []).slice(0, Math.max(remainingMessages, 0));
    remainingMessages -= messages.length;
    return { ...session, messages };
  });
}

function countMessages(inputSessions) {
  return inputSessions.reduce((sum, session) => sum + (session.messages?.length || 0), 0);
}

function searchSessions(inputSessions, query) {
  const keyword = String(query || "").trim().toLowerCase();
  if (!keyword) return inputSessions;

  return inputSessions.filter((session) =>
    [
      session.title,
      session.pageTitle,
      session.pageUrl,
      ...(session.messages || []).flatMap((message) => [
        message.question,
        message.answer,
        message.contentPreview,
        message.provider,
      ]),
    ]
      .join("\n")
      .toLowerCase()
      .includes(keyword)
  );
}

function migrateFlatHistory(flatHistory) {
  if (!Array.isArray(flatHistory) || flatHistory.length === 0) return [];

  const now = Date.now();
  const messages = flatHistory
    .slice(0, MAX_TOTAL_MESSAGES)
    .map((item) => ({
      id: item.id || makeHistoryId(),
      createdAt: item.createdAt || now,
      provider: item.provider || "unknown",
      question: item.instruction || "",
      answer: String(item.summary || "").slice(0, MAX_HISTORY_ANSWER_CHARS),
      contentPreview: String(item.contentPreview || "").slice(0, MAX_HISTORY_CONTENT_CHARS),
      contentCharCount: item.contentCharCount || item.contentPreview?.length || 0,
      answerCharCount: item.summaryCharCount || item.summary?.length || 0,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const first = flatHistory[0] || {};
  return [
    {
      id: makeHistoryId(),
      title: "历史记录迁移",
      createdAt: now,
      updatedAt: now,
      pageTitle: first.title || "",
      pageUrl: first.url || "",
      messages,
    },
  ];
}

async function loadSessions() {
  if (!globalThis.chrome?.storage?.local) {
    return sessions;
  }

  const result = await chrome.storage.local.get({
    [SESSION_STORAGE_KEY]: [],
    [LEGACY_HISTORY_STORAGE_KEY]: [],
    [ACTIVE_SESSION_STORAGE_KEY]: "",
  });

  sessions = Array.isArray(result[SESSION_STORAGE_KEY]) ? result[SESSION_STORAGE_KEY] : [];
  if (sessions.length === 0 && Array.isArray(result[LEGACY_HISTORY_STORAGE_KEY]) && result[LEGACY_HISTORY_STORAGE_KEY].length > 0) {
    sessions = trimSessions(migrateFlatHistory(result[LEGACY_HISTORY_STORAGE_KEY]));
    await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: sessions });
    await chrome.storage.local.remove(LEGACY_HISTORY_STORAGE_KEY);
  }

  activeSessionId = result[ACTIVE_SESSION_STORAGE_KEY] || sessions[0]?.id || "";
  if (activeSessionId && !sessions.some((session) => session.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id || "";
  }

  return sessions;
}

async function persistSessions() {
  sessions = trimSessions(sessions);
  if (activeSessionId && !sessions.some((session) => session.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id || "";
  }
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.set({
    [SESSION_STORAGE_KEY]: sessions,
    [ACTIVE_SESSION_STORAGE_KEY]: activeSessionId,
  });
  await chrome.storage.local.remove(LEGACY_HISTORY_STORAGE_KEY);
}

export async function createNewSession({ title, pageTitle, pageUrl } = {}) {
  const session = createSession({ title, pageTitle, pageUrl });
  sessions = [session, ...sessions];
  activeSessionId = session.id;
  await persistSessions();
  renderActiveSession();
  renderSessionList();
  return session;
}

export async function ensureActiveSession({ pageTitle, pageUrl } = {}) {
  await loadSessions();
  let active = sessions.find((session) => session.id === activeSessionId);
  if (!active) {
    active = await createNewSession({ title: pageTitle || "新会话", pageTitle, pageUrl });
  }
  return active;
}

export async function saveHistoryRecord(input) {
  const active = await ensureActiveSession({
    pageTitle: input.title,
    pageUrl: input.url,
  });
  const message = createSessionMessage(input);
  active.messages = [message, ...(active.messages || [])];
  active.updatedAt = Date.now();
  if (!active.pageTitle && input.title) active.pageTitle = input.title;
  if (!active.pageUrl && input.url) active.pageUrl = input.url;
  if (!active.title || active.title === "新会话") {
    active.title = normalizeSessionTitle(input.title || input.instruction || "新会话");
  }
  await persistSessions();
  renderSessionList();
  return message;
}

async function switchSession(sessionId) {
  if (!sessions.some((session) => session.id === sessionId)) return;
  activeSessionId = sessionId;
  await persistSessions();
  renderActiveSession();
  renderSessionList();
  closeDrawer(historyDrawer);
}

function startRenameSession(session, titleEl, titleText, renameBtn) {
  const oldName = session.title || "未命名会话";
  const input = document.createElement("input");
  input.className = "history-rename-input";
  input.type = "text";
  input.value = oldName;
  input.spellcheck = false;

  titleText.style.display = "none";
  renameBtn.style.display = "none";
  titleEl.appendChild(input);
  input.focus();
  input.select();

  const commit = async () => {
    const newName = input.value.trim() || oldName;
    session.title = newName;
    titleText.textContent = newName;
    titleText.style.display = "";
    renameBtn.style.display = "";
    input.remove();
    await persistSessions();
  };

  input.addEventListener("blur", commit, { once: true });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.value = oldName; input.blur(); }
  });
}

async function deleteSession(sessionId) {
  if (!await pmConfirm("删除这个会话？", { message: "该会话的所有问答记录将被删除", confirmText: "删除" })) return;
  sessions = sessions.filter((session) => session.id !== sessionId);
  if (activeSessionId === sessionId) {
    activeSessionId = sessions[0]?.id || "";
  }
  await persistSessions();
  renderActiveSession();
  renderSessionList();
}

export async function clearHistoryRecords() {
  sessions = [];
  activeSessionId = "";
  await persistSessions();
  renderActiveSession();
  renderSessionList();
}

export async function loadDemoSessions(inputSessions, nextActiveSessionId = "", options = {}) {
  sessions = trimSessions(Array.isArray(inputSessions) ? inputSessions : []);
  activeSessionId = nextActiveSessionId || sessions[0]?.id || "";
  if (activeSessionId && !sessions.some((session) => session.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id || "";
  }
  if (options.persist === true) {
    await persistSessions();
  }
  renderActiveSession();
  renderSessionList();
  return sessions;
}

export async function initHistory() {
  await loadSessions();
  renderActiveSession();
  renderSessionList();
  return sessions;
}

export async function openHistoryDrawer() {
  await loadSessions();
  renderSessionList();
  openDrawerById("historyDrawer");
  historySearchInput?.focus({ preventScroll: true });
}

export function handleHistorySearchInput() {
  clearTimeout(sessionSearchTimer);
  sessionSearchTimer = setTimeout(() => {
    sessionSearchQuery = historySearchInput?.value || "";
    renderSessionList();
  }, 180);
}

export function renderActiveSession() {
  if (!resultArea) return;

  const active = sessions.find((session) => session.id === activeSessionId);
  resultArea.innerHTML = "";

  if (!active || !active.messages?.length) {
    renderResultPlaceholder();
    return;
  }

  const orderedMessages = [...active.messages].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  for (const message of orderedMessages) {
    renderUserQuestion(message.question);
    renderResult(message.answer, false, {
      provider: message.provider,
      title: active.pageTitle || active.title,
      url: active.pageUrl,
      question: message.question,
      contentPreview: message.contentPreview,
      contentCharCount: message.contentCharCount,
    });
  }
  initQaSelectToggle();
  resultArea.scrollTo({ top: resultArea.scrollHeight });
}

function renderResultPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "result-placeholder";
  placeholder.innerHTML = `
    <div class="placeholder-icon-wrapper">
      <svg class="placeholder-brand-icon" viewBox="0 0 200 200" aria-hidden="true">
        <rect width="200" height="200" rx="44" fill="#14181a"/>
        <text x="30" y="148" font-family="'Instrument Serif', Fraunces, Georgia, serif" font-size="160" font-style="italic" font-weight="500" fill="#3d6249">P</text>
        <text x="70" y="148" font-family="'Instrument Serif', Fraunces, Georgia, serif" font-size="150" font-style="italic" font-weight="500" fill="#f4efe4">m</text>
        <rect x="24" y="156" width="150" height="2.4" fill="#c08a3e"/>
        <circle cx="190" cy="155" r="7" fill="#c08a3e"/>
      </svg>
    </div>
    <div class="placeholder-title">你好，我是 PageMind</div>
    <div class="placeholder-copy">我可以帮你总结网页、分析图片或回答问题</div>
  `;
  resultArea.appendChild(placeholder);
}

function renderSessionList() {
  if (!historyList || !historyCount) return;

  const visibleSessions = searchSessions(sessions, sessionSearchQuery);
  historyCount.textContent = `${visibleSessions.length}/${sessions.length} 个会话 · ${countMessages(sessions)} 条`;
  clearHistoryBtn.disabled = sessions.length === 0;
  historyList.innerHTML = "";

  if (sessions.length === 0) {
    historyList.appendChild(createHistoryEmpty("暂无会话"));
    return;
  }

  if (visibleSessions.length === 0) {
    historyList.appendChild(createHistoryEmpty("没有匹配的会话"));
    return;
  }

  for (const session of visibleSessions) {
    historyList.appendChild(createSessionItem(session));
  }
}

function createHistoryEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "history-empty";
  empty.textContent = text;
  return empty;
}

function createSessionItem(session) {
  const row = document.createElement("article");
  row.className = "history-item session-item";
  if (session.id === activeSessionId) row.classList.add("active-session");

  const header = document.createElement("div");
  header.className = "history-item-header";

  const title = document.createElement("div");
  title.className = "history-item-title";

  const titleText = document.createElement("span");
  titleText.className = "history-title-text";
  titleText.textContent = session.title || "未命名会话";

  const renameBtn = document.createElement("button");
  renameBtn.className = "mini-btn rename-btn";
  renameBtn.type = "button";
  renameBtn.title = "修改会话标题";
  renameBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg><span>重命名</span>';
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startRenameSession(session, title, titleText, renameBtn);
  });

  title.appendChild(titleText);
  title.appendChild(renameBtn);

  const count = document.createElement("span");
  count.className = "history-provider";
  count.textContent = `${session.messages?.length || 0} 轮`;

  const meta = document.createElement("div");
  meta.className = "history-item-meta";
  meta.textContent = `${formatHistoryTime(session.updatedAt)} · ${session.pageUrl || "无来源 URL"}`;

  const latest = [...(session.messages || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const preview = document.createElement("div");
  preview.className = "history-summary";
  preview.textContent = latest
    ? truncateHistoryText(`${latest.question} / ${latest.answer}`, 220)
    : "空会话";

  const actions = document.createElement("div");
  actions.className = "history-actions";

  const switchBtn = document.createElement("button");
  switchBtn.className = "mini-btn primary";
  switchBtn.type = "button";
  switchBtn.title = session.id === activeSessionId ? "已是当前会话" : "切换到此会话";
  switchBtn.textContent = session.id === activeSessionId ? "当前会话" : "切换";
  switchBtn.disabled = session.id === activeSessionId;
  switchBtn.addEventListener("click", () => switchSession(session.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "mini-btn subtle-danger";
  deleteBtn.type = "button";
  deleteBtn.title = "删除此会话";
  deleteBtn.textContent = "删除";
  deleteBtn.addEventListener("click", () => deleteSession(session.id));

  header.appendChild(title);
  header.appendChild(count);
  actions.appendChild(switchBtn);
  actions.appendChild(deleteBtn);
  row.appendChild(header);
  row.appendChild(meta);
  row.appendChild(preview);
  row.appendChild(actions);
  return row;
}

export const __historyInternals = {
  createSession,
  createSessionMessage,
  trimSessions,
  countMessages,
  migrateFlatHistory,
  searchSessions,
  truncateHistoryText,
  loadDemoSessions,
};
