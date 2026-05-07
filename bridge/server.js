import "dotenv/config";
import express from "express";
import cors from "cors";

import { errorHandler } from "./middleware/error-handler.js";
import registerHealthRoute from "./routes/health.js";
import registerSummarizeRoute from "./routes/summarize.js";
import registerScreenshotRoute from "./routes/screenshot.js";
import registerGoogleDocsRoute from "./routes/google-docs.js";

const PORT = parseInt(process.env.LOCAL_AI_PORT || "17777", 10);
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || "gemini";
const TOKEN = process.env.LOCAL_AI_TOKEN || "";
const ALLOWED_EXTENSION_ORIGIN = process.env.ALLOWED_EXTENSION_ORIGIN || "";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === ALLOWED_EXTENSION_ORIGIN) {
        callback(null, true);
      } else {
        callback(new Error("不允许的来源"));
      }
    },
  })
);

app.use(express.json({ limit: "20mb" }));

registerHealthRoute(app);
registerSummarizeRoute(app);
registerScreenshotRoute(app);
registerGoogleDocsRoute(app);

app.use(errorHandler);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Bridge 服务已启动：http://127.0.0.1:${PORT}`);
  console.log(`   Provider 默认：${DEFAULT_PROVIDER}`);
  console.log(`   Token 鉴权：${TOKEN ? "已启用" : "未启用（开发模式）"}`);
});
