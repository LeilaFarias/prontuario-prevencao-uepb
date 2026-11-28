import { useCallback, useEffect, useRef, useState } from "react";
import type { SecaoId, SyncResponse } from "@prontuario/shared";
import { api, ApiError } from "../lib/api";

const REENVIO_MS = 15_000;

type Conteudo = Record<string, unknown>;

interface Opcoes {
  prontuarioId: string;
  secoesRemotas: Record<string, unknown>;
  aoDescartar: () => Promise<void>;
}

export function useEdicaoSecoesProfessor({ prontuarioId, secoesRemotas, aoDescartar }: Opcoes) {
  const [secoes, setSecoes] = useState<Record<string, unknown>>(secoesRemotas);
  const [pendentes, setPendentes] = useState(0);
  const [semConexao, setSemConexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fila = useRef(new Map<string, Conteudo>());
  const voo = useRef<Promise<void> | null>(null);
  const descartarRef = useRef(aoDescartar);
  descartarRef.current = aoDescartar;

  useEffect(() => {
    if (fila.current.size === 0) setSecoes(secoesRemotas);
  }, [secoesRemotas]);

  const executar = useCallback(async (): Promise<boolean> => {
    while (fila.current.size > 0) {
      if (!navigator.onLine) {
        setSemConexao(true);
        return false;
      }
      const [secaoId, conteudo] = fila.current.entries().next().value as [string, Conteudo];
      try {
        const resposta = await api.post<SyncResponse>(
          "/sync",
          {
            operations: [
              {
                prontuarioId,
                op: "update",
                entity: "secao",
                entityId: `${prontuarioId}:${secaoId}`,
                payload: { secaoId, conteudo },
                ts: Date.now(),
              },
            ],
          },
          { timeoutMs: 20_000 },
        );
        setSemConexao(false);
        if (fila.current.get(secaoId) === conteudo) fila.current.delete(secaoId);
        if (resposta.descartadas > 0) {
          fila.current.clear();
          setErro(
            "O servidor não aceitou a edição: o prontuário pode ter mudado de situação. As alterações não salvas foram descartadas.",
          );
          setPendentes(0);
          await descartarRef.current();
          return false;
        }
        setPendentes(fila.current.size);
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 0 || status >= 500) {
          setSemConexao(true);
          return false;
        }
        fila.current.delete(secaoId);
        setPendentes(fila.current.size);
        setErro(err instanceof Error ? err.message : "Não foi possível salvar a edição.");
        return false;
      }
    }
    return true;
  }, [prontuarioId]);

  const enviar = useCallback((): Promise<void> => {
    if (voo.current) return voo.current;
    const p = executar().then(
      (completo) => {
        voo.current = null;
        if (completo && fila.current.size > 0 && navigator.onLine) void enviar();
      },
      () => {
        voo.current = null;
      },
    );
    voo.current = p;
    return p;
  }, [executar]);

  const salvarSecao = useCallback(
    (secaoId: SecaoId, conteudo: Conteudo): Promise<void> => {
      setSecoes((atual) => ({ ...atual, [secaoId]: conteudo }));
      fila.current.set(secaoId, conteudo);
      setPendentes(fila.current.size);
      return enviar();
    },
    [enviar],
  );

  useEffect(() => {
    const aoVoltar = () => void enviar();
    window.addEventListener("online", aoVoltar);
    const t = window.setInterval(() => {
      if (fila.current.size > 0 && navigator.onLine) void enviar();
    }, REENVIO_MS);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.clearInterval(t);
    };
  }, [enviar]);

  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (fila.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  return {
    secoes,
    pendentes,
    semConexao,
    erro,
    limparErro: () => setErro(null),
    temPendentes: () => fila.current.size > 0,
    salvarSecao,
  };
}
