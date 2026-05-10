# 项目说明

## 1. 项目概述

这是一个本地运行的 Chrome 网页助手项目，由两部分组成：

- `extension/`：Chrome Manifest V3 扩展，使用 Side Panel 展示网页内容、问题输入、图片附件、历史会话、提示词模板和 Google Docs 导出入口。
- `bridge/`：本地 Node.js/Express bridge 服务，监听 `http://127.0.0.1:17777`，负责接收扩展请求，并调用 Gemini MCP、DeepSeek API、Codex CLI、Windows 截图脚本或 Google Docs webhook。

当前代码组织目标是把职责拆清楚：

- 前端页面结构放在 `extension/sidepanel.html`。
- 前端运行入口和事件绑定放在 `extension/sidepanel/app.js`。
- 前端业务功能放在 `extension/sidepanel/features/`。
- 前端 API、状态、DOM 引用、常量、工具函数放在 `extension/sidepanel/lib/`。
- 前端样式按 token、reset、公共组件和功能样式分层放在 `extension/sidepanel/styles/`。
- 后端请求入口放在 `bridge/routes/`。
- 后端业务编排放在 `bridge/services/`。
- 后端模型 provider 适配放在 `bridge/providers/`。
- 后端通用中间件和工具函数放在 `bridge/middleware/`、`bridge/lib/`。

技术栈：

- Chrome Extension Manifest V3
- 原生 ES Modules
- 原生 DOM API
- Node.js >= 18
- Express + CORS + dotenv
- Gemini MCP / DeepSeek API / Codex CLI
- Windows PowerShell 截图辅助脚本

## 2. 目录结构总览

说明：

- `node_modules/`、真实 `.env`、运行日志、图标二进制文件不在下面展开。
- `.env.example` 是配置模板；真实 `.env` 是本地私有配置，不应提交。
- 当前项目没有数据库目录、repository/crud 目录、models 目录、schemas 目录。

```text
chrome_plugin/
├── .claude/
│   └── settings.local.json              # Claude/Codex 本地设置，建议后续明确是否纳入维护范围
├── bridge/                              # 本地 Node.js bridge 后端
│   ├── .env.example                     # bridge 环境变量模板
│   ├── google-docs-apps-script.js       # Google Apps Script webhook 示例脚本
│   ├── index.js                         # 旧版 window.postMessage Bridge 抽象，当前 Express bridge 未使用，建议后续明确职责或删除
│   ├── lib/
│   │   ├── parse-json.js                # 后端 JSON 解析工具
│   │   └── prompt-builder.js            # 后端统一 prompt 构建工具
│   ├── middleware/
│   │   ├── auth.js                      # 本地 token 鉴权中间件
│   │   └── error-handler.js             # 集中错误处理中间件
│   ├── mcp/
│   │   └── gemini-web-agent.js          # 内置 Gemini 网页分析 MCP shim
│   ├── package.json                     # bridge 依赖和启动脚本
│   ├── package-lock.json                # npm 锁文件
│   ├── providers/
│   │   ├── base.js                      # 旧版 provider 基类，当前 registry 未使用，建议后续明确职责或删除
│   │   ├── codex.js                     # Codex CLI provider
│   │   ├── deepseek.js                  # DeepSeek API provider
│   │   ├── deepseek.test.js             # DeepSeek provider 单元测试函数
│   │   ├── gemini.js                    # Gemini MCP provider
│   │   ├── openai.js                    # 旧版 OpenAI provider，当前 registry 未使用，建议后续明确职责或删除
│   │   └── registry.js                  # provider 注册表
│   ├── routes/
│   │   ├── google-docs.js               # POST /export/google-docs
│   │   ├── health.js                    # GET /health
│   │   ├── screenshot.js                # POST /screenshot/windows-snip
│   │   └── summarize.js                 # POST /summarize
│   ├── scripts/
│   │   └── capture-screenclip.ps1       # Windows 截图工具调用脚本
│   ├── server.js                        # Express app 创建、CORS、路由注册和监听
│   ├── services/
│   │   ├── google-docs-service.js       # Google Docs webhook 调用
│   │   ├── image-service.js             # 请求图片落盘和清理
│   │   ├── screenshot-service.js        # Windows 截图流程编排
│   │   └── summarize-service.js         # provider 调度和总结流程编排
│   └── start.sh                         # Unix shell 启动脚本
├── deepseek-demo/                       # 独立 DeepSeek 本地 demo，不接入 Chrome 扩展主流程
│   ├── .env.example                     # demo 环境变量模板
│   ├── README.md                        # demo 使用说明
│   └── server.js                        # demo HTTP 服务
├── extension/                           # Chrome 扩展源码
│   ├── background.js                    # 扩展安装和点击图标打开 side panel
│   ├── content-script.js                # 注入网页，提取当前网页/选中文本/内容模块
│   ├── icons/                           # Chrome 扩展图标资源
│   ├── manifest.json                    # Manifest V3 配置
│   ├── sidepanel.html                   # Side Panel 页面结构和样式/脚本入口
│   ├── sidepanel/
│   │   ├── app.js                       # Side Panel ES module 入口和事件绑定
│   │   ├── demo-data.js                 # 侧边栏 demo 数据加载
│   │   ├── features/                    # 前端业务功能模块
│   │   │   ├── content-modules.js       # 网页内容模块管理
│   │   │   ├── drawers.js               # 抽屉面板打开、关闭、拖拽、尺寸持久化
│   │   │   ├── full-content.js          # 全文查看、编辑、摘录
│   │   │   ├── google-docs-export.js    # Google Docs 导出按钮注册和调用
│   │   │   ├── history.js               # 本地会话历史管理
│   │   │   ├── images.js                # 图片上传和 Windows 截图附件
│   │   │   ├── page-bridge.js           # 与 content script 通信并构造提交内容
│   │   │   ├── prompts.js               # 提示词模板管理
│   │   │   └── results.js               # 问题、loading、错误和结果卡片渲染
│   │   ├── lib/                         # 前端通用基础层
│   │   │   ├── api.js                   # bridge API 请求封装
│   │   │   ├── constants.js             # 前端常量
│   │   │   ├── dom-refs.js              # DOM 元素引用集中导出
│   │   │   ├── state.js                 # Side Panel 运行时状态 getter/setter
│   │   │   └── text-utils.js            # 前端文本处理和 HTML 转义工具
│   │   └── styles/                      # Side Panel 样式体系
│   │       ├── actions.css              # 底部操作区和动作布局
│   │       ├── base.css                 # 图标等基础样式
│   │       ├── components/
│   │       │   ├── buttons.css          # 公共按钮样式
│   │       │   └── cards.css            # 公共卡片样式
│   │       ├── content-modules.css      # 内容模块面板样式
│   │       ├── drawer.css               # 抽屉面板样式
│   │       ├── full-content.css         # 全文查看器样式
│   │       ├── history.css              # 历史会话样式
│   │       ├── images.css               # 图片附件样式
│   │       ├── page-header.css          # 页面顶部信息区样式
│   │       ├── prompt-controls.css      # 输入框和提示词模板样式
│   │       ├── reset.css                # reset 和基础排版
│   │       ├── results.css              # 结果区样式
│   │       ├── scrollbar.css            # 滚动条样式
│   │       ├── tokens.css               # CSS 变量和设计令牌
│   │       └── utilities.css            # 通用 utility class
│   └── test-pages/
│       └── web-content-demo.html        # 手动测试网页内容提取的静态页面
├── README.md                            # 当前工程维护文档
├── start-bridge-hidden.vbs              # Windows 隐藏窗口启动 bridge
├── start-bridge.bat                     # Windows 前台启动 bridge
└── stop-bridge.bat                      # Windows 按端口停止 bridge
```

