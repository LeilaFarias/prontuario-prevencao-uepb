import { useEffect, useState } from "react";
import type { IndicadorPacientes } from "@prontuario/shared";
import { api } from "../lib/api";

export function useIndicadorPacientes() {
  const [data, setData] = useState<IndicadorPacientes | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api
      .get<IndicadorPacientes>("/indicador-pacientes")
      .then((r) => ativo && setData(r))
      .catch(() => ativo && setData({ total: 0, periodo: null }))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  return { data, carregando };
}
