import { z } from "zod";

export const MOTIVOS_DEVOLUCAO = [
  "calculo_divergente",
  "campo_incompleto",
  "informacao_incorreta",
  "anexo_ilegivel",
  "outro",
] as const;

export type MotivoDevolucao = (typeof MOTIVOS_DEVOLUCAO)[number];

export const ROTULO_MOTIVO_DEVOLUCAO: Record<MotivoDevolucao, string> = {
  calculo_divergente: "Cálculo divergente",
  campo_incompleto: "Campo incompleto",
  informacao_incorreta: "Informação incorreta",
  anexo_ilegivel: "Anexo ilegível",
  outro: "Outro",
};

export const COMENTARIO_DEVOLUCAO_MIN = 10;
export const COMENTARIO_DEVOLUCAO_MAX = 500;

export const assinarSchema = z.object({
  matricula: z.string().trim().min(1, "Informe a matrícula"),
  senha: z.string().min(1, "Informe a senha"),
});

export const devolverSchema = z.object({
  motivo: z.enum(MOTIVOS_DEVOLUCAO, { errorMap: () => ({ message: "Selecione um motivo válido" }) }),
  comentario: z
    .string()
    .trim()
    .min(COMENTARIO_DEVOLUCAO_MIN, `O comentário precisa ter no mínimo ${COMENTARIO_DEVOLUCAO_MIN} caracteres`)
    .max(COMENTARIO_DEVOLUCAO_MAX, `O comentário pode ter no máximo ${COMENTARIO_DEVOLUCAO_MAX} caracteres`),
});

export type AssinarInput = z.infer<typeof assinarSchema>;
export type DevolverInput = z.infer<typeof devolverSchema>;

export interface AssinarResponse {
  ok: true;
  assinadoEm: string;
  assinadoPorNome: string;
  procedimentosAssinados: number;
}

export interface DevolverResponse {
  ok: true;
  devolvidoEm: string;
  devolvidoPorNome: string;
}

export type CodigoErroRevisao =
  | "MATRICULA_NAO_CONFERE"
  | "SENHA_INCORRETA"
  | "NAO_SUPERVISOR"
  | "NAO_AGUARDANDO";
