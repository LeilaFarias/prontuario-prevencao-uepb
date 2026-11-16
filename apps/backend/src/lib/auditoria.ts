import { randomUUID } from "node:crypto";
import { executar, type Executor } from "../db";

export async function registrarAuditoria(
  db: Executor,
  usuarioId: string,
  acao: string,
  detalhe: object,
  prontuarioId: string | null = null,
): Promise<void> {
  try {
    await executar(
      db,
      `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), usuarioId, prontuarioId, acao, JSON.stringify(detalhe)],
    );
  } catch (err) {
    console.warn(`[auditoria] falha ao registrar "${acao}":`, err);
  }
}