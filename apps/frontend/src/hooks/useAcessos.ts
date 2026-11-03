import { useCallback, useEffect, useState } from "react";
import type { AcessosResponse } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";
import { ACESSO_EXPIRADO_EVENT } from "../lib/acesso";

const POLLING_MS = 15_000;

export type EstadoAcessos =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "ok"; dados: AcessosResponse };

export function useAcessos() {
  const [estado, setEstado] = useState<EstadoAcessos>({ situacao: "carregando" });

  const recarregar = useCallback(async () => {
    try {
      const dados = await api.get<AcessosResponse>("/acessos");
      setEstado({ situacao: "ok", dados });
    } catch (err) {
      const mensagem = err instanceof ApiError ? err.message : "Não foi possível carregar os acessos.";
      setEstado((atual) => (atual.situacao === "ok" ? atual : { situacao: "erro", mensagem }));
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const t = window.setInterval(() => void recarregar(), POLLING_MS);
    const aoAtualizar = () => void recarregar();
    window.addEventListener(ACESSO_EXPIRADO_EVENT, aoAtualizar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(ACESSO_EXPIRADO_EVENT, aoAtualizar);
    };
  }, [recarregar]);

  return { estado, recarregar };
}
