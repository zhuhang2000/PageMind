import { pageTitle, pageUrl, bridgeStatus, promptInput, loadDemoDataBtn } from "./lib/dom-refs.js";
import { setCurrentPageData } from "./features/content-modules.js";
import { loadDemoSessions } from "./features/history.js";

function repeatParagraph(text, count) {
  return Array.from({ length: count }, (_, index) => `${index + 1}. ${text}`).join("\n");
}

function createDemoPageData() {
  const releaseNotes = [
    "## 模块：产品发布说明",
    "AI 网页助手新增了会话管理、提交内容预览、复制完整上下文和 DeepSeek provider 路由。",
    "会话管理只负责组织本地问答，当前每次请求仍然是独立问题，不会自动携带上一轮问答历史。",
    "结果卡片右上角保留复制回复和复制完整上下文，提交内容区域只保留查看全文。",
  ].join("\n");

  const fakePost = [
    "## 模块：模拟 X 帖子",
    "作者：AmirMusic（@AmirMushich）",
    "发布时间：2026-05-05T18:53:28.000Z",
    "链接：https://x.com/AmirMushich/status/2051737055680397362",
    "正文：GPT Image v2 smart prompt: 2x2 presentation slides more design prompts - in my pinned Prompt GPT Image v2 智能提示。",
    "备注：页面未提供更多作者背景，不能推断其职业或真实身份。",
  ].join("\n");

  const providerNotes = [
    "## 模块：Provider 对照",
    "Gemini：适合作为原始本地 bridge 的默认 provider。",
    "DeepSeek：当前 sidepanel 请求体中使用 provider: \"deepseek\" 时，由 bridge/provider 分支调用 DeepSeek API。",
    "Codex：保留给本地 CLI 分析或开发者工作流，不作为普通网页总结默认入口。",
  ].join("\n");

  const longText = [
    "## 模块：长文本压力测试",
    repeatParagraph(
      "这一段用于模拟一两万字网页输入。它包含需求背景、验收点、隐私边界、复制上下文场景和历史回放场景，方便测试提交内容预览、查看全文抽屉、复制完整上下文以及历史搜索。",
      42
    ),
  ].join("\n");

  const modules = [
    {
      id: "demo-release-notes",
      label: "产品发布说明",
      selectorHint: "article.release-notes",
      content: releaseNotes,
      preview: releaseNotes.slice(0, 260),
      charCount: releaseNotes.length,
      defaultChecked: true,
    },
    {
      id: "demo-x-post",
      label: "模拟 X 帖子",
      selectorHint: "article[data-testid=tweet]",
      content: fakePost,
      preview: fakePost.slice(0, 260),
      charCount: fakePost.length,
      defaultChecked: true,
    },
    {
      id: "demo-provider-notes",
      label: "Provider 对照",
      selectorHint: "section.provider-routing",
      content: providerNotes,
      preview: providerNotes.slice(0, 260),
      charCount: providerNotes.length,
      defaultChecked: true,
    },
    {
      id: "demo-long-input",
      label: "长文本压力测试",
      selectorHint: "section.long-form",
      content: longText,
      preview: longText.slice(0, 260),
      charCount: longText.length,
      defaultChecked: true,
    },
  ];

  return {
    title: "Demo：AI 网页助手发布说明",
    url: "https://demo.local/ai-web-assistant/release-notes",
    content: modules.map((module) => module.content).join("\n\n"),
    contentModules: modules,
    isSelection: false,
  };
}

function createDemoMessage({ id, createdAt, question, answer, content, provider = "deepseek", contentCharCount }) {
  const contentText = String(content || "");
  return {
    id,
    createdAt,
    provider,
    question,
    answer,
    contentPreview: contentText,
    contentCharCount: Number(contentCharCount || contentText.length),
    answerCharCount: answer.length,
  };
}

