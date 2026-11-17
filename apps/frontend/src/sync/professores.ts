import { db, type LocalProfessor } from "../db/dexie";
import { api, TIMEOUT_SYNC_MS } from "../lib/api";
import { getSession } from "../lib/session";

interface ProfessorRemoto {
  id: string;
  nome: string;
  matricula: string | null;
}

export async function atualizarCacheProfessores(): Promise<void> {
  if (!navigator.onLine || !getSession()) return;
  try {
    const lista = await api.get<ProfessorRemoto[]>("/professores", { timeoutMs: TIMEOUT_SYNC_MS });
    const professores: LocalProfessor[] = lista.flatMap((p) =>
      p.matricula ? [{ id: p.id, nome: p.nome, matricula: String(p.matricula).trim() }] : [],
    );
    await db.professores.bulkPut(professores);
  } catch {
  }
}

export async function buscarProfessorPorMatricula(matricula: string): Promise<LocalProfessor | undefined> {
  const consultar = () => db.professores.where("matricula").equals(matricula).first();
  const encontrado = await consultar();
  if (encontrado || !navigator.onLine) return encontrado;
  await atualizarCacheProfessores();
  return consultar();
}
