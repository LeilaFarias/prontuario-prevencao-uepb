import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalProntuario } from "../db/dexie";

const TEMPO_LIMITE_MS = 5_000;
const INTERVALO_REVALIDACAO_MS = 3_000;

async function lerLista(alunoId?: string): Promise<LocalProntuario[]> {
  if (!db.isOpen()) await db.open();
  const todos = await db.prontuarios.orderBy("atualizadoEm").reverse().toArray();
  return todos.filter((p) => (!p.alunoTitularId || p.alunoTitularId === alunoId) && !p.descartadoEm);
}

function comLimite<T>(promessa: Promise<T>): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const timer = window.setTimeout(() => rejeitar(new Error("Tempo limite ao ler prontuários locais")), TEMPO_LIMITE_MS);
    promessa.then(resolver, rejeitar).finally(() => window.clearTimeout(timer));
  });
}

/** Mantém a lista utilizável mesmo quando a assinatura liveQuery do IndexedDB fica sem emitir no PWA. */
export function useListaProntuariosLocal(alunoId?: string) {
  const vivo = useLiveQuery(() => lerLista(alunoId), [alunoId]);
  const [manual, setManual] = useState<LocalProntuario[] | undefined>();
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const recarregar = useCallback(() => {
    setErro(false);
    setManual(undefined);
    setTentativa((n) => n + 1);
  }, []);

  useEffect(() => {
    if (vivo !== undefined) {
      setManual(undefined);
      setErro(false);
      return;
    }

    let ativo = true;
    let timer: number | undefined;
    let intervalo: number | undefined;
    const ler = async () => {
      try {
        const lista = await comLimite(lerLista(alunoId));
        if (!ativo) return;
        setManual(lista);
        setErro(false);
      } catch (e) {
        console.warn("[useListaProntuariosLocal] falha ao recuperar lista local:", e);
        if (ativo && manual === undefined) setErro(true);
      }
    };

    timer = window.setTimeout(() => {
      void ler();
      intervalo = window.setInterval(() => void ler(), INTERVALO_REVALIDACAO_MS);
    }, 300);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void ler();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
  }, [vivo, alunoId, tentativa]);

  return { prontuarios: vivo ?? manual, erro: vivo === undefined && erro && manual === undefined, recarregar };
}
