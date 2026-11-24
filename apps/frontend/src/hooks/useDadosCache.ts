import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { assinar, lerEntrada, revalidar, type ErroCache } from "../lib/cacheDados";

interface Opcoes {
  validoPorMs?: number;
  pollingMs?: number;
}

const SEM_ASSINATURA = () => () => undefined;

export function useDadosCache<T>(chave: string | null, buscar: () => Promise<T>, opcoes: Opcoes = {}) {
  const { validoPorMs = 20_000, pollingMs } = opcoes;
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const assinatura = useCallback(
    (ouvinte: () => void) => (chave ? assinar(chave, ouvinte) : SEM_ASSINATURA()),
    [chave],
  );
  const entrada = useSyncExternalStore(assinatura, () => lerEntrada(chave ?? ""));

  const recarregar = useCallback(
    () => (chave ? revalidar(chave, () => buscarRef.current()) : Promise.resolve()),
    [chave],
  );
  const recarregarSeAntigo = useCallback(
    (minIdadeMs: number) => (chave ? revalidar(chave, () => buscarRef.current(), minIdadeMs) : Promise.resolve()),
    [chave],
  );

  useEffect(() => {
    if (!chave) return;
    void revalidar(chave, () => buscarRef.current(), validoPorMs);
    if (!pollingMs) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void revalidar(chave, () => buscarRef.current(), pollingMs / 2);
    }, pollingMs);
    return () => window.clearInterval(t);
  }, [chave, validoPorMs, pollingMs]);

  const dados = entrada.dados as T | undefined;
  const erro: ErroCache | null = entrada.erro;

  return {
    dados,
    erro,
    carregando: dados === undefined && erro === null,
    atualizando: entrada.buscando,
    recarregar,
    recarregarSeAntigo,
  };
}
