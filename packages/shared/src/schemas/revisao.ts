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

export const QUEM_RECEBE = ["anterior", "novo"] as const;

export type QuemRecebe = (typeof QUEM_RECEBE)[number];

export const transferirTitularidadeSchema = z.object({
  prontuarioAntigoId: z.string().trim().min(1, "Informe o prontuário anterior"),
  prontuarioNovoId: z.string().trim().min(1, "Informe o prontuário novo"),
  quemRecebe: z.enum(QUEM_RECEBE, { errorMap: () => ({ message: "Escolha qual dupla recebe o prontuário" }) }),
  professorEscolhidoId: z.string().trim().min(1).optional(),
});

export const manterTitularidadeSchema = z.object({
  professorSupervisorId: z.string().trim().min(1, "Selecione o professor responsável"),
});

export type AssinarInput = z.infer<typeof assinarSchema>;
export type DevolverInput = z.infer<typeof devolverSchema>;
export type TransferirTitularidadeInput = z.infer<typeof transferirTitularidadeSchema>;
export type ManterTitularidadeInput = z.infer<typeof manterTitularidadeSchema>;

export interface PartesDuplicidade {
  prontuarioId: string;
  alunoId: string;
  alunoNome: string;
  alunoOperador: string;
  alunoAuxiliar: string;
  professorId: string | null;
  professorNome: string | null;
  criadoEm: string;
  status: string;
}

export interface DuplicidadeResponse {
  atual: PartesDuplicidade;
  existente: PartesDuplicidade | null;
}

export interface HistoricoProntuario {
  prontuarioId: string;
  alunoNome: string;
  professorNome: string | null;
  criadoEm: string;
  secoes: Record<string, unknown>;
}

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


export interface NotificacaoAluno {
  id: string;
  prontuarioId: string | null;
  tipo: string;
  mensagem: string;
  criadoEm: string;
}
