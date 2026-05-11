export function checkBetaToken(req, res, next) {
  const inviteCodes = String(process.env.PAGEMIND_INVITE_CODES || "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const inviteCode = String(req.headers["x-pagemind-invite-code"] || "").trim();
    
  if (inviteCodes.length === 0 || !inviteCodes.includes(inviteCode)) {
    return res.status(403).json({
      ok: false,
      error: "邀请码无效或已过期",
    });
  }

  next();
}

export const authMiddleware = checkBetaToken;
