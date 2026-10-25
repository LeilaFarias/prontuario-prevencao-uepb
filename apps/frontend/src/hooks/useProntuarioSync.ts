import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { aplicarRemoto, buscarDetalhe, estaOnline } from "../sync/down";
import { notifyChanged } from "../sync/queue";

export function useProntuarioSync(id: string | undefined): { carregando: boolean; versao: number } {
  const [carregando, setCarregando] = useState(Boolean(id) && estaOnline());
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!id || !estaOnline()) {
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);

    void (async () => {
      try {
        const remoto = await buscarDetalhe(id);
        const alterou = await aplicarRemoto(remoto);
        if (alterou) {
          notifyChanged();
          if (ativo) setVersao((v) => v + 1);
        }
      } catch (err) {
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
          console.warn("[prontuarioSync] falhou:", err);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [id]);

  return { carregando, versao };
}
