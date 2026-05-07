import { authMiddleware } from "../middleware/auth.js";
import { summarize } from "../services/summarize-service.js";

export default function registerSummarizeRoute(app) {
  app.post("/summarize", authMiddleware, async (req, res, next) => {
    try {
      const result = await summarize(req.body);
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  });
}
