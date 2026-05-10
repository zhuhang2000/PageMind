export function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"] || "";
    const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
    next();
}
