import {
  salvarSecaoSchema,
  type SecaoId,
  type SyncResponse,
} from "@prontuario/shared";
import { db } from "../db/dexie";
import { api } from "../lib/api";
import { uuid } from "../lib/uuid";

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

export async function criarProntuarioLocal(alunoTitularId: string): Promise<string> {
  const id = uuid();
  const agora = Date.now();

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

    // Só entra no cabeçalho o que é válido e realmente mudou (vazio nunca apaga o nome/nascimento)
    const nome = cabecalho?.pacienteNome?.trim();
    const novoNome = nome && nome.length >= 2 && nome !== atual.pacienteNome ? nome : undefined;
    const nascimento = cabecalho?.pacienteDataNascimento?.trim();
    const novoNascimento =
      nascimento && /^\d{4}-\d{2}-\d{2}$/.test(nascimento) && nascimento !== atual.pacienteDataNascimento
        ? nascimento
        : undefined;

    await db.prontuarios.put({
      ...atual,
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

    // Cada operação de seção leva o conteúdo COMPLETO (upsert). Ops pendentes da mesma seção ficam
    // obsoletas: mantê-las só incharia a fila (e o corpo do /sync, se a seção tiver foto).
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
