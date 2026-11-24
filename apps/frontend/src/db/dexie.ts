import Dexie, { type Table } from "dexie";
import { secoesVazias, type HistoricoProntuario } from "@prontuario/shared";
import {
  cifrar,
  cifrarCamposPaciente,
  decifrar,
  decifrarCamposPaciente,
  getChave,
  ocultarCamposPaciente,
} from "../lib/chaveLocal";

export type LocalStatus = "em_andamento" | "enviado" | "assinado" | "devolvido" | "transferido";

export interface LocalProntuario {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento?: string;
  status: LocalStatus;
  desfechoEnvio?: "concluido" | "encaminhado";
  secoes: Record<string, any>;
  criadoEm: number;
  atualizadoEm: number;
  sincronizado: boolean;
  conteudoBaixado?: boolean;
  alunoTitularId?: string;
  erroEnvio?: "professor_nao_encontrado" | "falha";
  assinadoEm?: string;
  assinadoPorNome?: string;
  professorSupervisorId?: string;
  professorSupervisorNome?: string;
  acessoSolicitadoEm?: string;
  acessoExpiraEm?: string;
  acessoRevogadoEm?: string;
  acessoRecusadoEm?: string;
  devolvidoEm?: string;
  devolvidoPorNome?: string;
  motivoDevolucao?: string;
  comentarioDevolucao?: string;
  vistoPeloAluno?: boolean;
  sinalizadoDuplicidade?: boolean;
  duplicidadeEmAnalise?: boolean;
  transferidoDe?: string;
  transferidoPara?: string;
  transferidoParaNome?: string;
  historico?: HistoricoProntuario;
  descartadoEm?: string;
  secoesPendentes?: boolean;
}

export interface LocalPlanoProfessor {
  prontuarioId: string;
  sessoes: Array<{ numero: number; descricao: string }>;
  atualizadoEm: number;
}

export interface LocalProfessor {
  id: string;
  nome: string;
  matricula: string;
}

export interface LocalProfessorLiberacao {
  professorId: string;
  nome: string;
  pinHashClient: string;
  saltClient: string;
  sincronizadoEm: number;
}

export interface LocalLiberacaoOffline {
  id: string;
  alunoId: string;
  professorId: string;
  prontuarioId: string;
  liberadoEm: number;
  expiresAt: number;
  sincronizado: boolean;
}

export interface LocalSyncOp {
  id?: number;
  prontuarioId: string;
  op: "create" | "update" | "delete" | "enviar" | "reabrir" | "descartar";
  entity: "prontuario" | "secao" | "procedimento" | "anexo";
  entityId: string;
  payload?: Record<string, unknown>;
  payloadCifrado?: string;
  ts: number;
}

class ProntuarioDB extends Dexie {
  prontuarios!: Table<LocalProntuario, string>;
  syncQueue!: Table<LocalSyncOp, number>;
  planosProfessor!: Table<LocalPlanoProfessor, string>;
  professores!: Table<LocalProfessor, string>;
  professoresLiberacao!: Table<LocalProfessorLiberacao, string>;
  liberacoesOffline!: Table<LocalLiberacaoOffline, string>;

  constructor() {
    super("prontuario-digital");
    this.version(1).stores({
      prontuarios: "id, status, atualizadoEm, sincronizado",
      syncQueue: "++id, prontuarioId, ts",
    });
    this.version(2).stores({
      planosProfessor: "prontuarioId, atualizadoEm",
    });
    this.version(3).stores({
      professores: "id, matricula",
    });
    this.version(4).stores({
      professoresLiberacao: "professorId",
      liberacoesOffline: "id, alunoId, prontuarioId",
    });
  }
}

export const db = new ProntuarioDB();

