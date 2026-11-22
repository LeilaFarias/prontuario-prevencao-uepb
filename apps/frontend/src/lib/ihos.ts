import type { RegistroIHOSDados } from "@prontuario/shared";

export type NotaIHOS = 0 | 1 | 2 | 3 | null;
export type ChaveIHOS = keyof RegistroIHOSDados["dentes"];
export type DentesIHOS = Record<ChaveIHOS, NotaIHOS>;
export type AusentesIHOS = Record<ChaveIHOS, boolean>;
export type InterpretacaoIHOS = "boa" | "regular" | "ruim" | null;

export const DENTES_IHOS: ReadonlyArray<{ chave: ChaveIHOS; label: string; descricao: string }> = [
  { chave: "V11", label: "V11", descricao: "Vestibular · 11" },
  { chave: "V16", label: "V16", descricao: "Vestibular · 16" },
  { chave: "V26", label: "V26", descricao: "Vestibular · 26" },
  { chave: "V31", label: "V31", descricao: "Vestibular · 31" },
  { chave: "L36", label: "L36", descricao: "Lingual · 36" },
  { chave: "L46", label: "L46", descricao: "Lingual · 46" },
];

export const TEXTO_INTERPRETACAO_IHOS: Record<Exclude<InterpretacaoIHOS, null>, string> = {
  boa: "Boa higiene bucal",
  regular: "Higiene bucal regular",
  ruim: "Higiene bucal ruim",
};

export interface ResultadoIHOS {
  dentesPresentes: number;
  todosAusentes: boolean;
  dentesExaminados: number;
  somaNotas: number;
  media: number;
  interpretacao: InterpretacaoIHOS;
}

export function dentesIHOSVazios(): DentesIHOS {
  return { V11: null, V16: null, V26: null, V31: null, L36: null, L46: null };
}

export function ausentesIHOSVazios(): AusentesIHOS {
  return { V11: false, V16: false, V26: false, V31: false, L36: false, L46: false };
}

export function calcularIHOS(
  dentes: Partial<Record<ChaveIHOS, NotaIHOS>>,
  ausentes: Partial<Record<ChaveIHOS, boolean>> = {},
): ResultadoIHOS {
  let dentesPresentes = 0;
  let dentesExaminados = 0;
  let somaNotas = 0;

  for (const { chave } of DENTES_IHOS) {
    if (ausentes[chave] === true) continue;
    dentesPresentes += 1;
    const nota = dentes[chave];
    if (nota === null || nota === undefined) continue;
    dentesExaminados += 1;
    somaNotas += nota;
  }

  const media = dentesExaminados === 0 ? 0 : somaNotas / dentesExaminados;

  let interpretacao: InterpretacaoIHOS = null;
  if (dentesExaminados > 0) {
    if (media <= 1) interpretacao = "boa";
    else if (media <= 2) interpretacao = "regular";
    else interpretacao = "ruim";
  }

  return {
    dentesPresentes,
    todosAusentes: dentesPresentes === 0,
    dentesExaminados,
    somaNotas,
    media,
    interpretacao,
  };
}