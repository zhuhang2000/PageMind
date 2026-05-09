const SIDE_PANEL_PATH = "sidepanel.html";
const openWindowIds = new Set();

function markPanelOpen(info = {}) {
  if (typeof info.windowId === "number") {
    openWindowIds.add(info.windowId);
  }
}

function markPanelClosed(info = {}) {
  if (typeof info.windowId === "number") {
    openWindowIds.delete(info.windowId);
  }
}

async function openPanel(windowId) {
  await chrome.sidePanel.open({ windowId });
  openWindowIds.add(windowId);
}

async function closePanel(windowId) {
  if (typeof chrome.sidePanel.close !== "function") {
    console.warn("当前 Chrome 版本不支持 chrome.sidePanel.close()，只能打开侧边栏。");
    openWindowIds.delete(windowId);
    return;
  }

  await chrome.sidePanel.close({ windowId });
  openWindowIds.delete(windowId);
}

async function togglePanel(windowId) {
  if (openWindowIds.has(windowId)) {
    await closePanel(windowId);
    return;
  }

  await openPanel(windowId);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: SIDE_PANEL_PATH,
    enabled: true,
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setOptions({
    path: SIDE_PANEL_PATH,
    enabled: true,
  });
});

if (chrome.sidePanel.onOpened) {
  chrome.sidePanel.onOpened.addListener(markPanelOpen);
}

if (chrome.sidePanel.onClosed) {
  chrome.sidePanel.onClosed.addListener(markPanelClosed);
}

// 点击插件图标时打开/关闭 side panel
chrome.action.onClicked.addListener((tab) => {
  if (typeof tab?.windowId !== "number") return;
  togglePanel(tab.windowId).catch((error) => {
    console.warn("PageMind side panel toggle failed:", error?.message || error);
  });
});
