import { useEffect } from "react";
import { ACESSOS_ATUALIZADOS_EVENT } from "../lib/acesso";
import { useAcessosDados } from "./useAcessos";

const POLLING_MS = 30_000;
const INTERVALO_MINIMO_EVENTO_MS = 1_000;

export function useAcessosCount(): number {
  const { dados, recarregarSeAntigo } = useAcessosDados(POLLING_MS);

  useEffect(() => {
    const aoAtualizar = () => void recarregarSeAntigo(INTERVALO_MINIMO_EVENTO_MS);
    window.addEventListener(ACESSOS_ATUALIZADOS_EVENT, aoAtualizar);
    return () => window.removeEventListener(ACESSOS_ATUALIZADOS_EVENT, aoAtualizar);
  }, [recarregarSeAntigo]);

  return dados?.pendentes.length ?? 0;
}
