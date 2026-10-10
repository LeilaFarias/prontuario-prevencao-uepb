import {
  criarProntuarioSchema,
  salvarSecaoSchema,
  type SecaoId,
  type SyncResponse,
} from "@prontuario/shared";
import { db } from "../db/dexie";
import { api } from "../lib/api";

export const SYNC_EVENT = "sync:changed";
export const ULTIMO_SALVAMENTO_KEY = "prontuario:ultimoSalvamento";
const INTERVALO_MS = 30_000;
const LOTE = 200;

function registrarSalvamento(ts: number): void {
  try {
    localStorage.setItem(ULTIMO_SALVAMENTO_KEY, String(ts));
  } catch {
    // armazenamento indisponível: a pill apenas não mostra a hora
  }
}

export function notifyChanged(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function contarPendentes(): Promise<number> {
  return db.syncQueue.count();
}

// crypto.randomUUID só existe em contexto seguro (https/localhost)
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function criarProntuarioLocal(pacienteNome: string, alunoTitularId: string): Promise<string> {
  const id = uuid();
  const dados = criarProntuarioSchema.parse({ id, pacienteNome });
  const agora = Date.now();

  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    await db.prontuarios.add({
      id,
      pacienteNome: dados.pacienteNome,
      status: "em_andamento",
      secoes: {},
      criadoEm: agora,
      atualizadoEm: agora,
      sincronizado: false,
      alunoTitularId,
    });
    await db.syncQueue.add({
      prontuarioId: id,
      op: "create",
      entity: "prontuario",
      entityId: id,
      payload: {
        pacienteNome: dados.pacienteNome,
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

export async function salvarSecaoLocal(
  prontuarioId: string,
  secaoId: SecaoId,
  conteudo: Record<string, unknown>,
): Promise<void> {
  const dados = salvarSecaoSchema.parse({ prontuarioId, secaoId, conteudo });
  const agora = Date.now();

  await db.transaction("rw", db.prontuarios, db.syncQueue, async () => {
    const atual = await db.prontuarios.get(dados.prontuarioId);
    if (!atual) throw new Error("Prontuário não encontrado no aparelho");
    await db.prontuarios.put({
      ...atual,
      secoes: { ...atual.secoes, [dados.secaoId]: dados.conteudo },
      atualizadoEm: agora,
      sincronizado: false,
    });
    await db.syncQueue.add({
      prontuarioId: dados.prontuarioId,
      op: "update",
      entity: "secao",
      entityId: `${dados.prontuarioId}:${dados.secaoId}`,
      payload: { secaoId: dados.secaoId, conteudo: dados.conteudo },
      ts: agora,
    });
  });

  registrarSalvamento(agora);
  notifyChanged();
  void flush();
}

let enviando = false;

/** Envia a fila ao servidor. Em caso de falha, os itens permanecem para o próximo ciclo. */
export async function flush(): Promise<void> {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    for (;;) {
      const lote = await db.syncQueue.toCollection().limit(LOTE).toArray();
      if (lote.length === 0) break;

      await api.post<SyncResponse>("/sync", {
        operations: lote.map(({ id: _id, ...op }) => op),
      });

      await db.syncQueue.bulkDelete(lote.map((o) => o.id!));

      for (const pid of new Set(lote.map((o) => o.prontuarioId))) {
        const restantes = await db.syncQueue.where("prontuarioId").equals(pid).count();
        if (restantes === 0) await db.prontuarios.update(pid, { sincronizado: true });
      }
      notifyChanged();
    }
  } catch {
    // mantém a fila; tenta de novo no próximo ciclo ou quando voltar online
  } finally {
    enviando = false;
  }
}

let iniciado = false;

export function startSyncLoop(): void {
  if (iniciado) return;
  iniciado = true;
  window.setInterval(() => void flush(), INTERVALO_MS);
  window.addEventListener("online", () => void flush());
  void flush();
}