export async function limparDexieLocal(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

export async function cifrarSecoes(
  chave: CryptoKey,
  secoes: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const entradas = await Promise.all(
    Object.entries(secoes).map(
      async ([id, conteudo]) =>
        [id, secoesVazias([conteudo]) ? {} : await cifrar(chave, JSON.stringify(conteudo))] as const,
    ),
  );
  return Object.fromEntries(entradas);
}

async function decifrarSecoes(chave: CryptoKey, secoes: Record<string, unknown>): Promise<Record<string, any>> {
  const entradas = await Promise.all(
    Object.entries(secoes).map(
      async ([id, valor]) => [id, typeof valor === "string" ? JSON.parse(await decifrar(chave, valor)) : valor] as const,
    ),
  );
  return Object.fromEntries(entradas);
}

export async function decifrarProntuario(p: LocalProntuario): Promise<LocalProntuario> {
  const chave = getChave();
  if (!chave) return { ...ocultarCamposPaciente(p), secoes: {} };
  const [comCampos, secoes] = await Promise.all([decifrarCamposPaciente(chave, p), decifrarSecoes(chave, p.secoes)]);
  return { ...comCampos, secoes };
}

export async function lerProntuarioDecifrado(id: string): Promise<LocalProntuario | undefined> {
  const p = await db.prontuarios.get(id);
  return p ? decifrarProntuario(p) : undefined;
}

export async function recifrarDadosLocais(antiga: CryptoKey, nova: CryptoKey): Promise<void> {
  for (;;) {
    const [prontuarios, fila] = await Promise.all([db.prontuarios.toArray(), db.syncQueue.toArray()]);

    const prontuariosNovos = new Map<string, Pick<LocalProntuario, "secoes" | "pacienteNome" | "pacienteDataNascimento">>();
    for (const p of prontuarios) {
      const claras = await decifrarSecoes(antiga, p.secoes);
      const recifradas: Record<string, unknown> = {};
      for (const [id, valor] of Object.entries(p.secoes)) {
        recifradas[id] = typeof valor === "string" ? await cifrar(nova, JSON.stringify(claras[id])) : valor;
      }
      const { pacienteNome, pacienteDataNascimento } = await cifrarCamposPaciente(
        nova,
        await decifrarCamposPaciente(antiga, p),
      );
      prontuariosNovos.set(p.id, { secoes: recifradas, pacienteNome, pacienteDataNascimento });
    }

    const opsNovas = new Map<number, Pick<LocalSyncOp, "payload" | "payloadCifrado">>();
    for (const op of fila) {
      if (op.id === undefined) continue;
      if (typeof op.payloadCifrado === "string") {
        opsNovas.set(op.id, { payloadCifrado: await cifrar(nova, await decifrar(antiga, op.payloadCifrado)) });
        continue;
      }
      const cifrado = op.payload?.conteudoCifrado;
      if (typeof cifrado !== "string") continue;
      opsNovas.set(op.id, {
        payload: { ...op.payload, conteudoCifrado: await cifrar(nova, await decifrar(antiga, cifrado)) },
      });
    }

    const assinatura = (ps: LocalProntuario[], os: LocalSyncOp[]) =>
      JSON.stringify([ps.map((p) => [p.id, p.atualizadoEm]), os.map((o) => o.id)]);

    const aplicado = await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
      const [prontuariosAgora, filaAgora] = await Promise.all([db.prontuarios.toArray(), db.syncQueue.toArray()]);
      if (assinatura(prontuariosAgora, filaAgora) !== assinatura(prontuarios, fila)) return false;
      for (const [id, campos] of prontuariosNovos) await db.prontuarios.update(id, campos);
      for (const [id, campos] of opsNovas) await db.syncQueue.update(id, campos);
      return true;
    });
    if (aplicado) return;
  }
}

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

export async function liberacaoOfflineVigente(
  prontuarioId: string,
  agora: number = Date.now(),
): Promise<LocalLiberacaoOffline | undefined> {
  const [liberacoes, pront] = await Promise.all([
    db.liberacoesOffline.where("prontuarioId").equals(prontuarioId).toArray(),
    db.prontuarios.get(prontuarioId),
  ]);
  const revogadoEm = pront?.acessoRevogadoEm ? new Date(pront.acessoRevogadoEm).getTime() : null;
  return liberacoes
    .filter((l) => l.expiresAt > agora && (revogadoEm === null || l.liberadoEm > revogadoEm))
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
}

export async function aplicarLiberacaoOffline(prontuarioId: string): Promise<void> {
  const liberacao = await liberacaoOfflineVigente(prontuarioId);
  if (!liberacao) return;
  const pront = await db.prontuarios.get(prontuarioId);
  if (!pront || temAcessoVigente(pront)) return;
  await db.prontuarios.update(prontuarioId, {
    acessoExpiraEm: new Date(liberacao.expiresAt).toISOString(),
    acessoRevogadoEm: undefined,
    acessoRecusadoEm: undefined,
  });
}
