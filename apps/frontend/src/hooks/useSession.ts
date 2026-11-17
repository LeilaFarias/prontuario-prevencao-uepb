import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@prontuario/shared";
import { migrarLegado } from "../db/dexie";
import { EVENTO_SESSION_NEEDS_PIN } from "../lib/api";
import { getSession } from "../lib/session";
import * as localAuth from "../lib/localAuth";

function migrarEmSegundoPlano(): void {
  migrarLegado().catch((err) => console.error("[useSession] migração de legado falhou", err instanceof Error ? err.name : err));
}


export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(() => getSession()?.user ?? null);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => localAuth.isUnlocked());
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    const precisaPin = () => {
      setUser(getSession()?.user ?? null);
      setNeedsPin(true);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener(EVENTO_SESSION_NEEDS_PIN, precisaPin);
    // O TTL de 8 h vence sem evento; reavalia periodicamente.
    const timer = window.setInterval(() => setIsUnlocked(localAuth.isUnlocked()), 15_000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener(EVENTO_SESSION_NEEDS_PIN, precisaPin);
      window.clearInterval(timer);
    };
  }, []);

  const unlockOffline = useCallback(
    async (pin: string) => {
      if (!user) throw new Error("Sem usuário na sessão.");
      await localAuth.unlock(pin, user.id);
      setIsUnlocked(true);
      migrarEmSegundoPlano();
    },
    [user],
  );

  const lock = useCallback(() => {
    localAuth.lock();
    setIsUnlocked(false);
  }, []);

  const prepareOffline = useCallback(
    async (pin: string) => {
      if (!user) throw new Error("Sem usuário na sessão.");
      await localAuth.prepare(user.id, pin);
      await localAuth.unlock(pin, user.id);
      setNeedsPin(false);
      setIsUnlocked(true);
      migrarEmSegundoPlano();
    },
    [user],
  );

  return { user, isOnline, isUnlocked, needsPin, unlockOffline, lock, prepareOffline };
}
