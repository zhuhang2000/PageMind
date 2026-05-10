import { exportToGoogleDocs } from "../services/google-docs-service.js";

export default function registerGoogleDocsRoute(app) {
  app.post("/export/google-docs", async (req, res, next) => {
    try {
      const result = await exportToGoogleDocs(req.body);
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  });
}
