import {
  salvarSecaoSchema,
  secoesVazias,
  type EnvioSincronizado,
  type ResultadoEnvio,
  type SecaoId,
  type SyncResponse,
} from "@prontuario/shared";
import { db } from "../db/dexie";
import type { LocalProntuario, LocalSyncOp } from "../db/dexie";
import { ApiError, api, TIMEOUT_FLUSH_MS } from "../lib/api";
import { ACESSO_EXPIRADO_EVENT, acessoVigente } from "../lib/acesso";
import { marcadorDeAviso, registrarAvisoVisto } from "../lib/avisosVistos";
import { getSession } from "../lib/session";
import { uuid } from "../lib/uuid";

export const SYNC_EVENT = "sync:changed";
export const ULTIMO_SALVAMENTO_KEY = "prontuario:ultimoSalvamento";

const INTERVALO_MS = 30_000;
const DEBOUNCE_ONLINE_MS = 2_000;
const LOTE = 200;
const OPS_SUPORTADAS: ReadonlySet<string> = new Set([
  "create",
  "update",
  "delete",
  "enviar",
  "reabrir",
  "descartar",
]);
const ACESSO_DURACAO_MS = 4 * 60 * 60 * 1000;

function registrarSalvamento(ts: number): void {
  try {
    localStorage.setItem(ULTIMO_SALVAMENTO_KEY, String(ts));
  } catch {
  }
}

export function notifyChanged(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

function ownerAtual(): string | null {
  return getSession()?.user.id ?? null;
}

export function contarPendentes(): Promise<number> {
  const ownerId = ownerAtual();
  if (!ownerId) return Promise.resolve(0);
  return db.syncQueue
    .where("ownerId")
    .equals(ownerId)
    .filter((o) => o.status === "pending" || o.status === "in_flight")
    .count();
}

export async function enqueue(
  op: Omit<LocalSyncOp, "id" | "operationId" | "ownerId" | "status" | "retryCount">,
): Promise<number> {
  const ownerId = ownerAtual() ?? "legacy";
  return db.syncQueue.add({
    ...op,
    operationId: uuid(),
    ownerId,
    status: "pending",
    retryCount: 0,
  });
}

function paraEnvio(op: LocalSyncOp): Record<string, unknown> {
  const { id: _id, status: _status, retryCount: _retry, ownerId: _owner, ...resto } = op;
  return resto;
}

export async function criarProntuarioLocal(alunoTitularId: string): Promise<string> {
  const id = uuid();
  const agora = Date.now();
  const acessoExpiraEm = new Date(agora + ACESSO_DURACAO_MS).toISOString();
  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    await db.prontuarios.add({
      id,
      pacienteNome: "",
      status: "em_andamento",
      secoes: {},
      criadoEm: agora,
      atualizadoEm: agora,
      sincronizado: false,
      alunoTitularId,
      acessoExpiraEm,
    });
    await enqueue({
      prontuarioId: id,
      op: "create",
      entity: "prontuario",
      entityId: id,
      payload: { pacienteNome: "", status: "em_andamento", alunoTitularId, criadoEm: agora },
      ts: agora,
    });
  });
  registrarSalvamento(agora);
  notifyChanged();
  void flush();
  return id;
}

export class AcessoExpiradoError extends Error {
  constructor() {
    super("O acesso temporário expirou.");
  }
}

export interface CabecalhoPaciente {
  pacienteNome?: string;
  pacienteDataNascimento?: string;
}

