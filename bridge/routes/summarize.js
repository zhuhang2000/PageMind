import { summarize } from "../services/summarize-service.js";

export default function registerSummarizeRoute(app) {
  app.post("/summarize", async (req, res, next) => {
    try {
      const result = await summarize(req.body, { requestMeta: buildRequestMeta(req) });
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  });
}

function buildRequestMeta(req) {
  const body = req.body || {};
  const images = Array.isArray(body.images) ? body.images : [];

  return {
    requestId: req.id || req.headers["x-request-id"] || createRequestId(),
    ip: getClientIp(req),
    method: req.method,
    url: req.originalUrl || req.url || "",
    route: "/summarize",
    origin: req.headers.origin || "",
    referer: req.headers.referer || req.headers.referrer || "",
    userAgent: req.headers["user-agent"] || "",
    host: req.headers.host || "",
    contentType: req.headers["content-type"] || "",
    contentLength: req.headers["content-length"] || "",
    body: {
      contentChars: String(body.content || "").length,
      instructionChars: String(body.instruction || "").length,
      imageCount: images.length,
      images: images.map((image) => ({
        name: image?.name || "",
        type: image?.type || "",
        size: Number(image?.size || 0),
      })),
    },
  };
}

function createRequestId() {
  return `summarize-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIp(req) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return cfIp;

  const realIp = req.headers["x-real-ip"];
  if (realIp) return realIp;

  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return req.socket?.remoteAddress || req.ip || "";
}
