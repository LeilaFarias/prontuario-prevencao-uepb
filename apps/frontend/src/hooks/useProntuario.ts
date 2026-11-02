import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import type { ProntuarioRemoto } from "../sync/down";

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
  const [estado, setEstado] = useState<EstadoProntuario>({ situacao: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!id) {
      setEstado({ situacao: "erro", mensagem: "Prontuário não informado.", status: 404 });
      return;
    }
    let ativo = true;
    setEstado({ situacao: "carregando" });

    api
      .get<ProntuarioRevisao>(`/prontuarios/${encodeURIComponent(id)}`)
      .then((prontuario) => {
        if (ativo) setEstado({ situacao: "ok", prontuario });
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        if (err instanceof ApiError) setEstado({ situacao: "erro", mensagem: err.message, status: err.status });
        else setEstado({ situacao: "erro", mensagem: "Não foi possível carregar o prontuário.", status: 0 });
      });

    return () => {
      ativo = false;
    };
  }, [id, tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  const atualizar = useCallback(async () => {
    if (!id) return;
    try {
      const prontuario = await api.get<ProntuarioRevisao>(`/prontuarios/${encodeURIComponent(id)}`);
      setEstado({ situacao: "ok", prontuario });
    } catch {
      return;
    }
  }, [id]);

  return { ...estado, recarregar, atualizar };
}
