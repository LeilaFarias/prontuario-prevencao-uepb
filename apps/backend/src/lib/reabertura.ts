import type { DatabaseSync } from "node:sqlite";

export type ResultadoReabertura = "ok" | "nao_encontrado" | "nao_devolvido";

export function reabrirProntuario(db: DatabaseSync, prontuarioId: string, alunoId: string): ResultadoReabertura {
  const pront = db
    .prepare("SELECT status FROM Prontuario WHERE id = ? AND alunoTitularId = ?")
    .get(prontuarioId, alunoId) as unknown as { status: string } | undefined;
  if (!pront) return "nao_encontrado";
  if (pront.status.toUpperCase() !== "DEVOLVIDO") return "nao_devolvido";

  db.prepare(
    `UPDATE Prontuario
     SET status = 'EM_ANDAMENTO',
         devolvidoEm = NULL, devolvidoPorId = NULL, devolvidoPorNome = NULL,
         motivoDevolucao = NULL, comentarioDevolucao = NULL,
         atualizadoEm = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), prontuarioId);
  return "ok";
}
