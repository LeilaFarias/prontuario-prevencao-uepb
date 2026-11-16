import { executar, uma, type Executor } from "../db";

export type ResultadoReabertura = "ok" | "nao_encontrado" | "nao_devolvido";

export async function reabrirProntuario(db: Executor, prontuarioId: string, alunoId: string): Promise<ResultadoReabertura> {
  const pront = await uma<{ status: string }>(
    db,
    `SELECT "status" FROM "Prontuario" WHERE "id" = $1 AND "alunoTitularId" = $2 FOR UPDATE`,
    [prontuarioId, alunoId],
  );
  if (!pront) return "nao_encontrado";
  if (pront.status.toUpperCase() !== "DEVOLVIDO") return "nao_devolvido";

  await executar(
    db,
    `UPDATE "Prontuario"
     SET "status" = 'EM_ANDAMENTO',
         "devolvidoEm" = NULL, "devolvidoPorId" = NULL, "devolvidoPorNome" = NULL,
         "motivoDevolucao" = NULL, "comentarioDevolucao" = NULL,
         "atualizadoEm" = $1
     WHERE "id" = $2`,
    [new Date().toISOString(), prontuarioId],
  );
  return "ok";
}
