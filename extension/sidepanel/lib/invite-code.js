const INVITE_CODE_STORAGE_KEY = "pagemind.inviteCode.v1";

export function getInviteCode() {
  return String(localStorage.getItem(INVITE_CODE_STORAGE_KEY) || "").trim();
}

export function saveInviteCode(code) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    clearInviteCode();
    return "";
  }
  localStorage.setItem(INVITE_CODE_STORAGE_KEY, normalizedCode);
  return normalizedCode;
}

export function clearInviteCode() {
  localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
}

