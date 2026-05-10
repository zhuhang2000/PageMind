export function checkBetaToken(req, res, next) {
  const expectedToken = process.env.PAGEMIND_BETA_TOKEN;
  const token = req.headers["x-pagemind-beta-token"];

  if (!expectedToken || token !== expectedToken) {
    return res.status(403).json({
      ok: false,
      error: "无权访问内测接口",
    });
  }

  next();
}

export const authMiddleware = checkBetaToken;
