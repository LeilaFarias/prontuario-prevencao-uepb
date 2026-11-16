import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api";
import { aplicarRemoto, buscarDetalhe, estaOnline } from "../sync/down";
import { notifyChanged } from "../sync/queue";

const DEBOUNCE_ONLINE_MS = 2_000;

export function useProntuarioSync(id: string | undefined): {
  carregando: boolean;
  semConexao: boolean;
  versao: number;
  recarregar: () => Promise<void>;
} {
  const [carregando, setCarregando] = useState(Boolean(id) && estaOnline());
  const [semConexao, setSemConexao] = useState(!estaOnline());
  const [versao, setVersao] = useState(0);
  const montado = useRef(true);
  const emVoo = useRef<{ id: string; promessa: Promise<void> } | null>(null);

  const buscar = useCallback((): Promise<void> => {
    if (!id) return Promise.resolve();
    if (!estaOnline()) {
      if (montado.current) setSemConexao(true);
      return Promise.resolve();
    }
    if (emVoo.current?.id === id) return emVoo.current.promessa;

    const promessa: Promise<void> = (async () => {
      try {
        const remoto = await buscarDetalhe(id);
        const alterou = await aplicarRemoto(remoto);
        if (montado.current) {
          startTransition(() => {
            setSemConexao(false);
            if (alterou) setVersao((v) => v + 1);
          });
        }
        if (alterou) notifyChanged();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return;
        if (montado.current) setSemConexao(true);
        console.warn("[prontuarioSync] falhou:", err);
      } finally {
        if (emVoo.current?.promessa === promessa) emVoo.current = null;
      }
    })();
    emVoo.current = { id, promessa };
    return promessa;
  }, [id]);

  useEffect(() => {
    montado.current = true;
    if (id && estaOnline()) {
      setCarregando(true);
      void buscar().finally(() => {
        if (montado.current) setCarregando(false);
      });
    } else {
      setCarregando(false);
    }

    let agendado: number | undefined;
    const aoFicarOnline = () => {
      window.clearTimeout(agendado);
      agendado = window.setTimeout(() => void buscar(), DEBOUNCE_ONLINE_MS);
    };
    const aoFicarOffline = () => {
      window.clearTimeout(agendado);
      setSemConexao(true);
    };
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);

    return () => {
      montado.current = false;
      window.clearTimeout(agendado);
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, [id, buscar]);

  return { carregando, semConexao, versao, recarregar: buscar };
}
