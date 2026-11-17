import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Dexie em memória: só o que localAuth usa (localCredentials.get/put).
const { credenciais } = vi.hoisted(() => ({ credenciais: new Map<string, any>() }));
vi.mock("../../db/dexie", () => ({
  db: {
    localCredentials: {
      get: async (userId: string) => {
        const c = credenciais.get(userId);
        return c ? { ...c } : undefined;
      },
      put: async (cred: any) => {
        credenciais.set(cred.userId, { ...cred });
      },
    },
  },
}));

import { keyring } from "../keyring";
import {
  InvalidPinError,
  LockoutError,
  NotPreparedError,
  canUnlockOffline,
  clearLockout,
  getSessaoOffline,
  lock,
  prepare,
  unlock,
} from "../localAuth";

const USER = "user-1";
const PIN = "482915";
const T0 = 1_800_000_000_000;
let agora = T0;

async function errarPin(n: number) {
  for (let i = 0; i < n; i++) await expect(unlock("000000", USER)).rejects.toBeInstanceOf(InvalidPinError);
}

/** Como errarPin, mas espera o bloqueio anterior vencer entre as tentativas (depois de 5 falhas). */
async function errarPinEsperando(n: number) {
  for (let i = 0; i < n; i++) {
    const falhas = credenciais.get(USER).failedAttempts as number;
    if (falhas >= 10) agora += 5 * 60_000 + 1;
    else if (falhas >= 5) agora += 31_000;
    await expect(unlock("000000", USER)).rejects.toBeInstanceOf(InvalidPinError);
  }
}

describe("localAuth", () => {
  beforeEach(() => {
    credenciais.clear();
    lock();
    agora = T0;
    vi.spyOn(Date, "now").mockImplementation(() => agora);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unlock com PIN correto desbloqueia o keyring e abre sessão de 8h", async () => {
    await prepare(USER, PIN);
    expect(keyring.get()).toBeNull();

    const sessao = await unlock(PIN, USER);

    expect(keyring.get()).not.toBeNull();
    expect(sessao.userId).toBe(USER);
    expect(sessao.expiraEm - sessao.iniciadaEm).toBe(8 * 60 * 60 * 1000);
    expect(getSessaoOffline()).not.toBeNull();
  }, 30_000);

  it("não guarda o PIN em texto puro", async () => {
    await prepare(USER, PIN);
    const gravado = JSON.stringify(credenciais.get(USER));
    expect(gravado).not.toContain(PIN);
    expect(credenciais.get(USER).failedAttempts).toBe(0);
    expect(credenciais.get(USER).lastFailedAt).toBeNull();
  }, 30_000);

  it("PIN errado incrementa failedAttempts e não desbloqueia", async () => {
    await prepare(USER, PIN);

    await errarPin(1);
    expect(credenciais.get(USER).failedAttempts).toBe(1);
    expect(credenciais.get(USER).lastFailedAt).toBe(T0);
    expect(keyring.get()).toBeNull();

    await errarPin(1);
    expect(credenciais.get(USER).failedAttempts).toBe(2);
  }, 30_000);

  it("PIN correto zera as falhas", async () => {
    await prepare(USER, PIN);
    await errarPin(2);
    await unlock(PIN, USER);
    expect(credenciais.get(USER).failedAttempts).toBe(0);
  }, 30_000);

  it("5 falhas bloqueiam por 30s, mesmo com o PIN correto", async () => {
    await prepare(USER, PIN);
    await errarPin(5);

    expect(await canUnlockOffline(USER)).toBe(false);
    await expect(unlock(PIN, USER)).rejects.toBeInstanceOf(LockoutError);
    expect(credenciais.get(USER).failedAttempts).toBe(5); // tentativa bloqueada não conta

    agora = T0 + 29_000;
    await expect(unlock(PIN, USER)).rejects.toBeInstanceOf(LockoutError);

    agora = T0 + 31_000;
    expect(await canUnlockOffline(USER)).toBe(true);
    await unlock(PIN, USER);
    expect(keyring.get()).not.toBeNull();
  }, 60_000);

  it("10 falhas bloqueiam por 5 min e 15 até o próximo login online", async () => {
    await prepare(USER, PIN);
    await errarPinEsperando(10);
    const ultima = credenciais.get(USER).lastFailedAt as number;

    agora = ultima + 4 * 60_000;
    await expect(unlock(PIN, USER)).rejects.toBeInstanceOf(LockoutError);
    agora = ultima + 5 * 60_000 + 1;
    expect(await canUnlockOffline(USER)).toBe(true);

    await errarPinEsperando(5); // chega a 15 falhas
    agora += 24 * 60 * 60 * 1000;
    const erro = await unlock(PIN, USER).catch((e) => e);
    expect(erro).toBeInstanceOf(LockoutError);
    expect(erro.ate).toBeNull();
    expect(await canUnlockOffline(USER)).toBe(false);

    await clearLockout(USER); // login online
    expect(await canUnlockOffline(USER)).toBe(true);
    await unlock(PIN, USER);
    expect(keyring.get()).not.toBeNull();
  }, 120_000);

  it("sem prepare() prévio, unlock falha", async () => {
    await expect(unlock(PIN, USER)).rejects.toBeInstanceOf(NotPreparedError);
    expect(await canUnlockOffline(USER)).toBe(false);
    expect(keyring.get()).toBeNull();
  });

  it("prepare não sobrescreve credencial existente (novo salt tornaria os dados ilegíveis)", async () => {
    await prepare(USER, PIN);
    const antes = JSON.stringify(credenciais.get(USER));
    await expect(prepare(USER, "999999")).rejects.toThrow();
    expect(JSON.stringify(credenciais.get(USER))).toBe(antes);
  }, 30_000);

  it("lock() limpa o keyring e encerra a sessão offline", async () => {
    await prepare(USER, PIN);
    await unlock(PIN, USER);
    expect(keyring.get()).not.toBeNull();

    lock();

    expect(keyring.get()).toBeNull();
    expect(getSessaoOffline()).toBeNull();
  }, 30_000);

  it("sessão offline expira após 8h e bloqueia o keyring", async () => {
    await prepare(USER, PIN);
    await unlock(PIN, USER);

    agora = T0 + 8 * 60 * 60 * 1000 + 1;

    expect(getSessaoOffline()).toBeNull();
    expect(keyring.get()).toBeNull();
  }, 30_000);
});
