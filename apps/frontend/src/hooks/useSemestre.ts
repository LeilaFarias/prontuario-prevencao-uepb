import { useEffect, useState } from "react";
import type { SemestreResponse } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";

export function useSemestre() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<SemestreResponse>("/configuracoes/semestre")
      .then((d) => {
        if (!ativo) return;
        setInicio(d.inicio ?? "");
        setFim(d.fim ?? "");
      })
      .catch(() => undefined)
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar(): Promise<string | null> {
    setSalvando(true);
    try {
      await api.put<{ ok: true }>("/configuracoes/semestre", { inicio, fim });
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.message : "Não foi possível salvar o semestre.";
    } finally {
      setSalvando(false);
    }
  }

  return { inicio, fim, setInicio, setFim, carregando, salvando, salvar };
}
