const TOKEN = process.env.LOCAL_AI_TOKEN || "";

export function authMiddleware(req, res, next) {
  if (!TOKEN) return next();

  const authHeader = req.headers["authorization"] || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (provided !== TOKEN) {
    return res.status(401).json({ ok: false, error: "鉴权失败" });
  }
  next();
}
