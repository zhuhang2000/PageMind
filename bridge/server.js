import "dotenv/config";
import express from "express";
import cors from "cors";

import { checkBetaToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import registerHealthRoute from "./routes/health.js";
import registerSummarizeRoute from "./routes/summarize.js";
import registerScreenshotRoute from "./routes/screenshot.js";
import registerGoogleDocsRoute from "./routes/google-docs.js";

const PORT = process.env.LOCAL_AI_PORT;
const ALLOWED_EXTENSION_ORIGIN = process.env.ALLOWED_EXTENSION_ORIGIN;

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // 允许无 Origin 请求，比如 curl、服务端请求
      if (!origin) {
        return callback(null, true);
      }

      // 允许 Chrome 插件请求
      if (origin.startsWith("chrome-extension://")) {
        return callback(null, true);
      }

      // 允许你的正式网页/调试页面
      const allowedOrigins = [
        "https://api.openclaw-deploy.top"
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`不允许的来源: ${origin}`));
    },
  })
);

app.use(express.json({ limit: "20mb" }));

registerHealthRoute(app);
app.use(checkBetaToken);
registerSummarizeRoute(app);
registerScreenshotRoute(app);
registerGoogleDocsRoute(app);

app.use(errorHandler);

app.listen(PORT, "127.0.0.1", () => {
    console.log(`✅ Bridge 服务已启动：http://127.0.0.1:${PORT}`);
    console.log("   Provider 路由：图片/Gemini，文本 < 2000/DeepSeek，文本 >= 2000/Gemini");
});
