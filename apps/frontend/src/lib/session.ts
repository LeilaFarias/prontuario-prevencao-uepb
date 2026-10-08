import type { SessionUser } from "@prontuario/shared";

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const KEY = "prontuario:session";

/** Lê o campo `exp` (segundos) de um JWT sem validar a assinatura. */
function expDoToken(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

/** RN-14: a sessão vale enquanto o refresh token (5h) não expirar. */
export function getSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    const exp = expDoToken(session.refreshToken);
    if (exp !== null && exp * 1000 < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}
