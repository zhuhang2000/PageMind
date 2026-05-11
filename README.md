# PageMind

<p align="center">
  <img src="extension/icons/pagemind-icon.svg" alt="PageMind icon" width="120" height="120">
</p>

PageMind 是一个本地优先的 Chrome 网页助手。它通过 Chrome Side Panel 读取当前网页内容，支持网页总结、针对页面提问、图片/文件附件分析、提示词模板、本地历史会话，以及导出到 Google Docs。

项目由 Chrome 扩展前端和本地 Node.js bridge 两部分组成：扩展负责页面交互与内容采集，bridge 负责把请求转发给本地或远程 AI provider，例如 Gemini MCP、DeepSeek API 和 Codex CLI。

## 功能概览

- 网页内容提取：从当前标签页读取标题、URL、正文模块和选中文本。
- 侧边栏问答：在 Chrome Side Panel 中围绕当前网页提问和总结。
- 多模态附件：支持图片、文件和 Windows 截图工具框选后自动附加。
- 提示词模板：保存常用提示词，快速复用分析流程。
- 本地历史：按会话保存问答记录，便于回看和复制。
- Provider 调度：通过本地 bridge 统一接入 Gemini MCP、DeepSeek API、Codex CLI。
- Google Docs 导出：可将结果通过 Apps Script webhook 导出到 Google Docs。

## 项目结构

```text
chrome_plugin/
├── extension/                 # Chrome Manifest V3 扩展源码
│   ├── manifest.json           # 扩展配置
│   ├── background.js           # 扩展生命周期和 Side Panel 打开逻辑
│   ├── content-script.js       # 网页内容提取脚本
│   ├── sidepanel.html          # Side Panel 页面入口
│   └── sidepanel/              # 前端模块、功能和样式
├── bridge/                     # 本地 Node.js/Express bridge
│   ├── server.js               # 服务入口
│   ├── routes/                 # HTTP 路由
│   ├── services/               # 业务编排
│   ├── providers/              # AI provider 适配
│   └── .env.example            # 环境变量模板
├── deepseek-demo/              # 独立 DeepSeek demo，不属于主扩展流程
├── Project.md                  # 详细维护文档和目录说明
├── start-bridge.bat            # Windows 前台启动 bridge
├── start-bridge-hidden.vbs     # Windows 隐藏窗口启动 bridge
└── stop-bridge.bat             # Windows 停止 bridge
```

## 快速启动

### 1. 配置 bridge

```bash
cd bridge
npm install
copy .env.example .env
```

按需修改 `bridge/.env`：

```env
LOCAL_AI_PORT=17777
GEMINI_CMD=gemini
DEEPSEEK_API_KEY=
CODEX_CMD=codex
GOOGLE_DOCS_WEBHOOK_URL=
GOOGLE_DOCS_WEBHOOK_SECRET=
```

### 2. 启动本地服务

在项目根目录双击或运行：

```bash
start-bridge.bat
```

也可以在 `bridge/` 目录下直接运行：

```bash
npm start
```

服务默认监听：

```text
http://127.0.0.1:17777
```

### 3. 加载 Chrome 扩展

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择本项目的 `extension/` 目录。
5. 点击浏览器工具栏里的 PageMind 图标打开 Side Panel。

## 常用开发命令

```bash
cd bridge
npm run dev
```

```bash
cd bridge
npm start
```

```bash
stop-bridge.bat
```

## 配置说明

- `LOCAL_AI_PORT`：本地 bridge 端口，默认 `17777`。
- `GEMINI_CMD`：Gemini CLI 命令名或完整路径。
- `DEEPSEEK_API_KEY`：DeepSeek provider 所需 API Key。
- `CODEX_CMD`：Codex CLI 命令名或完整路径。
- `GOOGLE_DOCS_WEBHOOK_URL`：Google Docs 导出用 Apps Script Web App URL。
- `GOOGLE_DOCS_WEBHOOK_SECRET`：Google Docs webhook 鉴权密钥。

真实 `.env` 只保存在本地，不应提交到仓库。

## 文档

- 项目介绍和快速启动：`README.md`
- 详细目录、职责边界和维护说明：`Project.md`
- 独立 DeepSeek demo 说明：`deepseek-demo/README.md`

## 运行要求

- Windows 10/11
- Chrome 或 Chromium 内核浏览器
- Node.js 18+
- npm
- 可选：Gemini CLI、Codex CLI、DeepSeek API Key、Google Apps Script webhook
