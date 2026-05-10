import "dotenv/config";
import express from "express";
import cors from "cors";

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
    console.log("   Provider 路由：图片/Gemini，文本 < 2000/DeepSeek，文本 >= 2000/Gemini");
});