## 3. 核心目录说明

### `extension/`

Chrome 扩展前端根目录。这里包含 Manifest V3 配置、后台 service worker、content script、side panel 页面和测试页面。

职责边界：

- `manifest.json` 只描述扩展权限、入口和资源，不放业务逻辑。
- `background.js` 只处理扩展生命周期和打开侧边栏。
- `content-script.js` 运行在网页上下文中，负责提取页面内容，不调用本地 bridge。
- `sidepanel.html` 负责页面 DOM 结构和样式/模块入口，不写运行时业务流程。
- `sidepanel/` 负责 Side Panel 的前端模块化逻辑。

### `extension/sidepanel/`

Side Panel 的 ES Module 前端应用目录。

职责边界：

- `app.js` 是入口，负责导入模块、绑定点击事件、初始化功能和串联一次总结请求。
- `features/` 放业务功能模块，例如历史、图片、提示词、内容模块、全文查看、结果渲染。
- `lib/` 放基础能力，不直接承载具体业务流程。
- `styles/` 放全部 Side Panel CSS。

### `extension/sidepanel/features/`

前端业务模块目录。每个文件对应一个相对独立的功能域。

当前功能域：

- `content-modules.js`：管理从网页提取到的内容模块，控制选中、删除、重命名、全文打开。
- `drawers.js`：统一抽屉面板行为，包括打开/关闭、遮罩、固定、拖拽、尺寸持久化。
- `full-content.js`：全文内容查看、编辑、滚动位置保存、摘录文本写回内容模块。
- `google-docs-export.js`：监听结果卡片渲染事件，插入 Google Docs 导出按钮并调用 API。
- `history.js`：本地会话历史，包含迁移旧历史、保存记录、搜索、切换、复制、删除。
- `images.js`：图片上传、大小限制、预览、删除、Windows 截图附件。
- `page-bridge.js`：和 `content-script.js` 通信，获取当前网页数据并组装被选中的提交内容。
- `prompts.js`：提示词模板的读取、保存、编辑、删除、拖拽排序。
- `results.js`：结果区渲染，包括用户问题、loading、错误卡片、模型结果卡片和复制上下文。

### `extension/sidepanel/lib/`

前端基础层目录。

职责边界：

