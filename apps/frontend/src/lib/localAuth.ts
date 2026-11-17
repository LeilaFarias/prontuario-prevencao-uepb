import { db, type LocalCredential } from "../db/dexie";
import { SALT_BYTES, constantTimeEqual, deriveKey, pbkdf2Hash, fromBase64, randomBytes, toBase64 } from "./crypto";
import { keyring } from "./keyring";

export const SESSAO_OFFLINE_TTL_MS = 8 * 60 * 60 * 1000;
export const PIN_TAMANHO_MINIMO = 4;

const LIMITES = [
  { falhas: 15, bloqueioMs: null },
  { falhas: 10, bloqueioMs: 5 * 60 * 1000 },
  { falhas: 5, bloqueioMs: 30 * 1000 },
] as const;

const enc = new TextEncoder();
const segredoDoHash = (pin: string) => enc.encode(`prontuario:pin-hash:v1:${pin}`);
const segredoDaChave = (pin: string) => enc.encode(`prontuario:data-key:v1:${pin}`);

export interface SessaoOffline {
  userId: string;
  iniciadaEm: number;
  expiraEm: number;
}

export class NotPreparedError extends Error {
  constructor() {
    super("PIN offline não configurado para este usuário.");
    this.name = "NotPreparedError";
  }
}

export class CredentialExistsError extends Error {
  constructor() {
    super("Já existe PIN offline para este usuário.");
    this.name = "CredentialExistsError";
  }
}

export class InvalidPinError extends Error {
  constructor(public tentativasFalhas: number) {
    super("PIN incorreto.");
    this.name = "InvalidPinError";
  }
}

export class LockoutError extends Error {
  constructor(public ate: number | null) {
    super(ate === null ? "Acesso offline bloqueado. Faça login online." : "Muitas tentativas. Aguarde para tentar de novo.");
    this.name = "LockoutError";
  }
}

let sessaoOffline: SessaoOffline | null = null;

export interface EstadoBloqueio {
  bloqueado: boolean;
  ate: number | null;
}

export function estadoBloqueio(cred: Pick<LocalCredential, "failedAttempts" | "lastFailedAt">, agora: number): EstadoBloqueio {
  const limite = LIMITES.find((l) => cred.failedAttempts >= l.falhas);
  if (!limite) return { bloqueado: false, ate: null };
  if (limite.bloqueioMs === null) return { bloqueado: true, ate: null };
  const ate = (cred.lastFailedAt ?? 0) + limite.bloqueioMs;
  return agora < ate ? { bloqueado: true, ate } : { bloqueado: false, ate: null };
}

export async function prepare(userId: string, pin: string, opcoes: { substituir?: boolean } = {}): Promise<void> {
  if (typeof pin !== "string" || pin.length < PIN_TAMANHO_MINIMO) {
    throw new Error(`O PIN precisa ter pelo menos ${PIN_TAMANHO_MINIMO} caracteres.`);
  }
  if (!opcoes.substituir && (await db.localCredentials.get(userId))) throw new CredentialExistsError();
  const salt = randomBytes(SALT_BYTES);
  await db.localCredentials.put({
    userId,
    pinHash: await pbkdf2Hash(segredoDoHash(pin), salt),
    salt: toBase64(salt),
    failedAttempts: 0,
    lastFailedAt: null,
  });
}

export async function canUnlockOffline(userId: string): Promise<boolean> {
  const cred = await db.localCredentials.get(userId);
  if (!cred) return false;
  return !estadoBloqueio(cred, Date.now()).bloqueado;
}

export async function unlock(pin: string, userId: string): Promise<SessaoOffline> {
  const cred = await db.localCredentials.get(userId);
  if (!cred) throw new NotPreparedError();

  const bloqueio = estadoBloqueio(cred, Date.now());
  if (bloqueio.bloqueado) throw new LockoutError(bloqueio.ate);

  const salt = fromBase64(cred.salt);
  const hash = await pbkdf2Hash(segredoDoHash(pin), salt);
  if (!constantTimeEqual(hash, cred.pinHash)) {
    const falhas = cred.failedAttempts + 1;
    await db.localCredentials.put({ ...cred, failedAttempts: falhas, lastFailedAt: Date.now() });
    throw new InvalidPinError(falhas);
  }

  keyring.set(await deriveKey(segredoDaChave(pin), salt));
  await db.localCredentials.put({ ...cred, failedAttempts: 0, lastFailedAt: null });

  const agora = Date.now();
  sessaoOffline = { userId, iniciadaEm: agora, expiraEm: agora + SESSAO_OFFLINE_TTL_MS };
  return sessaoOffline;
}

export function lock(): void {
  keyring.clear();
  sessaoOffline = null;
}

export function getSessaoOffline(): SessaoOffline | null {
  if (sessaoOffline && Date.now() >= sessaoOffline.expiraEm) lock();
  return sessaoOffline;
}

export function isUnlocked(): boolean {
  return getSessaoOffline() !== null && keyring.get() !== null;
}

export async function clearLockout(userId: string): Promise<void> {
  const cred = await db.localCredentials.get(userId);
  if (cred && (cred.failedAttempts !== 0 || cred.lastFailedAt !== null)) {
    await db.localCredentials.put({ ...cred, failedAttempts: 0, lastFailedAt: null });
  }
}
