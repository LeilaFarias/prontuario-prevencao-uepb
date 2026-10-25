import { db, type LocalProntuario, type LocalStatus } from "../db/dexie";
import { api } from "../lib/api";
import { notifyChanged } from "./queue";

export const ULTIMO_SYNC_DOWN_KEY = "prontuario:ultimoSyncDown";

/** Resposta de GET /prontuarios (sem seções). */
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

/** Resposta de GET /prontuarios/:id (com seções já decodificadas). */
export interface ProntuarioRemoto extends ProntuarioRemotoResumo {
  secoes: Record<string, unknown>;
}

const STATUS_VALIDOS: ReadonlySet<string> = new Set<LocalStatus>([
  "em_andamento",
  "enviado",
  "assinado",
  "devolvido",
]);

/** Backend usa MAIÚSCULAS (EM_ANDAMENTO); o Dexie usa minúsculas (em_andamento). */
export function normalizarStatus(s: string): LocalProntuario["status"] {
  const v = s.trim().toLowerCase();
  return STATUS_VALIDOS.has(v) ? (v as LocalStatus) : "em_andamento";
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

/**
 * Grava no Dexie o prontuário vindo do servidor, respeitando as edições locais.
 *
 * A checagem da fila e a escrita acontecem na MESMA transação: assim uma edição que
 * entre na fila durante o sync down não é sobrescrita (regra crítica de merge).
 *
 * @returns true se o Dexie foi alterado.
 */
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
        secoes: remoto.secoes ?? {},
        criadoEm: paraTimestamp(remoto.criadoEm),
        atualizadoEm: remotoEm,
        sincronizado: true, // já veio do servidor
        alunoTitularId: remoto.alunoTitularId,
      });
      return true;
    }

    // Edições pendentes: o local vence e será enviado pela fila.
    const pendentes = await db.syncQueue.where("prontuarioId").equals(local.id).count();
    if (pendentes > 0) return false;

    // Local igual ou mais recente: mantém.
    if (remotoEm <= local.atualizadoEm) return false;

    await db.prontuarios.put({
      ...local,
      pacienteNome: remoto.pacienteNome,
      pacienteDataNascimento: remoto.pacienteDataNascimento ?? local.pacienteDataNascimento,
      status: normalizarStatus(remoto.status),
      // Sem pendências, tudo o que existe localmente já foi enviado; o servidor tem prioridade por seção.
      secoes: { ...local.secoes, ...(remoto.secoes ?? {}) },
      atualizadoEm: remotoEm,
      sincronizado: true,
      alunoTitularId: remoto.alunoTitularId,
    });
    return true;
  });
}

/** Decide, só pelo resumo, se vale buscar o detalhe (novo ou mais recente que o local). */
async function precisaAtualizar(resumo: ProntuarioRemotoResumo): Promise<boolean> {
  const local = await db.prontuarios.get(resumo.id);
  if (!local) return true;
  if (paraTimestamp(resumo.atualizadoEm) <= local.atualizadoEm) return false;
  const pendentes = await db.syncQueue.where("prontuarioId").equals(local.id).count();
  return pendentes === 0;
}

const SIMULTANEOS = 4;

/**
 * Sync down completo: lista no servidor e traz (com seções) apenas o que é novo ou mais recente.
 * Lança erro se a LISTA falhar; falhas no detalhe de um prontuário só pulam aquele item.
 */
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
    // armazenamento indisponível: apenas não registra a hora
  }
  if (alterou) notifyChanged();
}
