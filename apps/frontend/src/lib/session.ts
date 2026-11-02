import type { SessionUser } from "@prontuario/shared";
import { db } from "../db/dexie";

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const KEY = "prontuario:session";

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

export function updateSessionUser(user: SessionUser): void {
  const atual = getSession();
  if (atual) saveSession({ ...atual, user });
}

export async function clearSession(): Promise<void> {
  localStorage.removeItem(KEY);
  try {
    await db.transaction("rw", db.prontuarios, db.syncQueue, db.planosProfessor, async () => {
      await db.prontuarios.clear();
      await db.syncQueue.clear();
      await db.planosProfessor.clear();
    });
  } catch (err) {
    console.warn("[session] falha ao limpar Dexie no logout", err);
  }
}

export function sessionExpiresAt(session: Session): number | null {
  const exps = [expDoToken(session.accessToken), expDoToken(session.refreshToken)].filter(
    (e): e is number => e !== null,
  );
  return exps.length ? Math.min(...exps) * 1000 : null;
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    const fim = sessionExpiresAt(session);
    if (fim !== null && fim < Date.now()) {
      void clearSession();
      return null;
    }
    return session;
  } catch {
    void clearSession();
    return null;
  }
}