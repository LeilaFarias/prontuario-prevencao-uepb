import { useCallback, useEffect, useState } from "react";
import type { NotificacaoAluno } from "@prontuario/shared";
import { api } from "../lib/api";

const POLLING_MS = 30_000;

export function useNotificacoes(): { notificacoes: NotificacaoAluno[]; dispensar: (id: string) => void } {
  const [notificacoes, setNotificacoes] = useState<NotificacaoAluno[]>([]);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      if (!navigator.onLine) return;
      api
        .get<NotificacaoAluno[]>("/notificacoes")
        .then((lista) => ativo && setNotificacoes(lista))
        .catch(() => undefined);
    };
    const aoFicarVisivel = () => {
      if (document.visibilityState === "visible") atualizar();
    };

    atualizar();
    const t = window.setInterval(atualizar, POLLING_MS);
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", aoFicarVisivel);
    return () => {
      ativo = false;
      window.clearInterval(t);
      window.removeEventListener("online", atualizar);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
    };
  }, []);

  const dispensar = useCallback((id: string) => {
    setNotificacoes((atual) => atual.filter((n) => n.id !== id));
    api.post(`/notificacoes/${encodeURIComponent(id)}/lida`, {}).catch(() => undefined);
  }, []);

  return { notificacoes, dispensar };
}
