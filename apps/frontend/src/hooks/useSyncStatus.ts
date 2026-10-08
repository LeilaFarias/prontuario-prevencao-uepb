import { useEffect, useState } from "react";
import { contarPendentes, SYNC_EVENT } from "../sync/queue";

export function useSyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      void contarPendentes().then((n) => ativo && setPendentes(n));
    };
    const aoFicarOnline = () => setOnline(true);
    const aoFicarOffline = () => setOnline(false);

    atualizar();
    window.addEventListener(SYNC_EVENT, atualizar);
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    return () => {
      ativo = false;
      window.removeEventListener(SYNC_EVENT, atualizar);
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, []);

  return { online, pendentes };
}
