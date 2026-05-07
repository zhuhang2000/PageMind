(() => {
if (globalThis.__GEMINI_WEB_ASSISTANT_MESSAGE_HANDLER__) {
  chrome.runtime.onMessage.removeListener(globalThis.__GEMINI_WEB_ASSISTANT_MESSAGE_HANDLER__);
}

const MAX_LEGACY_CONTENT_CHARS = 8000;
const MAX_MODULE_CONTENT_CHARS = 200000;
const MIN_MODULE_CHARS = 24;
const MODULE_PREVIEW_CHARS = 260;

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 清理正文：合并多余空行，截断超长内容
function cleanText(text, maxChars = Infinity) {
  let cleaned = normalizeText(text);
  if (Number.isFinite(maxChars) && cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + "\n...[内容已截断]";
  }
  return cleaned;
}

function makePreview(text) {
  const compact = normalizeText(text).replace(/\n+/g, " ");
  return compact.length > MODULE_PREVIEW_CHARS
    ? `${compact.slice(0, MODULE_PREVIEW_CHARS)}...`
    : compact;
}

function makeSelectorHint(node) {
  if (!node?.tagName) return "";

  const tag = node.tagName.toLowerCase();
  const id = node.id ? `#${node.id}` : "";
  const className = [...node.classList]
    .slice(0, 2)
    .map((item) => `.${item}`)
    .join("");

  return `${tag}${id}${className}`.slice(0, 80);
}

function getModuleLabel(node, fallback) {
  if (!node?.tagName) return fallback;

  const tag = node.tagName.toLowerCase();
  const heading = node.matches("h1,h2,h3")
    ? node
    : node.querySelector("h1,h2,h3");
  const headingText = heading?.innerText?.trim();
  if (headingText) return headingText.slice(0, 40);

  const labelMap = {
    article: "文章正文",
    section: "内容区块",
    main: "主内容",
    p: "段落",
    li: "列表项",
    blockquote: "引用",
    pre: "代码块",
    table: "表格",
  };

  return labelMap[tag] || fallback;
}

function createContentModule({ id, label, content, selectorHint = "", defaultChecked = true }) {
  const cleaned = cleanText(content);
  return {
    id,
    label,
    selectorHint,
    content: cleaned,
    preview: makePreview(cleaned),
    charCount: cleaned.length,
    defaultChecked,
  };
}

function appendUniqueModule(modules, seen, module) {
  if (!module?.content || module.content.length < MIN_MODULE_CHARS) return;

  const signature = normalizeText(module.content).slice(0, 240);
  if (!signature || seen.has(signature)) return;

  seen.add(signature);
  modules.push(module);
}

function extractDomModules(root, sourceLabel = "网页内容") {
  if (!root?.innerText?.trim()) return [];

  const modules = [];
  const seen = new Set();
  appendUniqueModule(
    modules,
    seen,
    createContentModule({
      id: "full-content",
      label: sourceLabel,
      selectorHint: makeSelectorHint(root),
      content: cleanText(root.innerText, MAX_MODULE_CONTENT_CHARS),
    })
  );

  return modules.map((module, index) => ({
    ...module,
    id: `${module.id}-${index}`,
  }));
}

function getStatusId() {
  const match = location.pathname.match(/\/status\/(\d+)/);
  return match?.[1] || "";
}

function getXAuthor(article) {
  const userName = article.querySelector('[data-testid="User-Name"]')?.innerText?.trim();
  if (userName) return userName;
  return article.querySelector('a[href^="/"]')?.innerText?.trim() || "";
}

function getXPostTime(article) {
  return article.querySelector("time")?.getAttribute("datetime") || "";
}

function getXPostText(article) {
  const tweetTexts = [...article.querySelectorAll('[data-testid="tweetText"]')]
    .map((node) => node.innerText.trim())
    .filter(Boolean);

  if (tweetTexts.length > 0) {
    return tweetTexts.join("\n\n");
  }

  return article.innerText.trim();
}

function findXStatusArticle() {
  const statusId = getStatusId();
  const articles = [...document.querySelectorAll("article")];

  if (statusId) {
    const matched = articles.find((article) =>
      [...article.querySelectorAll("a[href]")].some((link) =>
        link.getAttribute("href")?.includes(`/status/${statusId}`)
      )
    );
    if (matched) return matched;
  }

  return articles
    .filter((article) => article.querySelector('[data-testid="tweetText"]'))
    .sort((a, b) => b.innerText.length - a.innerText.length)[0];
}

function extractXPostContent() {
  const isX = /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(location.hostname);
  if (!isX) return null;

  const article = findXStatusArticle();
  if (!article) return null;

  const author = getXAuthor(article);
  const publishedAt = getXPostTime(article);
  const postText = getXPostText(article);
  if (!postText) return null;

  const lines = [
    "X/Twitter 帖子内容",
    author ? `作者：${author}` : "",
    publishedAt ? `发布时间：${publishedAt}` : "",
    `链接：${location.href}`,
    "",
    postText,
  ].filter(Boolean);

  return {
    title: author ? `X 帖子 - ${author.split("\n")[0]}` : "X 帖子",
    content: cleanText(lines.join("\n"), MAX_LEGACY_CONTENT_CHARS),
    modules: [
      createContentModule({
        id: "x-post",
        label: "X/Twitter 帖子内容",
        selectorHint: "article",
        content: lines.join("\n"),
      }),
    ],
  };
}

// 提取网页正文（优先级：article > main > body）
function extractMainContent() {
  const xPost = extractXPostContent();
  if (xPost) return xPost;

  const article = document.querySelector("article");
  if (article?.innerText?.trim()) {
    return {
      title: document.title,
      content: cleanText(article.innerText, MAX_LEGACY_CONTENT_CHARS),
      modules: extractDomModules(article, "文章正文"),
    };
  }

  const main = document.querySelector("main");
  if (main?.innerText?.trim()) {
    return {
      title: document.title,
      content: cleanText(main.innerText, MAX_LEGACY_CONTENT_CHARS),
      modules: extractDomModules(main, "主内容"),
    };
  }

  return {
    title: document.title,
    content: cleanText(document.body.innerText, MAX_LEGACY_CONTENT_CHARS),
    modules: extractDomModules(document.body, "网页正文"),
  };
}

const handleRuntimeMessage = (message, _sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "getContent") {
    const selection = window.getSelection()?.toString().trim();
    const isSelection = Boolean(selection);
    const extracted = extractMainContent();
    const content = isSelection ? selection : extracted.content;
    const contentModules = isSelection
      ? [
          createContentModule({
            id: "selection",
            label: "选中文本",
            selectorHint: "window.getSelection()",
            content: selection,
          }),
          ...(extracted.modules || []).map((module) => ({ ...module, defaultChecked: false })),
        ]
      : extracted.modules || [];

    sendResponse({
      title: extracted.title || document.title,
      url: location.href,
      content,
      isSelection,
      contentModules,
    });
    return true;
  }
};

globalThis.__GEMINI_WEB_ASSISTANT_MESSAGE_HANDLER__ = handleRuntimeMessage;
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
})();