- `api.js` 只做 bridge HTTP 请求封装，业务模块不应直接散落 `fetch`。
- `constants.js` 放前端常量，例如 bridge 地址、图片限制、内容长度限制。
- `dom-refs.js` 集中获取 DOM 引用，避免各模块重复 `document.getElementById`。
- `state.js` 存放 Side Panel 运行时共享状态，统一通过 getter/setter 读写。
- `text-utils.js` 放纯文本工具函数，例如 normalize、preview、escapeHtml。

### `extension/sidepanel/styles/`

前端样式目录。当前已经按设计令牌、reset、公共组件、功能样式拆分。

加载顺序由 `sidepanel.html` 控制：

1. `tokens.css`
2. `reset.css`
3. `utilities.css`
4. `components/buttons.css`
5. `components/cards.css`
6. `base.css`
7. 各功能样式
8. `scrollbar.css`

### `bridge/`

本地 Node.js bridge 后端目录。它是 Chrome 扩展与本机模型/外部 API 之间的唯一后端入口。

职责边界：

- `server.js` 只创建 Express app、注册中间件和路由、监听端口。
- `routes/` 只接收 HTTP 请求并调用 service。
- `services/` 编排业务流程和外部 IO。
- `providers/` 适配具体模型 provider。
- `middleware/` 放 Express 中间件。
- `lib/` 放后端纯工具函数。
- `scripts/` 放系统脚本，目前只有 Windows 截图辅助脚本。

### `bridge/routes/`

后端路由层。只做请求入口、鉴权挂载、调用 service、返回 JSON。

不应该做：

- 不应该拼 prompt。
- 不应该直接调用 provider。
- 不应该写文件或清理文件。
- 不应该包含复杂业务分支。

### `bridge/services/`

后端业务逻辑层。负责把一次业务请求拆成多个步骤并编排。

当前职责：

- `summarize-service.js`：校验内容、选择 provider、保存图片、构造 prompt、调用 provider、清理临时文件。
- `image-service.js`：图片 data URL 校验、落盘、大小限制、清理。
- `screenshot-service.js`：Windows 截图任务状态、PowerShell 脚本调用、截图读取和返回。
- `google-docs-service.js`：Google Apps Script webhook 调用和敏感字段脱敏日志。

不应该做：

- 不应该注册 Express 路由。
- 不应该直接处理 `req` / `res`。
- 不应该把 provider 具体实现写在 service 内部。

### `bridge/providers/`

模型 provider 适配层。每个 provider 文件负责一种模型调用方式。

当前接入：

- `gemini.js`：通过 Gemini MCP 子进程调用 `gemini_analyse_web`，默认使用项目内置 `bridge/mcp/gemini-web-agent.js`，支持图片。
- `deepseek.js`：通过 DeepSeek OpenAI-compatible chat completions API 调用，当前不支持图片。
- `codex.js`：通过 `codex exec` 调用本地 Codex CLI，文本分析用途。
- `registry.js`：provider 注册表，集中声明 provider 名称、调用函数、prompt builder 和图片能力。

当前未接入主流程但仍存在：

- `base.js`、`openai.js` 是旧版/预留 provider 抽象，当前 `registry.js` 没有引用。后续应明确是否保留，不要在未接入前继续扩展这条旧路径。

### `deepseek-demo/`

独立 DeepSeek HTTP demo。它不接入当前 Chrome 扩展主流程，用于独立验证 DeepSeek API、用户 API Key 传入、CORS、请求体和错误处理。

如果后续 DeepSeek 已稳定集成到 `bridge/providers/deepseek.js`，应避免继续在 demo 和 bridge 中维护两套不同的业务逻辑。demo 可以保留为实验环境，但生产路径以 `bridge/` 为准。

## 4. 核心文件说明

### 前端核心文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `extension/manifest.json` | Chrome Manifest V3 配置，声明 side panel、background、content script、权限和本地 bridge host permission。 | 新增扩展权限或脚本入口时改这里；不要放业务配置。 |
| `extension/background.js` | 安装扩展时启用 side panel，点击插件图标时打开 side panel。 | 保持轻量，只处理扩展生命周期和入口行为。 |
| `extension/content-script.js` | 注入网页，响应 `getContent` 和 `ping`，提取标题、URL、选中文本、正文和内容模块。 | 内容提取规则放这里；不要在这里调用 bridge 或模型。 |
| `extension/sidepanel.html` | Side Panel 页面结构，包含所有主要 DOM 节点、抽屉面板、样式引入和 `app.js` 模块入口。 | 只维护结构和 ID；新增元素后同步 `dom-refs.js` 和样式。 |
| `extension/sidepanel/app.js` | 前端入口，集中绑定点击事件、键盘事件、初始化模块，并编排一次总结请求。 | 可以保留事件绑定和主流程；具体功能细节应放到 `features/`。 |
| `extension/sidepanel/demo-data.js` | 加载可交互的侧边栏 demo 数据和 demo 会话。 | 仅用于本地 UI 验收；不要把真实业务默认数据写这里。 |
| `extension/test-pages/web-content-demo.html` | 手动测试 content script 内容提取的页面。 | 新增网页提取场景时可以扩展此页或增加更多测试页。 |