export async function salvarSecaoLocal(
  prontuarioId: string,
  secaoId: SecaoId,
  conteudo: Record<string, unknown>,
  cabecalho?: CabecalhoPaciente,
): Promise<void> {
  const dados = salvarSecaoSchema.parse({ prontuarioId, secaoId, conteudo });
  const agora = Date.now();
  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const atual = await db.prontuarios.get(dados.prontuarioId);
    if (!atual) throw new Error("Prontuário não encontrado no aparelho");
    if (atual.status === "transferido") throw new Error("Prontuário transferido é somente leitura");
    if (
      (atual.status === "enviado" || atual.status === "assinado") &&
      !acessoVigente(atual, agora)
    ) {
      throw new AcessoExpiradoError();
    }

    const nome = cabecalho?.pacienteNome?.trim();
    const novoNome =
      nome && nome.length >= 2 && nome !== atual.pacienteNome ? nome : undefined;
    const nascimento = cabecalho?.pacienteDataNascimento?.trim();
    const novoNascimento =
      nascimento &&
      /^\d{4}-\d{2}-\d{2}$/.test(nascimento) &&
      nascimento !== atual.pacienteDataNascimento
        ? nascimento
        : undefined;

    await db.prontuarios.put({
      ...atual,
      ...(atual.status === "assinado"
        ? {
            status: "em_andamento" as const,
            assinadoEm: undefined,
            assinadoPorNome: undefined,
            acessoSolicitadoEm: undefined,
          }
        : {}),
      ...(novoNome ? { pacienteNome: novoNome } : {}),
      ...(novoNascimento ? { pacienteDataNascimento: novoNascimento } : {}),
      secoes: { ...atual.secoes, [dados.secaoId]: dados.conteudo },
      atualizadoEm: agora,
      sincronizado: false,
    });

    if (novoNome || novoNascimento) {
      await enqueue({
        prontuarioId: dados.prontuarioId,
        op: "update",
        entity: "prontuario",
        entityId: dados.prontuarioId,
        payload: {
          ...(novoNome ? { pacienteNome: novoNome } : {}),
          ...(novoNascimento ? { pacienteDataNascimento: novoNascimento } : {}),
        },
        ts: agora,
      });
    }

    const entityIdSecao = `${dados.prontuarioId}:${dados.secaoId}`;
    const obsoletas = await db.syncQueue
      .where("prontuarioId")
      .equals(dados.prontuarioId)
      .filter(
        (o) =>
          o.entity === "secao" &&
          o.entityId === entityIdSecao &&
          o.op === "update" &&
          o.status === "pending",
      )
      .primaryKeys();
    if (obsoletas.length > 0) await db.syncQueue.bulkDelete(obsoletas);

    await enqueue({
      prontuarioId: dados.prontuarioId,
      op: "update",
      entity: "secao",
      entityId: entityIdSecao,
      payload: { secaoId: dados.secaoId, conteudo: dados.conteudo },
      ts: agora,
    });
  });
  registrarSalvamento(agora);
  notifyChanged();
  void flush();
}

let emVoo: Promise<void> | null = null;
let ultimoFlushConcluidoEm = 0;
let filaPreparada = false;
let retryTimer: number | undefined;

export function flushAtivoDesde(ts: number): boolean {
  return emVoo !== null || ultimoFlushConcluidoEm >= ts;
}

function agendarRetry(delayMs: number): void {
  if (retryTimer !== undefined) window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    void flush();
  }, delayMs);
}

async function normalizarFilaV6(): Promise<void> {
  const ownerId = ownerAtual() ?? "legacy";
  await db.syncQueue.toCollection().modify((op: Partial<LocalSyncOp>) => {
    if (!op.operationId) op.operationId = uuid();
    if (!op.ownerId) op.ownerId = ownerId;
    if (!op.status) op.status = "pending";
    if (op.retryCount === undefined) op.retryCount = 0;
  });
}

async function recuperarInFlight(): Promise<void> {
  await db.syncQueue
    .where("status")
    .equals("in_flight")
    .modify((op) => {
      op.status = "pending";
    });
}

async function prepararFila(): Promise<boolean> {
  if (filaPreparada) return true;
  try {
    await normalizarFilaV6();
    await recuperarInFlight();
    filaPreparada = true;
    return true;
  } catch {
    return false;
  }
}

export function flush(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  if (emVoo) return emVoo;
  emVoo = (async () => {
    if (!(await prepararFila())) return;
    await executarDrain();
  })().finally(() => {
    emVoo = null;
    ultimoFlushConcluidoEm = Date.now();
  });
  return emVoo;
}

