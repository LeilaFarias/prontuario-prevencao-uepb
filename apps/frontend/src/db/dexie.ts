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
  /** Dono do prontuário neste aparelho (necessário para criar no servidor). */
  alunoTitularId?: string;
}

export interface LocalSyncOp {
  id?: number;
  prontuarioId: string;
  op: "create" | "update" | "delete";
  entity: "prontuario" | "secao" | "procedimento" | "anexo";
  entityId: string;
  payload: Record<string, unknown>;
  ts: number;
}

class ProntuarioDB extends Dexie {
  prontuarios!: Table<LocalProntuario, string>;
  syncQueue!: Table<LocalSyncOp, number>;

  constructor() {
    super("prontuario-digital");
    this.version(1).stores({
      prontuarios: "id, status, atualizadoEm, sincronizado",
      syncQueue: "++id, prontuarioId, ts",
    });
  }
}

export const db = new ProntuarioDB();
