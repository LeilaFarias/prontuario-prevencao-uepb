import type { HistoricoProntuario } from "@prontuario/shared";
import { cifrarSecoes, db, type LocalProntuario, type LocalStatus } from "../db/dexie";
import { api, TIMEOUT_SYNC_MS } from "../lib/api";
import { acessoVigente } from "../lib/acesso";
import { avisoJaVisto, marcadorDeAviso } from "../lib/avisosVistos";
import { cifrarCamposPaciente, getChave } from "../lib/chaveLocal";
import { getSession } from "../lib/session";
import { flushAtivoDesde, notifyChanged } from "./queue";

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

type CamposAcessoLocal = Pick<
  LocalProntuario,
  "acessoSolicitadoEm" | "acessoExpiraEm" | "acessoRevogadoEm" | "acessoRecusadoEm"
>;

async function acessoEfetivo(remoto: ProntuarioRemoto): Promise<CamposAcessoLocal> {
  const doServidor: CamposAcessoLocal = {
    acessoSolicitadoEm: remoto.acessoSolicitadoEm ?? undefined,
    acessoExpiraEm: remoto.acessoExpiraEm ?? undefined,
    acessoRevogadoEm: remoto.acessoRevogadoEm ?? undefined,
    acessoRecusadoEm: remoto.acessoRecusadoEm ?? undefined,
  };
  const agora = Date.now();
  if (acessoVigente(doServidor, agora)) return doServidor;

  const revogadoEm = doServidor.acessoRevogadoEm ? new Date(doServidor.acessoRevogadoEm).getTime() : null;
  const liberacoes = await db.liberacoesOffline.where("prontuarioId").equals(remoto.id).toArray();
  const liberacao = liberacoes
    .filter((l) => l.expiresAt > agora && (revogadoEm === null || l.liberadoEm > revogadoEm))
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
  if (!liberacao) return doServidor;

  return {
    acessoSolicitadoEm: undefined,
    acessoExpiraEm: new Date(liberacao.expiresAt).toISOString(),
    acessoRevogadoEm: undefined,
    acessoRecusadoEm: undefined,
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
    await db.transaction("rw", db.professoresLiberacao, async () => {
      await db.professoresLiberacao.where("professorId").noneOf(lista.map((p) => p.professorId)).delete();
      await db.professoresLiberacao.bulkPut(
        lista.map((p) => ({
          professorId: p.professorId,
          nome: p.nome,
          pinHashClient: p.pinHashClient,
          saltClient: p.saltClient,
          sincronizadoEm,
        })),
      );
    });
  } catch (e) {
    console.warn("[syncDown] falha ao buscar professores de liberação:", e);
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
  const chave = getChave();
  if (!chave) return false;
  const remotoEm = paraTimestamp(remoto.atualizadoEm);
  const [secoesCifradas, paciente] = await Promise.all([
    cifrarSecoes(chave, remoto.secoes ?? {}),
    cifrarCamposPaciente(chave, {
      pacienteNome: remoto.pacienteNome,
      pacienteDataNascimento: remoto.pacienteDataNascimento ?? undefined,
    }),
  ]);

  return db.transaction("rw", db.prontuarios, db.syncQueue, db.liberacoesOffline, async () => {
    const local = await db.prontuarios.get(remoto.id);
    if (local?.descartadoEm) return false;
    const acesso = await acessoEfetivo(remoto);

    if (!local) {
      const status = normalizarStatus(remoto.status);
      const visto = avisoJaVisto(
        getSession()?.user.id,
        remoto.id,
        marcadorDeAviso(status, remoto.assinadoEm ?? undefined, remoto.devolvidoEm ?? undefined),
      );
      await db.prontuarios.add({
        id: remoto.id,
        pacienteNome: paciente.pacienteNome,
        pacienteDataNascimento: paciente.pacienteDataNascimento,
        status,
        desfechoEnvio: (remoto.secoes?.conclusao as { tipoDesfecho?: LocalProntuario["desfechoEnvio"] } | undefined)?.tipoDesfecho,
        ...camposDeRevisao(remoto),
        ...camposDeTransferencia(remoto),
        ...acesso,
        vistoPeloAluno: visto,
        secoes: secoesCifradas,
        secoesPendentes: false,
        criadoEm: paraTimestamp(remoto.criadoEm),
        atualizadoEm: remotoEm,
        sincronizado: true,
        conteudoBaixado: true,
        alunoTitularId: remoto.alunoTitularId,
        professorSupervisorId: remoto.professorSupervisorId ?? undefined,
        professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
      });
      return true;
    }

    const novoStatus = normalizarStatus(remoto.status);

    const acessoMudou =
      (acesso.acessoSolicitadoEm ?? null) !== (local.acessoSolicitadoEm ?? null) ||
      (acesso.acessoExpiraEm ?? null) !== (local.acessoExpiraEm ?? null) ||
      (acesso.acessoRevogadoEm ?? null) !== (local.acessoRevogadoEm ?? null) ||
      (acesso.acessoRecusadoEm ?? null) !== (local.acessoRecusadoEm ?? null) ||
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
        desfechoEnvio: (remoto.secoes?.conclusao as { tipoDesfecho?: LocalProntuario["desfechoEnvio"] } | undefined)?.tipoDesfecho,
        ...acesso,
        professorSupervisorId: remoto.professorSupervisorId ?? undefined,
        professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
        sinalizadoDuplicidade: remoto.sinalizadoDuplicidade === 1,
        duplicidadeEmAnalise: remoto.duplicidadeEmAnalise === 1,
        ...camposDeTransferencia(remoto, local),
        vistoPeloAluno: novoStatus === local.status ? local.vistoPeloAluno : false,
      });
      return true;
    }

    if (remotoEm <= local.atualizadoEm && !acessoMudou && !local.secoesPendentes && local.conteudoBaixado) return false;

    await db.prontuarios.put({
      ...local,
      pacienteNome: paciente.pacienteNome,
      pacienteDataNascimento: paciente.pacienteDataNascimento ?? local.pacienteDataNascimento,
      status: novoStatus,
      desfechoEnvio: (remoto.secoes?.conclusao as { tipoDesfecho?: LocalProntuario["desfechoEnvio"] } | undefined)?.tipoDesfecho,
      ...camposDeRevisao(remoto),
      ...camposDeTransferencia(remoto, local),
      ...acesso,
      vistoPeloAluno: novoStatus === local.status ? local.vistoPeloAluno : false,
      secoes: { ...local.secoes, ...secoesCifradas },
      secoesPendentes: false,
      atualizadoEm: remotoEm > 0 ? remotoEm : local.atualizadoEm,
      sincronizado: true,
      conteudoBaixado: true,
      alunoTitularId: remoto.alunoTitularId ?? local.alunoTitularId,
      professorSupervisorId: remoto.professorSupervisorId ?? undefined,
      professorSupervisorNome: remoto.professorSupervisorNome ?? undefined,
    });
    return true;
  });
}

async function precisaAtualizar(resumo: ProntuarioRemotoResumo): Promise<boolean> {
  const local = await db.prontuarios.get(resumo.id);
  if (!local) return true;
  if (local.secoesPendentes && getChave()) return true;
  if (local.sincronizado && !local.conteudoBaixado && !local.descartadoEm) return true;
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
  const desbloqueado = getChave() !== null;
  const alvos: ProntuarioRemotoResumo[] = [];
  if (desbloqueado) {
    for (const r of resumos) {
      if (await precisaAtualizar(r)) alvos.push(r);
    }
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

  if (desbloqueado) {
    try {
      localStorage.setItem(ULTIMO_SYNC_DOWN_KEY, String(Date.now()));
    } catch {
    }
  }
  if (alterou) notifyChanged();
}