export function drain(): Promise<void> {
  return flush();
}

async function executarDrain(): Promise<void> {
  const ownerId = ownerAtual();
  if (!ownerId) return;

  await db.syncQueue
    .filter((o) => o.ownerId === ownerId && !OPS_SUPORTADAS.has(o.op))
    .delete();

  for (let primeira = true; ; primeira = false) {
    const lote = await db.syncQueue
      .where("ownerId")
      .equals(ownerId)
      .filter((o) => o.status === "pending")
      .limit(LOTE)
      .toArray();

    const liberacoes = primeira
      ? await db.liberacoesOffline.filter((l) => !l.sincronizado).toArray()
      : [];

    if (lote.length === 0 && liberacoes.length === 0) break;

    await Promise.all(
      lote.map((o) => db.syncQueue.update(o.id!, { status: "in_flight" })),
    );

    const prontCache = new Map<string, LocalProntuario | undefined>();
    const getPront = async (pid: string): Promise<LocalProntuario | undefined> => {
      if (prontCache.has(pid)) return prontCache.get(pid);
      const p = await db.prontuarios.get(pid);
      prontCache.set(pid, p);
      return p;
    };

    const enviar: LocalSyncOp[] = [];
    for (const op of lote) {
      const p = await getPront(op.prontuarioId);
      if (!p) {
        enviar.push(op);
        continue;
      }
      const bloqueado =
        (p.status === "enviado" || p.status === "assinado") &&
        !acessoVigente(p, op.ts);
      if (!bloqueado) enviar.push(op);
    }

    if (enviar.length === 0 && liberacoes.length === 0) {
      await Promise.all(
        lote.map((o) => db.syncQueue.update(o.id!, { status: "pending" })),
      );
      break;
    }

    let resposta: SyncResponse;
    try {
      resposta = await api.post(
        "/sync",
        {
          operations: [
            ...enviar.map(paraEnvio),
            ...liberacoes.map((l) => ({
              prontuarioId: l.prontuarioId,
              op: "liberacao-offline" as const,
              entity: "prontuario" as const,
              entityId: l.id,
              payload: {
                professorId: l.professorId,
                prontuarioId: l.prontuarioId,
                liberadoEm: l.liberadoEm,
                expiresAt: l.expiresAt,
              },
              ts: l.liberadoEm,
            })),
          ],
        },
        { timeoutMs: TIMEOUT_FLUSH_MS },
      );
    } catch (err) {
      const retryCount = Math.max(...lote.map((o) => o.retryCount ?? 0));
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await Promise.all(
          lote.map((o) => db.syncQueue.update(o.id!, { status: "failed" })),
        );
      } else {
        await Promise.all(
          lote.map((o) =>
            db.syncQueue.update(o.id!, {
              status: "pending",
              retryCount: retryCount + 1,
            }),
          ),
        );
        agendarRetry(Math.min(60_000, 1_000 * 2 ** retryCount));
      }
      break;
    }

    if (liberacoes.length > 0) {
      await Promise.all(
        liberacoes.map((l) => db.liberacoesOffline.update(l.id, { sincronizado: true })),
      );
    }

    const bloqueadasBackend = new Set(resposta.acessoExpirado ?? []);
    const apagar = enviar.filter((op) => !bloqueadasBackend.has(op.prontuarioId));
    if (apagar.length > 0) {
      await db.syncQueue.bulkDelete(apagar.map((o) => o.id!));
    }

    const restantesLote = lote.filter((o) => !apagar.some((a) => a.id === o.id));
    if (restantesLote.length > 0) {
      await Promise.all(
        restantesLote.map((o) => db.syncQueue.update(o.id!, { status: "pending" })),
      );
    }

    await tratarEnviosRecusados(resposta.envios ?? []);
    if (bloqueadasBackend.size > 0) {
      await tratarAcessosExpirados([...bloqueadasBackend]);
    }

    for (const pid of new Set(enviar.map((o) => o.prontuarioId))) {
      const restantes = await db.syncQueue.where("prontuarioId").equals(pid).count();
      if (restantes === 0) await db.prontuarios.update(pid, { sincronizado: true });
    }
    notifyChanged();
    if (apagar.length === 0) break;
  }
}

