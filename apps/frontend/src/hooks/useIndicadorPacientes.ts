import type { FiltroFila, IndicadorPacientes } from "@prontuario/shared";
import { api } from "../lib/api";
import { getSession } from "../lib/session";
import { useDadosCache } from "./useDadosCache";

const VALIDO_POR_MS = 60_000;

export function useIndicadorPacientes(filtro: FiltroFila) {
  const usuarioId = getSession()?.user.id;
  const { dados, erro, carregando } = useDadosCache<IndicadorPacientes>(
    usuarioId ? `${usuarioId}:indicador:${filtro}` : null,
    () => api.get<IndicadorPacientes>(`/indicador-pacientes?filtro=${filtro}`),
    { validoPorMs: VALIDO_POR_MS },
  );

  const data: IndicadorPacientes | null = dados ?? (erro ? { total: 0, periodo: null } : null);
  return { data, carregando };
}
