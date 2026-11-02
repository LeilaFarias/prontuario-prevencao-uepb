import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import type { ProntuarioRemoto } from "../sync/down";

/** Resposta de GET /prontuarios/:id para a revisão do professor. */
export interface ProntuarioRevisao extends ProntuarioRemoto {
  /** Professor supervisor + prontuário ainda ENVIADO: pode assinar/devolver. */
  podeAgir: boolean;
  /** O professor logado é o supervisor deste prontuário. */
  ehSupervisor: boolean;
  /** ISO do momento em que o aluno enviou; null se não houver registro. */
  enviadoEm: string | null;
}

export type EstadoProntuario =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string; status: number }
  | { situacao: "ok"; prontuario: ProntuarioRevisao };

/**
 * Carrega o prontuário (com todas as seções) direto do servidor. Não grava nada no Dexie:
 * dados que o professor apenas consulta não entram na base local nem na fila de sync.
 */
export function useProntuario(id: string | undefined): EstadoProntuario & { recarregar: () => void } {
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
  return { ...estado, recarregar };
}
