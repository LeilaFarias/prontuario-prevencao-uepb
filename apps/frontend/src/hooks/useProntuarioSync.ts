import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api";
import { aplicarRemoto, buscarDetalhe, estaOnline } from "../sync/down";
import { notifyChanged } from "../sync/queue";

export function useProntuarioSync(id: string | undefined): {
  carregando: boolean;
  versao: number;
  recarregar: () => Promise<void>;
} {
  const [carregando, setCarregando] = useState(Boolean(id) && estaOnline());
  const [versao, setVersao] = useState(0);
  const montado = useRef(true);

  const buscar = useCallback(async () => {
    if (!id || !estaOnline()) return;
    try {
      const remoto = await buscarDetalhe(id);
      const alterou = await aplicarRemoto(remoto);
      if (alterou) {
        notifyChanged();
        if (montado.current) setVersao((v) => v + 1);
      }
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
        console.warn("[prontuarioSync] falhou:", err);
      }
    }
  }, [id]);

  useEffect(() => {
    montado.current = true;
    if (!id || !estaOnline()) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    void buscar().finally(() => {
      if (montado.current) setCarregando(false);
    });

    return () => {
      montado.current = false;
    };
  }, [id, buscar]);

  return { carregando, versao, recarregar: buscar };
}
