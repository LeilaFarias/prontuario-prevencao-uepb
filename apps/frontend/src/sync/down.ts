import type { HistoricoProntuario } from "@prontuario/shared";
import { db, type LocalProntuario, type LocalStatus } from "../db/dexie";
import { api, TIMEOUT_SYNC_MS } from "../lib/api";
import { avisoJaVisto, marcadorDeAviso } from "../lib/avisosVistos";
import { getSession } from "../lib/session";
import { flushAtivoDesde, notifyChanged } from "./queue";

export const ULTIMO_SYNC_DOWN_KEY = "prontuario:ultimoSyncDown";
export const ULTIMO_SYNC_AUTORIZACOES_KEY = "prontuario:ultimoSyncAutorizacoes";

export interface ProntuarioRemotoResumo {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
  alunoTitularId: string;
  professorSupervisorId: string | null;
  alunoNome: string;
  professorSupervisorNome: string | null;
  sinalizadoDuplicidade: number;
  duplicidadeEmAnalise?: number;
  transferidoDe: string | null;
  transferidoPara: string | null;
  transferidoParaNome: string | null;
}

export interface ProntuarioRemoto extends ProntuarioRemotoResumo {
  secoes: Record<string, unknown>;
  assinadoEm: string | null;
  assinadoPorNome: string | null;
  acessoSolicitadoEm: string | null;
  acessoExpiraEm: string | null;
  acessoRevogadoEm: string | null;
  acessoRecusadoEm: string | null;
  devolvidoEm: string | null;
  devolvidoPorNome: string | null;
  motivoDevolucao: string | null;
  comentarioDevolucao: string | null;
  historico?: HistoricoProntuario | null;
}

