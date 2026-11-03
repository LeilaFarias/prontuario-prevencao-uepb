import { useCallback, useEffect, useState } from "react";
import type { Encaminhamento } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";

export type FiltroEncaminhamentos = "semestre" | "todos";

function noSemestreAtual(iso: string, agora: Date): boolean {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  return data.getFullYear() === agora.getFullYear() && Math.floor(data.getMonth() / 6) === Math.floor(agora.getMonth() / 6);
}

export function useEncaminhamentos(filtro: FiltroEncaminhamentos) {
  const [todos, setTodos] = useState<Encaminhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get<Encaminhamento[]>("/encaminhamentos")
      .then((dados) => {
        if (!ativo) return;
        setTodos(dados);
        setErro(null);
      })
      .catch((err: unknown) => {
        if (ativo) setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os encaminhamentos.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  const agora = new Date();
  const encaminhamentos =
    filtro === "semestre" ? todos.filter((e) => noSemestreAtual(e.encaminhamentoEm, agora)) : todos;

  return { encaminhamentos, carregando, erro, recarregar };
}
