import { useCallback, useEffect, useRef, useState } from "react";
import { estaOnline, sincronizarParaBaixo, ULTIMO_SYNC_DOWN_KEY } from "../sync/down";

let _rodando = false;

function lerUltimoSyncDown(): number | null {
  try {
    const n = Number(localStorage.getItem(ULTIMO_SYNC_DOWN_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function useSyncDown(): {
  sincronizando: boolean;
  ultimoSyncDown: number | null;
  refetch: () => Promise<void>;
} {
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoSyncDown, setUltimoSyncDown] = useState<number | null>(lerUltimoSyncDown);
  const montado = useRef(true);

  const executar = useCallback(async () => {
    if (_rodando || !estaOnline()) return;
    _rodando = true;
    if (montado.current) setSincronizando(true);
    try {
      await sincronizarParaBaixo();
      if (montado.current) setUltimoSyncDown(lerUltimoSyncDown());
    } catch (err) {
      console.warn("[syncDown] falhou:", err);
    } finally {
      _rodando = false;
      if (montado.current) setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    const aoFicarVisivel = () => {
      if (document.visibilityState === "visible") void executar();
    };
    const aoFicarOnline = () => void executar();

    void executar();
    window.addEventListener("online", aoFicarOnline);
    document.addEventListener("visibilitychange", aoFicarVisivel);
    return () => {
      montado.current = false;
      window.removeEventListener("online", aoFicarOnline);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
    };
  }, [executar]);

  return { sincronizando, ultimoSyncDown, refetch: executar };
}