### 前端基础层文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `extension/sidepanel/lib/api.js` | 统一封装 `/health`、`/summarize`、`/screenshot/windows-snip`、`/export/google-docs` 请求。 | 新增 bridge 接口时先在这里加方法；业务模块不要直接写散落的 `fetch`。 |
| `extension/sidepanel/lib/constants.js` | 前端常量，例如 bridge URL、内容长度、图片数量和大小限制。 | 常量变更优先放这里；不要在功能模块重复硬编码。 |
| `extension/sidepanel/lib/dom-refs.js` | 集中导出页面 DOM 引用。 | 新增 HTML ID 后在这里统一导出；避免跨文件重复查询 DOM。 |
| `extension/sidepanel/lib/state.js` | Side Panel 共享运行时状态。 | 新增跨模块状态时用 getter/setter；单模块私有状态留在该模块内。 |
| `extension/sidepanel/lib/text-utils.js` | 文本 normalize、preview 和 HTML escape。 | 只放纯函数，不依赖 DOM、不读写状态。 |

### 前端业务功能文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `extension/sidepanel/features/content-modules.js` | 网页内容模块归一化、选中状态、重命名、删除、列表渲染。 | 新增内容模块行为放这里；不要塞到 `app.js`。 |
| `extension/sidepanel/features/drawers.js` | 抽屉打开/关闭、遮罩、固定、拖拽、尺寸持久化。 | 所有抽屉通用行为放这里；功能抽屉内部内容留在各自 feature。 |
| `extension/sidepanel/features/full-content.js` | 全文视图、编辑正文、摘录片段、写回内容模块。 | 与全文编辑和摘录相关的状态/DOM 操作放这里。 |
| `extension/sidepanel/features/google-docs-export.js` | 监听结果卡片事件，追加导出按钮并调用导出 API。 | 新增结果卡片附加动作可参考此事件监听模式。 |
| `extension/sidepanel/features/history.js` | 本地会话历史，保存、迁移、搜索、切换、复制、删除。 | 历史只做本地组织；默认不要把历史自动带入下一次模型请求。 |
| `extension/sidepanel/features/images.js` | 图片上传、校验、预览、删除、调用 Windows 截图。 | 图片限制应与 `constants.js` 保持一致；新增媒体类型先明确 provider 支持。 |
| `extension/sidepanel/features/page-bridge.js` | 通过 Chrome tabs messaging 获取网页内容，并构造选中的提交文本。 | 前端与 content script 的通信都放这里。 |
| `extension/sidepanel/features/prompts.js` | 提示词模板 CRUD、拖拽排序、填入输入框。 | 提示词持久化和 UI 行为放这里；不要让 `app.js` 处理模板细节。 |
| `extension/sidepanel/features/results.js` | 用户问题、loading、错误、结果卡片、复制上下文、提交内容查看。 | 结果卡片结构变化放这里；导出等扩展动作通过自定义事件接入。 |

### 样式文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `extension/sidepanel/styles/tokens.css` | CSS 变量、颜色、阴影、圆角等设计令牌。 | 新增全局设计变量放这里。 |
| `extension/sidepanel/styles/reset.css` | box sizing、body、字体、基础表单字体继承。 | 只放全局 reset，不放组件样式。 |
| `extension/sidepanel/styles/utilities.css` | `.flex-center`、`.truncate`、gap 等小型工具类。 | 只放通用且稳定的 utility，避免变成功能样式垃圾桶。 |
| `extension/sidepanel/styles/components/buttons.css` | 公共按钮、图标按钮、mini button、floating button、send button。 | 按钮重复样式优先收敛到这里。 |
| `extension/sidepanel/styles/components/cards.css` | 公共卡片 surface、边框、圆角、阴影。 | 重复卡片外观放这里，具体布局留给功能 CSS。 |
| `extension/sidepanel/styles/base.css` | 当前主要放共享图标样式。 | 保持小而基础；不要重新放回 token/reset。 |
| `extension/sidepanel/styles/page-header.css` | 顶部页面信息区和上下文状态条样式。 | 只维护顶部区域样式。 |
| `extension/sidepanel/styles/prompt-controls.css` | 输入区、附件菜单、提示词模板和编辑器样式。 | 输入区和提示词模板专属样式放这里。 |
| `extension/sidepanel/styles/content-modules.css` | 内容模块列表、标题编辑、模块操作按钮布局。 | 内容模块相关样式放这里。 |
| `extension/sidepanel/styles/full-content.css` | 全文查看器、摘录模式、高亮和底部状态条。 | 全文编辑/摘录相关样式放这里。 |
| `extension/sidepanel/styles/images.css` | 图片附件预览、删除按钮、状态。 | 图片附件样式放这里。 |
| `extension/sidepanel/styles/actions.css` | 操作区布局。 | 只放动作区布局，不再放公共 button。 |
| `extension/sidepanel/styles/results.css` | 结果区、loading、错误、结果卡片、提交内容预览。 | 模型回复展示相关样式放这里。 |
| `extension/sidepanel/styles/history.css` | 历史抽屉、会话列表、搜索框。 | 历史相关样式放这里。 |
| `extension/sidepanel/styles/drawer.css` | 抽屉系统、遮罩、面板、header/content/footer。 | 抽屉容器行为样式放这里；按钮样式放 components。 |
| `extension/sidepanel/styles/scrollbar.css` | 滚动条样式。 | 保持全局滚动条规则集中。 |

