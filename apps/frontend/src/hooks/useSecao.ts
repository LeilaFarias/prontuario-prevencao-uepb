import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { SecaoId } from "@prontuario/shared";
import { db, type LocalProntuario } from "../db/dexie";
import { salvarSecaoLocal, type CabecalhoPaciente } from "../sync/queue";

const DEBOUNCE_MS = 800;

type SchemaSecao = z.ZodType<FieldValues, z.ZodTypeDef, any>;

export interface OpcoesSecao<V> {
  preencher?: (salvo: V, prontuario: LocalProntuario) => V;
  cabecalho?: (valores: V) => CabecalhoPaciente;
}

export type UseSecaoReturn<T extends SchemaSecao> = UseFormReturn<z.output<T>> & {
  salvando: boolean;
  salvoEm: number | null;
  somenteLeitura: boolean;
};

export function useSecao<T extends SchemaSecao>(
  prontuario: LocalProntuario,
  secaoId: SecaoId,
  schema: T,
  opcoes?: OpcoesSecao<z.output<T>>,
): UseSecaoReturn<T> {
  type V = z.output<T>;

  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;

  const ler = useCallback(
    (bruto: unknown, p: LocalProntuario): V => {
      const resultado = schema.safeParse(bruto ?? {});
      const base = (resultado.success ? resultado.data : schema.parse({})) as V;
      return opcoesRef.current?.preencher ? opcoesRef.current.preencher(base, p) : base;
    },
    [schema],
  );

  const [inicial] = useState<V>(() => ler(prontuario.secoes[secaoId], prontuario));
  const form = useForm<V>({ defaultValues: inicial as unknown as DefaultValues<V> });
  const { watch, getValues, reset } = form;

  const somenteLeitura = prontuario.status === "assinado";

  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<number | null>(null);

  const timer = useRef<number | undefined>(undefined);
  const ultimoSalvo = useRef<string>(JSON.stringify(inicial));
  const emAndamento = useRef(0);
  const montado = useRef(true);

  const salvar = useCallback(async () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;

    const valores = getValues() as V;
    const json = JSON.stringify(valores);
    if (json === ultimoSalvo.current) {
      if (montado.current && emAndamento.current === 0) setSalvando(false);
      return;
    }

    const anterior = ultimoSalvo.current;
    ultimoSalvo.current = json;
    emAndamento.current += 1;
    try {
      await salvarSecaoLocal(
        prontuario.id,
        secaoId,
        JSON.parse(json) as Record<string, unknown>,
        opcoesRef.current?.cabecalho?.(valores),
      );
      if (montado.current) setSalvoEm(Date.now());
    } catch (err) {
      console.error("[useSecao] falha ao salvar seção:", err);
      ultimoSalvo.current = anterior; // permite nova tentativa na próxima edição
    } finally {
      emAndamento.current -= 1;
      if (montado.current && timer.current === undefined && emAndamento.current === 0) setSalvando(false);
    }
  }, [getValues, prontuario.id, secaoId]);

  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  // Autosave: qualquer mudança (digitação ou setValue) agenda a gravação
  useEffect(() => {
    if (somenteLeitura) return;
    const sub = watch(() => {
      if (JSON.stringify(getValues()) === ultimoSalvo.current) return;
      setSalvando(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void salvarRef.current(), DEBOUNCE_MS);
    });
    return () => sub.unsubscribe();
  }, [watch, getValues, somenteLeitura]);

  // Nada digitado se perde ao sair da tela ou ocultar o app
  useEffect(() => {
    montado.current = true;
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") void salvarRef.current();
    };
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      montado.current = false;
      document.removeEventListener("visibilitychange", aoOcultar);
      void salvarRef.current();
    };
  }, []);

  // Dados novos no Dexie (ex.: sync down de outro aparelho): recarrega o form se não houver edição em curso
  const secaoNoDexie = prontuario.secoes[secaoId];
  const primeiraExecucao = useRef(true);
  useEffect(() => {
    if (primeiraExecucao.current) {
      primeiraExecucao.current = false;
      return;
    }
    let ativo = true;
    void db.prontuarios.get(prontuario.id).then((p) => {
      if (!ativo || !p || !montado.current) return;
      if (timer.current !== undefined || emAndamento.current > 0) return;
      if (JSON.stringify(getValues()) !== ultimoSalvo.current) return;
      const novo = ler(p.secoes[secaoId], p);
      const json = JSON.stringify(novo);
      if (json === ultimoSalvo.current) return;
      ultimoSalvo.current = json;
      reset(novo as unknown as DefaultValues<V>);
    });
    return () => {
      ativo = false;
    };
  }, [secaoNoDexie, prontuario.id, secaoId, getValues, reset, ler]);

  return { ...form, salvando, salvoEm, somenteLeitura };
}
