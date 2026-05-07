export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "内部服务器错误";

  if (statusCode >= 500) {
    console.error(`[bridge] ${req.method} ${req.path} 错误：`, message);
  }

  res.status(statusCode).json({ ok: false, error: message });
}