### 后端核心文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `bridge/server.js` | 创建 Express app，设置 CORS 和 JSON limit，注册路由和错误中间件，监听端口。 | 保持瘦身；不要把业务逻辑写回这里。 |
| `bridge/package.json` | bridge npm 依赖和 `start`、`dev` 脚本。 | 新增后端依赖时在这里声明。 |
| `bridge/.env.example` | bridge 配置模板。 | 新增环境变量必须同步更新此文件。 |
| `bridge/routes/health.js` | 健康检查。 | 只返回服务状态，不做复杂检查。 |
| `bridge/routes/summarize.js` | 总结接口入口。 | 参数接收后调用 `summarize-service.js`。 |
| `bridge/routes/screenshot.js` | Windows 截图接口入口。 | 只调用 `screenshot-service.js`。 |
| `bridge/routes/google-docs.js` | Google Docs 导出接口入口。 | 只调用 `google-docs-service.js`。 |
| `bridge/services/summarize-service.js` | 总结流程编排。 | provider 分支应通过 `registry.js`，不要写 if/else 链。 |
| `bridge/services/image-service.js` | 请求图片保存到 Gemini MCP 可访问目录，并在调用后清理。 | 新增图片格式或限制在这里改。 |
| `bridge/services/screenshot-service.js` | 调用 Windows 截图 PowerShell 脚本并返回 data URL。 | 系统相关流程集中放这里。 |
| `bridge/services/google-docs-service.js` | 调用 Google Apps Script webhook 导出文档。 | webhook 请求、错误处理和脱敏日志放这里。 |
| `bridge/providers/registry.js` | provider 名称到实现的注册表。 | 新增 provider 必须在这里注册能力和图片支持。 |
| `bridge/providers/gemini.js` | Gemini MCP provider。 | Gemini-specific 调用细节留在这里，prompt 结构尽量复用 `prompt-builder.js`。 |
| `bridge/mcp/gemini-web-agent.js` | 内置 Gemini 网页分析 MCP shim。 | 只实现 sidepanel 需要的 `gemini_analyse_web`；不要把通用项目分析工具混进来。 |
| `bridge/providers/deepseek.js` | DeepSeek API provider。 | DeepSeek API payload、响应解析、错误处理放这里。 |
| `bridge/providers/codex.js` | Codex CLI provider。 | Codex CLI 调用限制和安全指令放这里。 |
| `bridge/providers/deepseek.test.js` | DeepSeek provider 测试函数。 | 后续可迁移到统一测试目录。 |
| `bridge/providers/base.js` | 旧版 provider 基类。 | 当前主流程未使用；后续应明确保留或删除。 |
| `bridge/providers/openai.js` | 旧版 OpenAI provider。 | 当前主流程未使用；未注册前不要依赖。 |
| `bridge/middleware/auth.js` | Bearer token 鉴权。 | 只做鉴权，不做业务校验。 |
| `bridge/middleware/error-handler.js` | 统一错误响应。 | service 抛出的 `statusCode` 在这里转 HTTP 状态。 |
| `bridge/lib/parse-json.js` | JSON 解析工具，支持从 stdout 中反向寻找 JSON。 | CLI/PowerShell stdout 解析复用这里。 |
| `bridge/lib/prompt-builder.js` | 统一构造网页分析 prompt 和图片段落。 | Provider prompt 去重优先在这里做。 |
| `bridge/scripts/capture-screenclip.ps1` | Windows 截图辅助脚本。 | PowerShell 细节不要散落到 JS 其他文件。 |
| `bridge/google-docs-apps-script.js` | Google Apps Script Web App 示例。 | Apps Script 端变更时同步更新此示例。 |
| `bridge/index.js` | 旧版 window message bridge 抽象。 | 当前 Express bridge 未使用；建议后续清理或明确实验用途。 |

### 工具和 demo 文件

| 文件路径 | 作用 | 后续维护建议 |
|---|---|---|
| `start-bridge.bat` | Windows 前台启动 bridge。 | 适合手动调试。 |
| `start-bridge-hidden.vbs` | Windows 后台启动 bridge，并写入 `bridge/bridge.log`。 | 如果日志路径或启动方式变更，同步更新。 |
| `stop-bridge.bat` | 按端口查找并停止 bridge 进程。 | 修改端口后同步修改脚本。 |
| `bridge/start.sh` | Unix shell 启动 bridge。 | 保持与 Windows 启动方式配置一致。 |
| `deepseek-demo/server.js` | 独立 DeepSeek demo 服务。 | 实验代码，不作为 Chrome 扩展主链路。 |
| `deepseek-demo/README.md` | DeepSeek demo 使用说明。 | demo 接口变化时同步更新。 |

