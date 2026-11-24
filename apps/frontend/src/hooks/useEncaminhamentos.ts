import { useMemo } from "react";
import type { Encaminhamento } from "@prontuario/shared";
import { api } from "../lib/api";
import { getSession } from "../lib/session";
import { useDadosCache } from "./useDadosCache";

export type FiltroEncaminhamentos = "semestre" | "todos";

const VALIDO_POR_MS = 30_000;

function noSemestreAtual(iso: string, agora: Date): boolean {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  return data.getFullYear() === agora.getFullYear() && Math.floor(data.getMonth() / 6) === Math.floor(agora.getMonth() / 6);
}

export function useEncaminhamentos(filtro: FiltroEncaminhamentos) {
  const usuarioId = getSession()?.user.id;
  const { dados, erro, carregando, recarregar } = useDadosCache<Encaminhamento[]>(
    usuarioId ? `${usuarioId}:encaminhamentos` : null,
    () => api.get<Encaminhamento[]>("/encaminhamentos"),
    { validoPorMs: VALIDO_POR_MS },
  );

  const encaminhamentos = useMemo(() => {
    const todos = dados ?? [];
    const agora = new Date();
    return filtro === "semestre" ? todos.filter((e) => noSemestreAtual(e.encaminhamentoEm, agora)) : todos;
  }, [dados, filtro]);

  return { encaminhamentos, carregando, erro: dados ? null : (erro?.mensagem ?? null), recarregar };
}
