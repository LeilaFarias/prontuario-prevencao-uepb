import { db, type LocalProntuario, type LocalStatus } from "../db/dexie";
import { api } from "../lib/api";
import { notifyChanged } from "./queue";

export const ULTIMO_SYNC_DOWN_KEY = "prontuario:ultimoSyncDown";

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
}

export interface ProntuarioRemoto extends ProntuarioRemotoResumo {
  secoes: Record<string, unknown>;
  assinadoEm: string | null;
  assinadoPorNome: string | null;
  professorSupervisorNome: string | null;
  acessoSolicitadoEm: string | null;
  acessoExpiraEm: string | null;
  acessoRevogadoEm: string | null;
  devolvidoEm: string | null;
  devolvidoPorNome: string | null;
  motivoDevolucao: string | null;
  comentarioDevolucao: string | null;
}

const STATUS_VALIDOS: ReadonlySet<string> = new Set<LocalStatus>([
  "em_andamento",
  "enviado",
  "assinado",
  "devolvido",
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
  };
}

function paraTimestamp(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function estaOnline(): boolean {
  return navigator.onLine;
}

export function buscarResumos(): Promise<ProntuarioRemotoResumo[]> {
  return api.get<ProntuarioRemotoResumo[]>("/prontuarios");
}

export function buscarDetalhe(id: string): Promise<ProntuarioRemoto> {
  return api.get<ProntuarioRemoto>(`/prontuarios/${encodeURIComponent(id)}`);
}

// Checagem da fila e escrita na mesma transação: edição que entra na fila durante o sync não é sobrescrita.
export async function aplicarRemoto(remoto: ProntuarioRemoto): Promise<boolean> {
  const remotoEm = paraTimestamp(remoto.atualizadoEm);

  return db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const local = await db.prontuarios.get(remoto.id);

    if (!local) {
      await db.prontuarios.add({
        id: remoto.id,
        pacienteNome: remoto.pacienteNome,
        pacienteDataNascimento: remoto.pacienteDataNascimento ?? undefined,
        status: normalizarStatus(remoto.status),
        ...camposDeRevisao(remoto),
        vistoPeloAluno: false,
        secoes: remoto.secoes ?? {},
        criadoEm: paraTimestamp(remoto.criadoEm),
        atualizadoEm: remotoEm,
        sincronizado: true,
        alunoTitularId: remoto.alunoTitularId,
      });
      return true;
    }

    const pendentes = await db.syncQueue.where("prontuarioId").equals(local.id).count();
    if (pendentes > 0) return false;

    if (remotoEm <= local.atualizadoEm) return false;

    const novoStatus = normalizarStatus(remoto.status);
    await db.prontuarios.put({
      ...local,
      pacienteNome: remoto.pacienteNome,
      pacienteDataNascimento: remoto.pacienteDataNascimento ?? local.pacienteDataNascimento,
      status: novoStatus,
      ...camposDeRevisao(remoto),
      vistoPeloAluno: novoStatus === local.status ? local.vistoPeloAluno : false,
      secoes: { ...local.secoes, ...(remoto.secoes ?? {}) },
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
  if (paraTimestamp(resumo.atualizadoEm) <= local.atualizadoEm) return false;
  const pendentes = await db.syncQueue.where("prontuarioId").equals(local.id).count();
  return pendentes === 0;
}

const SIMULTANEOS = 4;

export async function sincronizarParaBaixo(): Promise<void> {
  const resumos = await buscarResumos();
  const alvos: ProntuarioRemotoResumo[] = [];
  for (const r of resumos) {
    if (await precisaAtualizar(r)) alvos.push(r);
  }

  let alterou = false;
  for (let i = 0; i < alvos.length; i += SIMULTANEOS) {
    const lote = alvos.slice(i, i + SIMULTANEOS);
    const resultados = await Promise.allSettled(
      lote.map(async (r) => aplicarRemoto(await buscarDetalhe(r.id))),
    );
    for (const res of resultados) {
      if (res.status === "fulfilled") alterou = alterou || res.value;
      else console.warn("[syncDown] falha ao buscar prontuário:", res.reason);
    }
  }

  try {
    localStorage.setItem(ULTIMO_SYNC_DOWN_KEY, String(Date.now()));
  } catch {
  }
  if (alterou) notifyChanged();
}
