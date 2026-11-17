import { beforeEach, describe, expect, it, vi } from "vitest";

const lock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  syncQueue: { clear: vi.fn() },
  prontuarios: { clear: vi.fn() },
  planosProfessor: { clear: vi.fn() },
  transaction: vi.fn(),
}));

vi.mock("../localAuth", () => ({ lock, isUnlocked: vi.fn(() => false) }));
vi.mock("../../db/dexie", () => ({ db: dbMock }));

import { clearSession, getSession, saveSession, type Session } from "../session";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const SESSION = {
  accessToken: "a.b.c",
  refreshToken: "d.e.f",
  user: { id: "u1" },
} as unknown as Session;

describe("clearSession (logout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("remove a sessão/token do storage", async () => {
    saveSession(SESSION);
    expect(localStorage.getItem("prontuario:session")).not.toBeNull();
    await clearSession();
    expect(localStorage.getItem("prontuario:session")).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("chama localAuth.lock() para limpar o keyring em memória", async () => {
    await clearSession();
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("NÃO apaga syncQueue, prontuarios nem planosProfessor", async () => {
    saveSession(SESSION);
    await clearSession();
    expect(dbMock.syncQueue.clear).not.toHaveBeenCalled();
    expect(dbMock.prontuarios.clear).not.toHaveBeenCalled();
    expect(dbMock.planosProfessor.clear).not.toHaveBeenCalled();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });
});