async function tratarEnviosRecusados(envios: EnvioSincronizado[]): Promise<void> {
  for (const e of envios) {
    if (e.ok && e.duplicado) {
      await db.prontuarios.update(e.prontuarioId, { sinalizadoDuplicidade: true });
    }
    if (e.ok || e.erro === "ja_enviado") continue;
    await db.prontuarios
      .where("id")
      .equals(e.prontuarioId)
      .modify((p) => {
        p.status = "em_andamento";
        p.atualizadoEm = Date.now();
        p.erroEnvio =
          e.erro === "professor_nao_encontrado" ? "professor_nao_encontrado" : "falha";
      });
  }
}

async function tratarAcessosExpirados(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  window.dispatchEvent(new CustomEvent(ACESSO_EXPIRADO_EVENT));
}

export type ResultadoEnvioLocal =
  | { tipo: "enviado"; resultado: ResultadoEnvio; enviadoEm: number }
  | { tipo: "offline"; salvoEm: number }
  | { tipo: "professor_nao_encontrado" }
  | { tipo: "erro"; mensagem: string };

const esperar = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function marcarEnviadoLocal(
  prontuarioId: string,
  sincronizado: boolean,
  ts: number,
  duplicado?: boolean,
): Promise<void> {
  await db.prontuarios
    .where("id")
    .equals(prontuarioId)
    .modify((p) => {
      p.status = "enviado";
      p.atualizadoEm = ts;
      p.sincronizado = sincronizado;
      if (duplicado !== undefined) p.sinalizadoDuplicidade = duplicado;
      delete p.erroEnvio;
    });
}

async function enfileirarEnvio(prontuarioId: string): Promise<number> {
  const agora = Date.now();
  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const naFila = await db.syncQueue.where("prontuarioId").equals(prontuarioId).toArray();
    const ts = Math.max(agora, ...naFila.map((o) => o.ts + 1));
    await marcarEnviadoLocal(prontuarioId, false, ts);
    if (!naFila.some((o) => o.op === "enviar" && o.status === "pending")) {
      await enqueue({
        prontuarioId,
        op: "enviar",
        entity: "prontuario",
        entityId: prontuarioId,
        payload: {},
        ts,
      });
    }
  });
  registrarSalvamento(agora);
  notifyChanged();
  void flush();
  return agora;
}

export async function enviarAoProfessor(prontuarioId: string): Promise<ResultadoEnvioLocal> {
  if (!navigator.onLine) {
    return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };
  }

  let pendentes = 0;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await flush();
    pendentes = await db.syncQueue.where("prontuarioId").equals(prontuarioId).count();
    if (pendentes === 0) break;
    await esperar(400);
  }
  if (pendentes > 0) {
    return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };
  }

  try {
    const resultado = (await api.post(
  `/prontuarios/${encodeURIComponent(prontuarioId)}/enviar`,
  {},
)) as ResultadoEnvio;
    if (!resultado.ok) {
      if (resultado.erro === "professor_nao_encontrado") {
        return { tipo: "professor_nao_encontrado" };
      }
      return { tipo: "erro", mensagem: "Não foi possível enviar o prontuário. Tente novamente." };
    }
    const enviadoEm = Date.now();
    await marcarEnviadoLocal(prontuarioId, true, enviadoEm, Boolean(resultado.duplicado));
    notifyChanged();
    return { tipo: "enviado", resultado, enviadoEm };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 0) {
        return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };
      }
      if (err.status === 409) {
        await marcarEnviadoLocal(prontuarioId, true, Date.now());
        notifyChanged();
      }
      return { tipo: "erro", mensagem: err.message };
    }
    return { tipo: "erro", mensagem: "Não foi possível enviar o prontuário. Tente novamente." };
  }
}