## 5. 前端代码组织规范

### 页面文件负责什么

`extension/sidepanel.html` 只负责页面结构：

- DOM 节点和 ID
- 抽屉面板结构
- 样式加载顺序
- `<script type="module" src="sidepanel/app.js">`

不应该在 HTML 中写业务脚本。新增 DOM 节点后，需要同步：

- `extension/sidepanel/lib/dom-refs.js`
- 对应 `features/*.js`
- 对应 `styles/*.css`

### 前端组件和业务模块放哪里

当前项目没有独立 `components/` JS 目录。可复用 UI 目前主要以 DOM 渲染函数存在于 `features/` 内，例如 `results.js` 渲染结果卡片、`history.js` 渲染历史会话。

后续如果某类 UI 被多个 feature 复用，可以新增：

```text
extension/sidepanel/components/
```

但在新增目录前应确认复用价值，避免为了拆分而拆分。

### 点击事件和交互逻辑放哪里

当前规则：

- 顶层事件绑定放 `app.js`。
- 具体交互细节放对应 feature。

示例：

- `summarizeBtn` 点击的主流程在 `app.js`。
- 图片读取和校验在 `features/images.js`。
- 抽屉打开、关闭、拖拽在 `features/drawers.js`。
- 历史搜索、切换和删除在 `features/history.js`。

维护原则：

- `app.js` 可以知道“什么时候调用某功能”。
- `features/*.js` 应该知道“这个功能内部怎么做”。
- 不要把 feature 内部 DOM 拼装和状态变更继续堆到 `app.js`。

### API 请求放哪里

所有 bridge HTTP 请求统一放在：

```text
extension/sidepanel/lib/api.js
```

新增接口时：

1. 后端新增 `bridge/routes/*.js` 和 `bridge/services/*.js`。
2. 前端在 `lib/api.js` 新增方法。
3. feature 通过 `api.xxx()` 调用。

不要在 feature 中直接写：

```js
fetch("http://127.0.0.1:17777/...")
```

### 工具函数放哪里

纯函数放 `extension/sidepanel/lib/text-utils.js` 或新增明确命名的工具文件。

适合放工具函数的逻辑：

- 字符串 normalize
- 文本预览截断
- HTML 转义
- 不依赖 DOM、不读写状态、不调用 API 的格式化逻辑

不适合放工具函数的逻辑：

- 需要读写 `state.js` 的流程
- 需要操作 DOM 的渲染逻辑
- 需要调用 bridge 的业务逻辑

### 样式文件放哪里

- 全局变量：`styles/tokens.css`
- reset：`styles/reset.css`
- 通用小工具类：`styles/utilities.css`
- 公共按钮：`styles/components/buttons.css`
- 公共卡片：`styles/components/cards.css`
- 功能专属样式：对应 `styles/*.css`

新增样式时先判断它是“公共组件样式”还是“功能专属样式”。

### 如何避免页面文件越来越臃肿

- HTML 只放结构。
- `app.js` 只放入口、事件绑定和跨 feature 主流程。
- 业务渲染函数放对应 feature。
- API 请求统一进 `lib/api.js`。
- 常量进 `lib/constants.js`。
- 状态进 `lib/state.js`。
- 重复样式进 `styles/components/` 或 `styles/utilities.css`。

## 6. 后端代码组织规范

推荐分层：

```text
route -> service -> provider/external integration
```

当前项目没有数据库。如果未来增加数据库，推荐扩展为：

```text
route -> service -> repository/crud -> model/database
```

### routes 层

目录：

```text
bridge/routes/
```

应该做：

- 定义 HTTP 方法和路径。
- 挂载 `authMiddleware`。
- 调用 service。
- 将 service 返回值包装成 JSON。
- 把错误交给 `next(err)`。

不应该做：

- 不拼 prompt。
- 不直接调用 provider。
- 不写文件。
- 不访问数据库。
- 不处理复杂业务分支。

### services 层

目录：

```text
bridge/services/
```

应该做：

- 校验业务条件。
- 编排多个步骤。
- 调用 provider、脚本、webhook 或文件服务。
- 负责清理临时资源。
- 抛出带 `statusCode` 的业务错误。

不应该做：

- 不直接接触 Express `req` / `res`。
- 不注册路由。
- 不把 provider 具体 API payload 细节写在 service 中。

### providers 层

目录：

```text
bridge/providers/
```

应该做：

- 适配具体模型调用方式。
- 处理 provider 自己的 payload、认证、超时和响应解析。
- 暴露 `runXxx()` 和 `buildXxxPrompt()`。
- 在 `registry.js` 中声明是否支持图片。

不应该做：

- 不处理 HTTP 路由。
- 不读写前端状态。
- 不负责请求图片落盘和清理。

### middleware 层

目录：

```text
bridge/middleware/
```

应该做：

- 鉴权。
- 统一错误响应。
- 后续可加入日志、限流、请求 ID 等横切能力。

