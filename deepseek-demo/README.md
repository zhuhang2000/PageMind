# DeepSeek Web Analyse Demo

独立本地 demo，用 DeepSeek API 提供网页分析接口。它不接入当前 Chrome 插件，也不依赖本地 Gemini/Codex bridge。

## 1. 配置

复制 `.env.example` 为 `.env`，填入 DeepSeek API Key：

```powershell
Copy-Item .env.example .env
notepad .env
```

至少需要：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

## 2. 启动

```powershell
node server.js
```

默认监听：

```text
http://127.0.0.1:18888
```

## 3. 测试

PowerShell 推荐用 `Invoke-RestMethod`，避免 `curl` 被解析成 `Invoke-WebRequest` 别名：

```powershell
$body = @{
  title = "测试"
  url = "http://test.com"
  content = "苹果公司发布了新款 iPhone，搭载 A18 芯片，支持 Apple Intelligence 功能。"
  instruction = "请用中文总结"
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "http://127.0.0.1:18888/deepseek-web-analyse" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

也可以显式调用真正的 curl：

```powershell
curl.exe -s -X POST http://127.0.0.1:18888/deepseek-web-analyse `
  -H "Content-Type: application/json" `
  -d '{"title":"测试","url":"http://test.com","content":"苹果公司发布了新款 iPhone，搭载 A18 芯片，支持 Apple Intelligence 功能。","instruction":"请用中文总结"}'
```

## 4. 接口

### `GET /health`

返回 demo 服务状态。

### `POST /deepseek-web-analyse`

请求体：

```json
{
  "title": "网页标题",
  "url": "https://example.com",
  "content": "网页正文",
  "instruction": "请用中文总结这个网页的核心观点",
  "model": "deepseek-v4-flash",
  "apiKey": "可选：优先级低于 x-deepseek-api-key 请求头"
}
```

响应：

```json
{
  "ok": true,
  "provider": "deepseek",
  "model": "deepseek-v4-flash",
  "summary": "总结结果",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

兼容别名：

- `POST /geminiwebanalse`
- `POST /summarize`

## 5. 说明

- 默认使用环境变量 `DEEPSEEK_API_KEY`，也支持 `x-deepseek-api-key` 请求头或请求体 `apiKey` 便于模拟“用户填写自己的 API Key”。
- `DEEPSEEK_DEMO_TOKEN` 非空时，调用方需要传入 `Authorization: Bearer <token>`。
- 这是本地测试 demo。后续如果要给插件市场用户使用，应把用户 Key 和你的托管 Key 模式拆清楚，并加上鉴权、限流、日志脱敏和隐私说明。