interface AutorizacaoRemota {
  id: string;
  professorId: string;
  alunoId: string;
  prontuarioId: string;
  operations: string[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
  publicKeyPem: string;
  revokedAt: string | null;
}

const STATUS_VALIDOS: ReadonlySet<string> = new Set<LocalStatus>([
  "em_andamento",
  "enviado",
  "assinado",
  "devolvido",
  "transferido",
]);

export function normalizarStatus(s: string): LocalProntuario["status"] {
  const v = s.trim().toLowerCase();
  return STATUS_VALIDOS.has(v) ? (v as LocalStatus) : "em_andamento";
}

function camposDeRevisao(remoto: ProntuarioRemoto) {
  return {
    assinadoEm: remoto.assinadoEm ?? undefined,
    assinadoPorNome: remoto.assinadoPorNome ?? undefined,
    professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
    acessoSolicitadoEm: remoto.acessoSolicitadoEm ?? undefined,
    acessoExpiraEm: remoto.acessoExpiraEm ?? undefined,
    acessoRevogadoEm: remoto.acessoRevogadoEm ?? undefined,
    devolvidoEm: remoto.devolvidoEm ?? undefined,
    devolvidoPorNome: remoto.devolvidoPorNome ?? undefined,
    motivoDevolucao: remoto.motivoDevolucao ?? undefined,
    comentarioDevolucao: remoto.comentarioDevolucao ?? undefined,
    sinalizadoDuplicidade: remoto.sinalizadoDuplicidade === 1,
    duplicidadeEmAnalise: remoto.duplicidadeEmAnalise === 1,
  };
}

function camposDeTransferencia(remoto: ProntuarioRemoto, local?: LocalProntuario) {
  return {
    transferidoDe: remoto.transferidoDe ?? undefined,
    transferidoPara: remoto.transferidoPara ?? undefined,
    transferidoParaNome: remoto.transferidoParaNome ?? undefined,
    historico: remoto.historico === undefined ? local?.historico : (remoto.historico ?? undefined),
  };
}

function paraTimestamp(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

interface ProfessorLiberacaoRemoto {
  professorId: string;
  nome: string;
  pinHashClient: string;
  saltClient: string;
}

async function sincronizarProfessoresLiberacao(): Promise<void> {
  if (getSession()?.user.perfil !== "aluno") return;
  try {
    const lista = await api.get<ProfessorLiberacaoRemoto[]>("/sync/professores-liberacao", { timeoutMs: TIMEOUT_SYNC_MS });
    const sincronizadoEm = Date.now();
    await db.professoresLiberacao.bulkPut(
      lista.map((p) => ({
        professorId: p.professorId,
        nome: p.nome,
        pinHashClient: p.pinHashClient,
        saltClient: p.saltClient,
        sincronizadoEm,
      })),
    );
  } catch (e) {
    console.warn("[syncDown] falha ao buscar professores de liberação:", e);
  }
}

async function sincronizarAutorizacoesOffline(): Promise<boolean> {
  const session = getSession();
  if (!session || session.user.perfil !== "aluno") return false;
  const ownerId = session.user.id;

  let cursor: string | null = null;
  try {
    cursor = localStorage.getItem(ULTIMO_SYNC_AUTORIZACOES_KEY);
  } catch {
  }

  const url = cursor
    ? `/acessos/autorizacoes?since=${encodeURIComponent(cursor)}`
    : "/acessos/autorizacoes";

  try {
    const lista = await api.get<AutorizacaoRemota[]>(url, { timeoutMs: TIMEOUT_SYNC_MS });
    if (lista.length === 0) return false;

    await db.autorizacoesOffline.bulkPut(
      lista.map((a) => ({
        id: a.id,
        professorId: a.professorId,
        alunoId: a.alunoId,
        prontuarioId: a.prontuarioId,
        operations: a.operations,
        issuedAt: a.issuedAt,
        expiresAt: a.expiresAt,
        nonce: a.nonce,
        signature: a.signature,
        publicKeyPem: a.publicKeyPem,
        revokedAt: a.revokedAt,
        ownerId,
      })),
    );

    const novoCursor = lista
      .map((a) => a.issuedAt)
      .sort()
      .pop();
    if (novoCursor) {
      try {
        localStorage.setItem(ULTIMO_SYNC_AUTORIZACOES_KEY, novoCursor);
      } catch {
      }
    }
    return true;
  } catch (e) {
    console.warn("[syncDown] falha ao buscar autorizações offline:", e);
    return false;
  }
}

export function estaOnline(): boolean {
  return navigator.onLine;
}

export function buscarResumos(): Promise<ProntuarioRemotoResumo[]> {
  return api.get<ProntuarioRemotoResumo[]>("/prontuarios", { timeoutMs: TIMEOUT_SYNC_MS });
}

export function buscarDetalhe(id: string): Promise<ProntuarioRemoto> {
  return api.get<ProntuarioRemoto>(`/prontuarios/${encodeURIComponent(id)}`, { timeoutMs: TIMEOUT_SYNC_MS });
}

export async function aplicarRemoto(remoto: ProntuarioRemoto): Promise<boolean> {
  const remotoEm = paraTimestamp(remoto.atualizadoEm);

  return db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const local = await db.prontuarios.get(remoto.id);
    if (local?.descartadoEm) return false;

    if (!local) {
      const status = normalizarStatus(remoto.status);
      const visto = avisoJaVisto(
        getSession()?.user.id,
        remoto.id,
        marcadorDeAviso(status, remoto.assinadoEm ?? undefined, remoto.devolvidoEm ?? undefined),
      );
      await db.prontuarios.add({
        id: remoto.id,
        pacienteNome: remoto.pacienteNome,
        pacienteDataNascimento: remoto.pacienteDataNascimento ?? undefined,
        status,
        ...camposDeRevisao(remoto),
        ...camposDeTransferencia(remoto),
        acessoRecusadoEm: remoto.acessoRecusadoEm ?? undefined,
        vistoPeloAluno: visto,
        secoes: (remoto.secoes ?? {}) as Record<string, Record<string, unknown>>,
        criadoEm: paraTimestamp(remoto.criadoEm),
        atualizadoEm: remotoEm,
        sincronizado: true,
        alunoTitularId: remoto.alunoTitularId,
        professorSupervisorId: remoto.professorSupervisorId ?? undefined,
        professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
      });
      return true;
    }

    const novoStatus = normalizarStatus(remoto.status);

    const acessoMudou =
      remoto.acessoSolicitadoEm !== (local.acessoSolicitadoEm ?? null) ||
      remoto.acessoExpiraEm !== (local.acessoExpiraEm ?? null) ||
      remoto.acessoRevogadoEm !== (local.acessoRevogadoEm ?? null) ||
      remoto.acessoRecusadoEm !== (local.acessoRecusadoEm ?? null) ||
      novoStatus !== local.status ||
      (remoto.sinalizadoDuplicidade === 1) !== Boolean(local.sinalizadoDuplicidade) ||
      (remoto.duplicidadeEmAnalise === 1) !== Boolean(local.duplicidadeEmAnalise) ||
      (remoto.transferidoDe ?? null) !== (local.transferidoDe ?? null) ||
      (remoto.transferidoPara ?? null) !== (local.transferidoPara ?? null);

    const pendentes = await db.syncQueue.where("prontuarioId").equals(local.id).count();

    if (pendentes > 0) {
      if (!acessoMudou) return false;
      await db.prontuarios.put({
        ...local,
        status: novoStatus,
        acessoSolicitadoEm: remoto.acessoSolicitadoEm ?? undefined,
        acessoExpiraEm: remoto.acessoExpiraEm ?? undefined,
        acessoRevogadoEm: remoto.acessoRevogadoEm ?? undefined,
        acessoRecusadoEm: remoto.acessoRecusadoEm ?? undefined,
        professorSupervisorId: remoto.professorSupervisorId ?? undefined,
        professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
        sinalizadoDuplicidade: remoto.sinalizadoDuplicidade === 1,
        duplicidadeEmAnalise: remoto.duplicidadeEmAnalise === 1,
        ...camposDeTransferencia(remoto, local),
        vistoPeloAluno: novoStatus === local.status ? local.vistoPeloAluno : false,
      });
      return true;
    }

    if (remotoEm <= local.atualizadoEm && !acessoMudou) return false;

    await db.prontuarios.put({
      ...local,
      pacienteNome: remoto.pacienteNome,
      pacienteDataNascimento: remoto.pacienteDataNascimento ?? local.pacienteDataNascimento,
      status: novoStatus,
      ...camposDeRevisao(remoto),
      ...camposDeTransferencia(remoto, local),
      acessoRecusadoEm: remoto.acessoRecusadoEm ?? undefined,
      vistoPeloAluno: novoStatus === local.status ? local.vistoPeloAluno : false,
      secoes: { ...local.secoes, ...(remoto.secoes ?? {}) } as Record<string, Record<string, unknown>>,
      atualizadoEm: remotoEm,
      sincronizado: true,
      alunoTitularId: remoto.alunoTitularId,
      professorSupervisorId: remoto.professorSupervisorId ?? undefined,
      professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
    });
    return true;
  });
}

