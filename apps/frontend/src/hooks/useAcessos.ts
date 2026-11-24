import { useEffect } from "react";
import type { AcessosResponse } from "@prontuario/shared";
import { api } from "../lib/api";
import { ACESSO_EXPIRADO_EVENT } from "../lib/acesso";
import { getSession } from "../lib/session";
import { useDadosCache } from "./useDadosCache";

const POLLING_MS = 15_000;

export type EstadoAcessos =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "ok"; dados: AcessosResponse };

export function useAcessosDados(pollingMs: number) {
  const usuarioId = getSession()?.user.id;
  return useDadosCache<AcessosResponse>(usuarioId ? `${usuarioId}:acessos` : null, () => api.get<AcessosResponse>("/acessos"), {
    pollingMs,
  });
}

export function useAcessos() {
  const { dados, erro, recarregar } = useAcessosDados(POLLING_MS);

  useEffect(() => {
    const aoAtualizar = () => void recarregar();
    window.addEventListener(ACESSO_EXPIRADO_EVENT, aoAtualizar);
    return () => window.removeEventListener(ACESSO_EXPIRADO_EVENT, aoAtualizar);
  }, [recarregar]);

  const estado: EstadoAcessos = dados
    ? { situacao: "ok", dados }
    : erro
      ? { situacao: "erro", mensagem: erro.mensagem }
      : { situacao: "carregando" };

  return { estado, recarregar };
}