不应该做：

- 不放业务流程。
- 不调用模型 provider。

### lib 层

目录：

```text
bridge/lib/
```

应该做：

- 放无状态通用工具函数。
- 当前包括 JSON 解析和 prompt builder。

不应该做：

- 不依赖 Express。
- 不写业务流程。
- 不持久化数据。

### 数据库、repository、models、schemas

当前项目没有这些目录。

当前持久化方式：

- 前端提示词和历史：`chrome.storage.local`，浏览器不可用时有 `localStorage` fallback。
- 抽屉布局：`localStorage`。
- 后端图片和截图：临时文件，处理后清理。
- Google Docs：外部 Google Apps Script 创建文档。

如果未来加入数据库，建议新增：

```text
bridge/repositories/   # 数据读写，不放业务流程
bridge/models/         # 数据模型定义
bridge/schemas/        # 请求/响应 schema 或验证规则
```

分层规则：

- route 不直接访问数据库。
- service 不拼 SQL 或直接操作底层连接。
- repository/crud 只做数据读写，不做 provider 调用。
- model/database 只描述结构和连接，不承载业务判断。

## 7. 样式管理规范

### 全局变量

放在：

```text
extension/sidepanel/styles/tokens.css
```

包括：

- 品牌色
- 文本色
- 背景色
- 阴影
- 圆角
- 玻璃态背景

不要在功能 CSS 中重复定义同义变量。

### 公共组件样式

放在：

```text
extension/sidepanel/styles/components/
```

当前公共组件：

- `buttons.css`：按钮、mini button、icon button、floating button、send button。
- `cards.css`：输入卡片、结果卡片、历史卡片、内容模块卡片等公共 surface。

如果未来新增表单、弹窗、表格等公共样式，可以在 `components/` 下新增：

```text
forms.css
modals.css
tables.css
badges.css
```

新增前先检查现有功能样式中是否已有类似规则，避免重复 CSS。

### 页面和功能专属样式

功能专属样式继续放在 `styles/*.css`：

- 顶部区域：`page-header.css`
- 输入和提示词：`prompt-controls.css`
- 内容模块：`content-modules.css`
- 全文查看：`full-content.css`
- 图片附件：`images.css`
- 结果区：`results.css`
- 历史：`history.css`
- 抽屉容器：`drawer.css`

规则：

- 布局只服务某个 feature 时，放对应功能 CSS。
- 多个 feature 重复使用时，抽到 `components/` 或 `utilities.css`。
- 不要把所有按钮、卡片样式重新写回功能 CSS。

### 样式加载顺序

`sidepanel.html` 中的顺序很重要：

```text
tokens -> reset -> utilities -> components -> base -> feature css -> scrollbar
```

后续新增样式时保持这个顺序，避免公共样式被过早覆盖或变量未定义。

## 8. 新增功能开发指南

### 新增一个 Side Panel 功能

例如新增“收藏结果”：

1. 在 `sidepanel.html` 增加必要 DOM。
2. 在 `lib/dom-refs.js` 导出新增 DOM 引用。
3. 新建 `features/favorites.js`，放收藏相关渲染、状态处理和持久化。
4. 在 `app.js` 导入 feature，并绑定入口点击事件。
5. 在 `styles/` 新增 `favorites.css`，或复用已有 `components/cards.css`、`components/buttons.css`。
6. 在 `sidepanel.html` 按样式加载顺序引入 CSS。

不要直接把收藏逻辑写进 `results.js`，除非它只是结果卡片内部的一个小动作。

### 新增一个 bridge 接口

例如新增 `POST /export/markdown`：

1. 新建 `bridge/routes/markdown-export.js`。
2. 新建 `bridge/services/markdown-export-service.js`。
3. 在 `bridge/server.js` 注册 route。
4. 在 `extension/sidepanel/lib/api.js` 新增 `exportMarkdown()`。
5. 在对应 feature 中调用 `api.exportMarkdown()`。

如果接口需要模型调用：

- 新增 provider 能力放 `bridge/providers/`。
- Provider 注册放 `bridge/providers/registry.js`。
- prompt 结构优先复用 `bridge/lib/prompt-builder.js`。

### 新增一个 provider

例如新增 `openai`：

1. 新建或重写 `bridge/providers/openai.js`，实现 `runOpenAI()` 和 `buildOpenAIPrompt()`。
2. 如果 prompt 结构和网页分析一致，复用 `bridge/lib/prompt-builder.js`。
3. 在 `bridge/providers/registry.js` 注册：

```js
["openai", { run: runOpenAI, buildPrompt: buildOpenAIPrompt, supportsImages: false }]
```

4. 如果支持图片，明确图片输入格式，并更新 `summarize-service.js` 或 `image-service.js`。
5. 在前端选择 provider 的 UI 尚未抽象前，不要只改后端注册表就认为用户可切换。

### 新增一个公共组件样式

例如新增公共 badge：

1. 新建 `extension/sidepanel/styles/components/badges.css`。
2. 在 `sidepanel.html` 的 components 样式区域引入。
3. 从功能 CSS 中移除重复 badge 规则。
4. 保持功能 CSS 只描述具体布局和状态。