async function precisaAtualizar(resumo: ProntuarioRemotoResumo): Promise<boolean> {
  const local = await db.prontuarios.get(resumo.id);
  if (!local) return true;
  return paraTimestamp(resumo.atualizadoEm) > local.atualizadoEm;
}

const SIMULTANEOS = 4;

async function removerTransferidos(resumos: ProntuarioRemotoResumo[]): Promise<boolean> {
  if (getSession()?.user.perfil !== "aluno") return false;
  const idsRemotos = new Set(resumos.map((r) => r.id));
  const pendentes = new Set((await db.syncQueue.toArray()).map((o) => o.prontuarioId));
  const obsoletos = (await db.prontuarios.toArray()).filter(
    (p) => p.sincronizado && !idsRemotos.has(p.id) && !pendentes.has(p.id),
  );
  if (obsoletos.length === 0) return false;
  await db.prontuarios.bulkDelete(obsoletos.map((p) => p.id));
  return true;
}

export async function sincronizarParaBaixo(): Promise<void> {
  const inicio = Date.now();
  const resumos = await buscarResumos();
  await sincronizarProfessoresLiberacao();
  const autorizacoesAtualizadas = await sincronizarAutorizacoesOffline();
  const alvos: ProntuarioRemotoResumo[] = [];
  for (const r of resumos) {
    if (await precisaAtualizar(r)) alvos.push(r);
  }

  let alterou = flushAtivoDesde(inicio) ? false : await removerTransferidos(resumos);
  for (let i = 0; i < alvos.length; i += SIMULTANEOS) {
    const lote = alvos.slice(i, i + SIMULTANEOS);
    const resultados = await Promise.allSettled(
      lote.map(async (r) => aplicarRemoto(await buscarDetalhe(r.id))),
    );
    for (const res of resultados) {
      if (res.status === "fulfilled") alterou = alterou || res.value;
      else console.warn("[syncDown] falha ao buscar prontuário:", res.reason);
    }
    if (resultados.every((res) => res.status === "rejected")) break;
  }

  try {
    localStorage.setItem(ULTIMO_SYNC_DOWN_KEY, String(Date.now()));
  } catch {
  }
  if (alterou || autorizacoesAtualizadas) notifyChanged();
}