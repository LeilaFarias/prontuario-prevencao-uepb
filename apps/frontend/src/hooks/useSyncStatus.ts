import { useEffect, useState } from "react";
import { contarPendentes, SYNC_EVENT, ULTIMO_SALVAMENTO_KEY } from "../sync/queue";

function lerUltimoSalvamento(): number | null {
  try {
    const bruto = localStorage.getItem(ULTIMO_SALVAMENTO_KEY);
    if (!bruto) return null;
    const n = Number(bruto);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function useSyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendentes, setPendentes] = useState(0);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<number | null>(lerUltimoSalvamento);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      setUltimoSalvamento(lerUltimoSalvamento());
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

  return { online, pendentes, ultimoSalvamento };
}
