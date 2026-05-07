import { authMiddleware } from "../middleware/auth.js";
import { captureWindowsSnip } from "../services/screenshot-service.js";

export default function registerScreenshotRoute(app) {
  app.post("/screenshot/windows-snip", authMiddleware, async (req, res, next) => {
    try {
      const image = await captureWindowsSnip();
      res.json({ ok: true, image });
    } catch (err) {
      next(err);
    }
  });
}