function createDemoSessions(pageData = createDemoPageData()) {
  const now = Date.now();
  const fullContent = pageData.content;
  const shortContent = [
    pageData.contentModules[0].content,
    "",
    pageData.contentModules[1].content,
  ].join("\n");
  const longSavedContent = fullContent.slice(0, 3200);

  return [
    {
      id: "demo-session-main",
      title: "Demo：网页总结与后续追问",
      createdAt: now - 1000 * 60 * 40,
      updatedAt: now - 1000 * 60 * 4,
      pageTitle: pageData.title,
      pageUrl: pageData.url,
      messages: [
        createDemoMessage({
          id: "demo-message-1",
          createdAt: now - 1000 * 60 * 35,
          question: "这个页面主要讲了什么？",
          answer: "这个页面是一份 AI 网页助手的发布说明，重点介绍了会话管理、网页内容提交预览、复制完整上下文以及 DeepSeek provider 接入。它的核心变化是让用户可以在一个会话里组织多轮问答，同时每次请求仍保持独立。",
          content: shortContent,
        }),
        createDemoMessage({
          id: "demo-message-2",
          createdAt: now - 1000 * 60 * 20,
          question: "帮我提取测试验收点",
          answer: "可以重点验收四件事：顶部上下文条能显示已加入的内容模块；结果卡片能展开提交内容预览并打开全文；复制完整上下文包含网页标题、链接、网页内容、用户提问和模型回复；历史抽屉能搜索、切换会话并回放旧记录。",
          content: fullContent,
        }),
        createDemoMessage({
          id: "demo-message-3",
          createdAt: now - 1000 * 60 * 6,
          question: "如果我要复制给另一个模型，应该复制什么？",
          answer: "建议使用结果卡片右上角的“复制完整上下文”。这会把网页标题、网页链接、当时提交的网页内容、用户提问和模型回复放在同一个文本里，适合粘贴到另一个大模型继续追问。",
          content: fullContent,
        }),
      ],
    },
    {
      id: "demo-session-long",
      title: "Demo：长文本压力测试",
      createdAt: now - 1000 * 60 * 90,
      updatedAt: now - 1000 * 60 * 55,
      pageTitle: "Demo：超长网页输入",
      pageUrl: "https://demo.local/long-form",
      messages: [
        createDemoMessage({
          id: "demo-message-long-1",
          createdAt: now - 1000 * 60 * 80,
          question: "这篇长文里有哪些和隐私、安全相关的点？",
          answer: "长文主要强调三点：用户提交给模型的网页内容可以保存在本地历史中，但需要控制上限；API Key 不应该写入插件代码或前端公共环境；如果使用自有后端转发，需要配套限流、鉴权、日志脱敏和成本控制。",
          content: longSavedContent,
          contentCharCount: 28000,
        }),
      ],
    },
    {
      id: "demo-session-selection",
      title: "Demo：选中文本问答",
      createdAt: now - 1000 * 60 * 130,
      updatedAt: now - 1000 * 60 * 120,
      pageTitle: "Demo：选中文本片段",
      pageUrl: "https://demo.local/selection",
      messages: [
        createDemoMessage({
          id: "demo-message-selection-1",
          createdAt: now - 1000 * 60 * 125,
          question: "只根据这段选中文本，解释 provider 切换逻辑",
          answer: "这段文本说明 provider 字段只是前端请求体的一部分，真正调用哪家模型取决于 bridge 端是否根据 provider 分支路由。前端改成 deepseek 后，如果运行中的 bridge 仍走 gemini 分支，就需要重启或确认服务代码已加载。",
          content: "选中文本：provider: \"deepseek\" 会随请求发送到本地 bridge；bridge 需要读取 provider 并进入 DeepSeek 调用分支，否则仍会使用默认 Gemini provider。",
        }),
      ],
    },
  ];
}

export async function loadDemoData() {
  const pageData = createDemoPageData();
  const sessions = createDemoSessions(pageData);

  if (pageTitle) pageTitle.textContent = pageData.title;
  if (pageUrl) pageUrl.textContent = pageData.url;
  if (bridgeStatus) {
    bridgeStatus.className = "bridge-status online";
    bridgeStatus.title = "Demo 数据已加载";
  }
  if (promptInput) {
    promptInput.value = "继续追问这个 Demo 页面...";
    promptInput.style.height = "auto";
    promptInput.style.height = `${promptInput.scrollHeight}px`;
  }

  setCurrentPageData(pageData);
  await loadDemoSessions(sessions, "demo-session-main", { persist: false });

  if (loadDemoDataBtn) {
    const original = loadDemoDataBtn.querySelector("span")?.textContent || "加载 Demo";
    const label = loadDemoDataBtn.querySelector("span");
    if (label) label.textContent = "已加载";
    setTimeout(() => {
      if (label) label.textContent = original;
    }, 1400);
  }

  return { pageData, sessions };
}

export const __demoDataInternals = {
  createDemoPageData,
  createDemoSessions,
  createDemoMessage,
};
