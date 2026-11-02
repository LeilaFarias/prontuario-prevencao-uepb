import {
  salvarSecaoSchema,
  type EnvioSincronizado,
  type ResultadoEnvio,
  type SecaoId,
  type SyncResponse,
} from "@prontuario/shared";
import { db } from "../db/dexie";
import type { LocalProntuario } from "../db/dexie";
import { ApiError, api } from "../lib/api";
import { ACESSO_EXPIRADO_EVENT, acessoVigente } from "../lib/acesso";
import { uuid } from "../lib/uuid";

export const SYNC_EVENT = "sync:changed";
export const ULTIMO_SALVAMENTO_KEY = "prontuario:ultimoSalvamento";
const INTERVALO_MS = 30_000;
const LOTE = 200;
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

export function contarPendentes(): Promise<number> {
  return db.syncQueue.count();
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
    await db.syncQueue.add({
      prontuarioId: id,
      op: "create",
      entity: "prontuario",
      entityId: id,
      payload: {
        pacienteNome: "",
        status: "em_andamento",
        alunoTitularId,
        criadoEm: agora,
      },
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

    const invalidaAssinatura = atual.status === "assinado";
    if (invalidaAssinatura && !acessoVigente(atual, agora)) throw new AcessoExpiradoError();

    const nome = cabecalho?.pacienteNome?.trim();
    const novoNome = nome && nome.length >= 2 && nome !== atual.pacienteNome ? nome : undefined;
    const nascimento = cabecalho?.pacienteDataNascimento?.trim();
    const novoNascimento =
      nascimento && /^\d{4}-\d{2}-\d{2}$/.test(nascimento) && nascimento !== atual.pacienteDataNascimento
        ? nascimento
        : undefined;

    await db.prontuarios.put({
      ...atual,
      ...(invalidaAssinatura
        ? {
            status: "em_andamento" as const,
            assinadoEm: undefined,
            assinadoPorNome: undefined,
            acessoSolicitadoEm: undefined,
            acessoExpiraEm: undefined,
            acessoRevogadoEm: undefined,
          }
        : {}),
      ...(novoNome ? { pacienteNome: novoNome } : {}),
      ...(novoNascimento ? { pacienteDataNascimento: novoNascimento } : {}),
      secoes: { ...atual.secoes, [dados.secaoId]: dados.conteudo },
      atualizadoEm: agora,
      sincronizado: false,
    });

    if (novoNome || novoNascimento) {
      await db.syncQueue.add({
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
      .filter((o) => o.entity === "secao" && o.entityId === entityIdSecao && o.op === "update")
      .primaryKeys();
    if (obsoletas.length > 0) await db.syncQueue.bulkDelete(obsoletas);

    await db.syncQueue.add({
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

export function flush(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  if (emVoo) return emVoo;
  emVoo = executarFlush().finally(() => {
    emVoo = null;
  });
  return emVoo;
}

async function executarFlush(): Promise<void> {
  try {
    for (;;) {
      const lote = await db.syncQueue.toCollection().limit(LOTE).toArray();
      if (lote.length === 0) break;

      const prontCache = new Map<string, LocalProntuario | undefined>();

      const getPront = async (pid: string): Promise<LocalProntuario | undefined> => {
        if (prontCache.has(pid)) return prontCache.get(pid);
        const p = await db.prontuarios.get(pid);
        prontCache.set(pid, p);
        return p;
      };

      const enviar: typeof lote = [];
      for (const op of lote) {
        const p = await getPront(op.prontuarioId);
        if (!p) {
          enviar.push(op);
          continue;
        }
        const bloqueado =
          (p.status === "enviado" || p.status === "assinado") && !acessoVigente(p, op.ts);
        if (!bloqueado) enviar.push(op);
      }

      if (enviar.length === 0) break; 

      const resposta = await api.post<SyncResponse>("/sync", {
        operations: enviar.map(({ id: _id, ...op }) => op),
      });

      const bloqueadasBackend = new Set(resposta.acessoExpirado ?? []);
      const apagar = enviar.filter((op) => !bloqueadasBackend.has(op.prontuarioId));
      if (apagar.length > 0) {
        await db.syncQueue.bulkDelete(apagar.map((o) => o.id!));
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
  } catch {
  }
}

async function tratarEnviosRecusados(envios: EnvioSincronizado[]): Promise<void> {
  for (const e of envios) {
    if (e.ok || e.erro === "ja_enviado") continue;
    await db.prontuarios
      .where("id")
      .equals(e.prontuarioId)
      .modify((p) => {
        p.status = "em_andamento";
        p.atualizadoEm = Date.now();
        p.erroEnvio = e.erro === "professor_nao_encontrado" ? "professor_nao_encontrado" : "falha";
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

async function marcarEnviadoLocal(prontuarioId: string, sincronizado: boolean, ts: number): Promise<void> {
  await db.prontuarios
    .where("id")
    .equals(prontuarioId)
    .modify((p) => {
      p.status = "enviado";
      p.atualizadoEm = ts;
      p.sincronizado = sincronizado;
      delete p.erroEnvio;
    });
}

async function enfileirarEnvio(prontuarioId: string): Promise<number> {
  const agora = Date.now();

  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const naFila = await db.syncQueue.where("prontuarioId").equals(prontuarioId).toArray();
    const ts = Math.max(agora, ...naFila.map((o) => o.ts + 1)); 
    await marcarEnviadoLocal(prontuarioId, false, ts);
    if (!naFila.some((o) => o.op === "enviar")) {
      await db.syncQueue.add({
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
  if (!navigator.onLine) return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };

  let pendentes = 0;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await flush();
    pendentes = await db.syncQueue.where("prontuarioId").equals(prontuarioId).count();
    if (pendentes === 0) break;
    await esperar(400);
  }
  if (pendentes > 0) return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };

  try {
    const resultado = await api.post<ResultadoEnvio>(`/prontuarios/${encodeURIComponent(prontuarioId)}/enviar`, {});
    if (!resultado.ok) {
      if (resultado.erro === "professor_nao_encontrado") return { tipo: "professor_nao_encontrado" };
      return { tipo: "erro", mensagem: "Não foi possível enviar o prontuário. Tente novamente." };
    }
    const enviadoEm = Date.now();
    await marcarEnviadoLocal(prontuarioId, true, enviadoEm);
    notifyChanged();
    return { tipo: "enviado", resultado, enviadoEm };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 0) return { tipo: "offline", salvoEm: await enfileirarEnvio(prontuarioId) };
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
    await db.syncQueue.add({
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

export async function marcarComoVisto(prontuarioId: string): Promise<void> {
  await db.prontuarios.update(prontuarioId, { vistoPeloAluno: true });
}

let iniciado = false;

export function startSyncLoop(): void {
  if (iniciado) return;
  iniciado = true;
  window.setInterval(() => void flush(), INTERVALO_MS);
  window.addEventListener("online", () => void flush());
  void flush();
}