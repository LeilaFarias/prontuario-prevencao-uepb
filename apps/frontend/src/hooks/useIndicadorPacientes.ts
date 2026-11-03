import { useEffect, useState } from "react";
import type { FiltroFila, IndicadorPacientes } from "@prontuario/shared";
import { api } from "../lib/api";

export function useIndicadorPacientes(filtro: FiltroFila) {
  const [data, setData] = useState<IndicadorPacientes | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api
      .get<IndicadorPacientes>(`/indicador-pacientes?filtro=${filtro}`)
      .then((r) => ativo && setData(r))
      .catch(() => ativo && setData({ total: 0, periodo: null }))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  return { data, carregando };
}