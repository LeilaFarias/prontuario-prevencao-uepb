import { useEffect, useState } from "react";
import type { AcessosResponse } from "@prontuario/shared";
import { api } from "../lib/api";
import { ACESSOS_ATUALIZADOS_EVENT } from "../lib/acesso";

const POLLING_MS = 30_000;

export function useAcessosCount(): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      api
        .get<AcessosResponse>("/acessos")
        .then((r) => ativo && setTotal(r.pendentes.length))
        .catch(() => undefined);
    };

    atualizar();
    const t = window.setInterval(atualizar, POLLING_MS);
    window.addEventListener(ACESSOS_ATUALIZADOS_EVENT, atualizar);
    return () => {
      ativo = false;
      window.clearInterval(t);
      window.removeEventListener(ACESSOS_ATUALIZADOS_EVENT, atualizar);
    };
  }, []);

  return total;
}
