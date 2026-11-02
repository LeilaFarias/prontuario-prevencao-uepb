import Dexie, { type Table } from "dexie";

export type LocalStatus = "em_andamento" | "enviado" | "assinado" | "devolvido";

export interface LocalProntuario {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento?: string;
  status: LocalStatus;
  secoes: Record<string, any>;
  criadoEm: number;
  atualizadoEm: number;
  sincronizado: boolean;
  alunoTitularId?: string;
  erroEnvio?: "professor_nao_encontrado" | "falha";
  assinadoEm?: string;
  assinadoPorNome?: string;
  professorSupervisorId?: string;
  professorSupervisorNome?: string;
  acessoSolicitadoEm?: string;
  acessoExpiraEm?: string;
  acessoRevogadoEm?: string;
  devolvidoEm?: string;
  devolvidoPorNome?: string;
  motivoDevolucao?: string;
  comentarioDevolucao?: string;
  vistoPeloAluno?: boolean;
}

export interface LocalPlanoProfessor {
  prontuarioId: string;
  sessoes: Array<{ numero: number; descricao: string }>;
  atualizadoEm: number;
}

export interface LocalSyncOp {
  id?: number;
  prontuarioId: string;
  op: "create" | "update" | "delete" | "enviar" | "reabrir";
  entity: "prontuario" | "secao" | "procedimento" | "anexo";
  entityId: string;
  payload: Record<string, unknown>;
  ts: number;
}

class ProntuarioDB extends Dexie {
  prontuarios!: Table<LocalProntuario, string>;
  syncQueue!: Table<LocalSyncOp, number>;
  planosProfessor!: Table<LocalPlanoProfessor, string>;

  constructor() {
    super("prontuario-digital");
    this.version(1).stores({
      prontuarios: "id, status, atualizadoEm, sincronizado",
      syncQueue: "++id, prontuarioId, ts",
    });
    this.version(2).stores({
      planosProfessor: "prontuarioId, atualizadoEm",
    });
  }
}

export const db = new ProntuarioDB();

type CamposAcesso = Pick<LocalProntuario, "acessoExpiraEm" | "acessoRevogadoEm">;

export function temAcessoVigente(p: CamposAcesso, agora: number = Date.now()): boolean {
  if (!p.acessoExpiraEm) return false;
  if (p.acessoRevogadoEm) return false;
  return new Date(p.acessoExpiraEm).getTime() > agora;
}

export function pedidoPendenteLocal(
  p: Pick<LocalProntuario, "acessoSolicitadoEm" | "acessoExpiraEm" | "acessoRevogadoEm">,
): boolean {
  return !!p.acessoSolicitadoEm && !temAcessoVigente(p);
}

export function podeEnviarNaFila(
  p: Pick<LocalProntuario, "status" | "acessoExpiraEm" | "acessoRevogadoEm">,
): boolean {
  if (p.status !== "enviado" && p.status !== "assinado") return true;
  return temAcessoVigente(p);
}