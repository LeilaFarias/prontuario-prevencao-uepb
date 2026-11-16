import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { estaOnline, sincronizarParaBaixo, ULTIMO_SYNC_DOWN_KEY } from "../sync/down";

const DEBOUNCE_MS = 2_000;

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
    if (montado.current) startTransition(() => setSincronizando(true));
    try {
      await sincronizarParaBaixo();
      if (montado.current) startTransition(() => setUltimoSyncDown(lerUltimoSyncDown()));
    } catch (err) {
      console.warn("[syncDown] falhou:", err);
    } finally {
      _rodando = false;
      if (montado.current) startTransition(() => setSincronizando(false));
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    let agendado: number | undefined;
    const agendar = () => {
      window.clearTimeout(agendado);
      agendado = window.setTimeout(() => void executar(), DEBOUNCE_MS);
    };
    const aoFicarVisivel = () => {
      if (document.visibilityState === "visible") agendar();
    };

    void executar();
    window.addEventListener("online", agendar);
    document.addEventListener("visibilitychange", aoFicarVisivel);
    return () => {
      montado.current = false;
      window.clearTimeout(agendado);
      window.removeEventListener("online", agendar);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
    };
  }, [executar]);

  return { sincronizando, ultimoSyncDown, refetch: executar };
}
