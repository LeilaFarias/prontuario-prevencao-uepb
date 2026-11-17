import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "../hooks/useSession";
import { canUnlockOffline } from "../lib/localAuth";
import { getSession } from "../lib/session";
import { PinSetup } from "./PinSetup";
import { PinUnlock } from "./PinUnlock";

interface PinGateProps {
  children: ReactNode;
}

export function PinGate({ children }: PinGateProps) {
  const { user, isUnlocked, needsPin, unlockOffline, prepareOffline } = useSession();
  const userId = getSession() ? (user?.id ?? null) : null;
  const [pode, setPode] = useState<{ userId: string; valor: boolean } | null>(null);

  useEffect(() => {
    if (!userId || isUnlocked) return;
    let cancelado = false;
    canUnlockOffline(userId)
      .then((valor) => !cancelado && setPode({ userId, valor }))
      .catch(() => !cancelado && setPode({ userId, valor: true }));
    return () => {
      cancelado = true;
    };
  }, [userId, isUnlocked, needsPin]);

  if (!userId || isUnlocked) return <>{children}</>;
  if (pode?.userId !== userId) return null;
  if (needsPin && !pode.valor) return <PinSetup onPrepare={prepareOffline} />;
  return <PinUnlock onUnlock={unlockOffline} />;
}