import { useCallback } from "react";
import { api } from "../lib/api";
import { descartar, marcarObsoleto } from "../lib/cacheDados";
import { getSession } from "../lib/session";
import type { ProntuarioRemoto } from "../sync/down";
import { useDadosCache } from "./useDadosCache";

export interface ProntuarioRevisao extends ProntuarioRemoto {
  podeAgir: boolean;
  ehSupervisor: boolean;
  enviadoEm: string | null;
}

export type EstadoProntuario =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string; status: number }
  | { situacao: "ok"; prontuario: ProntuarioRevisao };

export function useProntuario(id: string | undefined) {
  const usuarioId = getSession()?.user.id;
  const { dados, erro, recarregar } = useDadosCache<ProntuarioRevisao>(
    id && usuarioId ? `${usuarioId}:prontuario:${id}` : null,
    () => api.get<ProntuarioRevisao>(`/prontuarios/${encodeURIComponent(id ?? "")}`),
    { validoPorMs: 0 },
  );

  const atualizar = useCallback(async () => {
    await recarregar();
    if (!usuarioId) return;
    descartar(`${usuarioId}:fila:`);
    marcarObsoleto(`${usuarioId}:encaminhamentos`);
    marcarObsoleto(`${usuarioId}:indicador:`);
    marcarObsoleto(`${usuarioId}:acessos`);
  }, [recarregar, usuarioId]);

  const estado: EstadoProntuario = !id
    ? { situacao: "erro", mensagem: "Prontuário não informado.", status: 404 }
    : dados
      ? { situacao: "ok", prontuario: dados }
      : erro
        ? { situacao: "erro", mensagem: erro.mensagem, status: erro.status }
        : { situacao: "carregando" };

  return { ...estado, recarregar, atualizar };
}
