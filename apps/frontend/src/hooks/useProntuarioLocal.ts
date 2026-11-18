import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, lerProntuarioDecifrado, type LocalProntuario } from "../db/dexie";

const ESPERA_INICIAL_MS = 1500;
const MAX_TENTATIVAS = 3;
const REVALIDAR_MS = 3000;

export interface ProntuarioLocal {
  prontuario: LocalProntuario | undefined;
  carregando: boolean;
  falhou: boolean;
  recarregar: () => void;
}

async function lerGarantindoBanco(id: string): Promise<LocalProntuario | undefined> {
  if (!db.isOpen()) await db.open();
  return lerProntuarioDecifrado(id);
}

/**
 * Lê o prontuário local (decifrado) de forma resiliente.
 *
 * O `liveQuery` do Dexie pode ficar preso em `undefined` sem emitir nada nem erro
 * (DatabaseClosedError/AbortError são engolidos, e a leitura em andamento é descartada
 * quando há escrita concorrente — ex.: troca de seção). Neste caso o hook:
 *  1. espera ~1,5 s;
 *  2. reabre o banco se preciso e lê manualmente (com novas tentativas);
 *  3. reassina o liveQuery;
 *  4. se tudo falhar, devolve `falhou: true` para a UI oferecer "Recarregar seção".
 * Ao voltar do segundo plano (Android pode reciclar a conexão do IndexedDB) tenta de novo.
 */
export function useProntuarioLocal(id: string): ProntuarioLocal {
  const [assinatura, setAssinatura] = useState(0);
  const [ciclo, setCiclo] = useState(0);
  const vivo = useLiveQuery(() => lerProntuarioDecifrado(id), [id, assinatura]);
  const vivoRef = useRef(vivo);
  vivoRef.current = vivo;
  const [manual, setManual] = useState<LocalProntuario | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const manualRef = useRef<LocalProntuario | undefined>(undefined);
  manualRef.current = manual;

  const recarregar = useCallback(() => {
    setFalhou(false);
    setAssinatura((n) => n + 1);
    setCiclo((n) => n + 1);
  }, []);

  useEffect(() => {
    setManual(undefined);
    setFalhou(false);
  }, [id]);

  useEffect(() => {
    if (vivo) {
      setManual(undefined);
      setFalhou(false);
      return;
    }

    let ativo = true;
    let timer: number | undefined;
    let tentativas = 0;

    const tentar = async () => {
      if (!ativo) return;
      try {
        const p = await lerGarantindoBanco(id);
        if (!ativo) return;
        if (p) {
          setManual(p);
          setFalhou(false);
          setAssinatura((n) => n + 1);
          return;
        }
      } catch (erro) {
        console.warn("[useProntuarioLocal] falha ao ler prontuário local:", erro);
      }
      if (!ativo) return;
      tentativas += 1;
      if (tentativas >= MAX_TENTATIVAS) {
        setFalhou(true);
        return;
      }
      timer = window.setTimeout(() => void tentar(), ESPERA_INICIAL_MS * tentativas);
    };

    timer = window.setTimeout(() => void tentar(), ESPERA_INICIAL_MS);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [vivo, id, ciclo]);

  useEffect(() => {
    if (vivo || !manual) return;
    let ativo = true;
    const t = window.setInterval(() => {
      void lerGarantindoBanco(id)
        .then((p) => {
          if (!ativo || !p) return;
          const atual = manualRef.current;
          if (atual && JSON.stringify(p) === JSON.stringify(atual)) return;
          setManual(p);
        })
        .catch(() => undefined);
    }, REVALIDAR_MS);
    return () => {
      ativo = false;
      window.clearInterval(t);
    };
  }, [vivo, manual, id]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible" || vivoRef.current) return;
      setAssinatura((n) => n + 1);
      setCiclo((n) => n + 1);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
  }, []);

  const prontuario = vivo ?? manual;
  return { prontuario, carregando: !prontuario && !falhou, falhou, recarregar };
}
