import { bridgeStatus, pageTitle, pageUrl, refreshPageBtn, includePageContent } from "../lib/dom-refs.js";
import { MAX_SELECTED_CONTENT_CHARS } from "../lib/constants.js";
import { getCurrentPageData, setCurrentPageDataRaw } from "../lib/state.js";
import { getSelectedModules, setCurrentPageData } from "./content-modules.js";
import { closeFullContent } from "./full-content.js";
import { renderContentModules } from "./content-modules.js";
import { api } from "../lib/api.js";

export function buildSelectedPageContent() {
  if (!includePageContent.checked) return "";

  const selectedModules = getSelectedModules();
  if (selectedModules.length === 0) return "";

  const content = selectedModules
    .map((module, index) => {
      const label = module.label || `内容模块 ${index + 1}`;
      return `## 模块：${label}\n${module.content || ""}`;
    })
    .join("\n\n");

  if (content.length <= MAX_SELECTED_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_SELECTED_CONTENT_CHARS)}\n...[内容已截断]`;
}

export async function ensureCurrentPageData() {
  const currentPageData = getCurrentPageData();
  if (currentPageData) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (
      tab?.id === currentPageData.tabId
      && (!tab.url || tab.url === currentPageData.url)
      && !currentPageData.isMetadataOnly
    ) {
      return currentPageData;
    }
  }

  const pageData = await getPageContent();
  setCurrentPageData(pageData);
  return pageData;
}

export async function checkBridge() {
  try {
    await api.checkHealth();
    if (bridgeStatus) bridgeStatus.className = "bridge-status online";
  } catch {
    if (bridgeStatus) bridgeStatus.className = "bridge-status offline";
  }
}

export async function refreshPageInfo({ extractContent = true } = {}) {
  refreshPageBtn.disabled = true;
  try {
    const pageData = extractContent ? await getPageContent() : await getActiveTabMetadata();
    setCurrentPageData(pageData);
    pageTitle.textContent = pageData.title || "未知标题";
    pageUrl.textContent = pageData.url || "";
  } catch {
    setCurrentPageDataRaw(null);
    closeFullContent({ save: false });
    renderContentModules();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      pageTitle.textContent = tab?.title || "无法读取当前标签页";
      pageUrl.textContent = tab?.url || "";
    } catch {
      pageTitle.textContent = "无法读取当前标签页";
      pageUrl.textContent = "";
    }
  } finally {
    refreshPageBtn.disabled = false;
  }
}

async function getActiveTabMetadata() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("无法获取当前标签页");

  return {
    tabId: tab.id,
    title: tab.title || "未知标题",
    url: tab.url || "",
    content: "",
    contentModules: [],
    isSelection: false,
    isMetadataOnly: true,
  };
}

async function getPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("无法获取当前标签页");

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-script.js"],
    });
  } catch {
    // 已注入或不可注入时忽略错误
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: "getContent" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("无法连接到网页，请刷新后重试"));
        return;
      }
      resolve({ ...response, tabId: tab.id });
    });
  });
}