### 新增一个工具函数

判断规则：

- 文本、数字、格式化纯函数：放 `lib/text-utils.js` 或新建 `lib/xxx-utils.js`。
- 后端 JSON、prompt、路径等纯函数：放 `bridge/lib/`。
- 涉及 DOM 的函数：不要放 utils，放对应 feature。
- 涉及 API 的函数：不要放 utils，放 `lib/api.js` 或 service/provider。

### 新增数据库能力

当前没有数据库。若后续需要保存远端历史、用户配置或团队共享数据，建议新增：

```text
bridge/models/
bridge/repositories/
bridge/schemas/
```

并遵守：

```text
route -> service -> repository -> model/database
```

不要让 route 或 provider 直接访问数据库。

## 9. 重构与维护原则

1. 单一职责：一个文件只负责一个清晰领域。
2. 页面与逻辑分离：HTML 只放结构，业务逻辑放 ES module。
3. 入口与功能分离：`app.js` 负责串联，feature 负责细节。
4. 接口请求统一封装：前端请求必须经过 `lib/api.js`。
5. 状态集中管理：跨模块状态通过 `lib/state.js`。
6. DOM 引用集中管理：新增 ID 后同步 `lib/dom-refs.js`。
7. 重复逻辑抽象复用：文本工具放 `text-utils.js`，prompt 构建放 `prompt-builder.js`。
8. 样式统一管理：公共按钮/卡片不在功能 CSS 中重复写。
9. 后端分层清晰：route、service、provider、middleware、lib 不互相越界。
10. 修改影响范围可控：优先小步修改和验证，不做无关大重构。
11. 保持运行路径单一：Chrome 扩展主流程以 `extension/` + `bridge/` 为准，`deepseek-demo/` 只作为实验 demo。
12. 处理 provider 差异：不要假设每个 provider 都支持图片、同样的超时或同样的 API key 方式。
13. 本地敏感配置不进代码：API key、token、webhook secret 只放 `.env`。
14. Windows 脚本细节集中：截图相关 PowerShell 细节只放 `bridge/scripts/` 和 `screenshot-service.js`。

## 10. 后续可扩展方向

### 前端

- 增加 `extension/sidepanel/components/`，把跨 feature 复用的 DOM 组件从 feature 中进一步拆出。
- 将 `app.js` 中的事件绑定拆成更小的 `initXxxEvents()`，避免入口继续增长。
- Provider 由 bridge 根据实际输入自动分流：包含图片走 Gemini，纯文本少于 2000 字走 DeepSeek，纯文本大于等于 2000 字走 Gemini；前端不应硬编码 provider。
- 为 Side Panel 增加浏览器环境下的测试策略，替代旧的 `vm.runInContext()` 测试方式。
- 将结果卡片附加动作形成插件式注册机制，Google Docs 导出已经是一个可参考模式。

### 后端

- 清理或正式接入 `bridge/providers/base.js`、`bridge/providers/openai.js`、`bridge/index.js` 这些当前主流程未使用的旧文件。
- 给 `deepseek.test.js` 配置正式测试脚本，例如 `npm test`。
- 如果 provider 继续增加，可以把 provider 配置、能力声明和环境变量校验进一步集中。
- 增加请求日志、请求 ID、限流和更细的错误分类。
- 如需远端持久化，再引入 `repositories/`、`models/`、`schemas/`，不要提前创建空目录。

### 样式

- 继续从功能 CSS 中抽出重复 badge、form、menu 样式。
- 明确组件样式命名规则，减少隐式覆盖。
- 为移动宽度和窄侧边栏补充视觉回归检查。

### 文档和规范

- 增加 `docs/` 或 `AGENTS.md`，记录开发流程、验证命令、provider 接入步骤。
- 增加接口文档，描述 `/summarize`、`/screenshot/windows-snip`、`/export/google-docs` 的请求/响应结构。
- 增加手动验收清单，覆盖总结、历史、提示词、图片、截图、Google Docs 导出。

## 快速启动

### 启动 bridge

Windows 前台启动：

```bat
start-bridge.bat
```

或手动启动：

```bash
cd bridge
npm install
node server.js
```

默认地址：

```text
http://127.0.0.1:17777
```

健康检查：

```text
GET http://127.0.0.1:17777/health
```

### 加载 Chrome 扩展

1. 打开 `chrome://extensions/`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择 `extension/` 目录。
5. 点击扩展图标打开 Side Panel。

### 配置 provider

复制配置模板：

```bash
cd bridge
cp .env.example .env
```

常用配置：

```env
LOCAL_AI_PORT=17777
DEEPSEEK_API_KEY=
GOOGLE_DOCS_WEBHOOK_URL=
GOOGLE_DOCS_WEBHOOK_SECRET=
```

注意：当前主流程由 `bridge/services/summarize-service.js` 根据提交内容自动选择 provider。前端不传 `provider` 字段，避免覆盖后端分流逻辑。