export async function reabrirParaCorrecao(prontuarioId: string): Promise<void> {
  const agora = Date.now();
  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const atual = await db.prontuarios.get(prontuarioId);
    if (!atual || atual.status !== "devolvido") return;
    await db.prontuarios.put({
      ...atual,
      status: "em_andamento",
      devolvidoEm: undefined,
      devolvidoPorNome: undefined,
      motivoDevolucao: undefined,
      comentarioDevolucao: undefined,
      vistoPeloAluno: true,
      atualizadoEm: agora,
      sincronizado: false,
    });
    await enqueue({
      prontuarioId,
      op: "reabrir",
      entity: "prontuario",
      entityId: prontuarioId,
      payload: {},
      ts: agora,
    });
  });
  registrarSalvamento(agora);
  notifyChanged();
  void flush();
}

export function podeDescartarRascunho(
  p: Pick<LocalProntuario, "status" | "pacienteNome" | "pacienteDataNascimento" | "secoes" | "descartadoEm">,
): boolean {
  return (
    p.status === "em_andamento" &&
    !p.descartadoEm &&
    p.pacienteNome.trim() === "" &&
    !p.pacienteDataNascimento &&
    secoesVazias(Object.values(p.secoes))
  );
}

export async function descartarRascunhoLocal(prontuarioId: string): Promise<boolean> {
  const agora = Date.now();
  const descartado = await db.transaction(
    "rw",
    db.prontuarios,
    db.syncQueue,
    async () => {
      const atual = await db.prontuarios.get(prontuarioId);
      if (!atual || !podeDescartarRascunho(atual)) return false;
      const naFila = await db.syncQueue.where("prontuarioId").equals(prontuarioId).toArray();
      const ts = Math.max(agora, ...naFila.map((o) => o.ts + 1));
      await db.prontuarios.update(prontuarioId, {
        descartadoEm: new Date(ts).toISOString(),
        atualizadoEm: ts,
        sincronizado: false,
      });
      await enqueue({
        prontuarioId,
        op: "descartar",
        entity: "prontuario",
        entityId: prontuarioId,
        payload: {},
        ts,
      });
      return true;
    },
  );
  if (descartado) {
    registrarSalvamento(agora);
    notifyChanged();
    void flush();
  }
  return descartado;
}

export async function liberarAcessoOffline(
  prontuarioId: string,
  professorId: string,
): Promise<string> {
  const alunoId = getSession()?.user.id;
  if (!alunoId) throw new Error("Sessão não encontrada");
  const agora = Date.now();
  const expiresAt = agora + ACESSO_DURACAO_MS;
  const acessoExpiraEm = new Date(expiresAt).toISOString();
  await db.transaction("rw", db.prontuarios, db.liberacoesOffline, async () => {
    await db.liberacoesOffline.add({
      id: crypto.randomUUID(),
      alunoId,
      professorId,
      prontuarioId,
      liberadoEm: agora,
      expiresAt,
      sincronizado: false,
    });
    await db.prontuarios.update(prontuarioId, {
      acessoExpiraEm,
      acessoRevogadoEm: undefined,
      acessoRecusadoEm: undefined,
    });
  });
  registrarSalvamento(agora);
  notifyChanged();
  void flush();
  return acessoExpiraEm;
}

export async function marcarComoVisto(prontuarioId: string): Promise<void> {
  const p = await db.prontuarios.get(prontuarioId);
  await db.prontuarios.update(prontuarioId, { vistoPeloAluno: true });
  if (p) {
    registrarAvisoVisto(
      getSession()?.user.id,
      prontuarioId,
      marcadorDeAviso(p.status, p.assinadoEm, p.devolvidoEm),
    );
  }
}

let iniciado = false;
let agendadoOnline: number | undefined;

export function startSyncLoop(): void {
  if (iniciado) return;
  iniciado = true;
  window.setInterval(() => void flush(), INTERVALO_MS);
  window.addEventListener("online", () => {
    window.clearTimeout(agendadoOnline);
    agendadoOnline = window.setTimeout(() => void flush(), DEBOUNCE_ONLINE_MS);
  });
  void flush();
}