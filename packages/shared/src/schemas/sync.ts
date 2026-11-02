import { z } from "zod";

export const syncOperationSchema = z.object({
  prontuarioId: z.string().min(1),
  op: z.enum(["create", "update", "delete", "enviar", "reabrir"]),
  entity: z.enum(["prontuario", "secao", "procedimento", "anexo"]),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  ts: z.number().int().nonnegative(),
});

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationSchema).max(500),
});

export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;

export type ErroEnvio = "nao_encontrado" | "ja_enviado" | "professor_nao_encontrado";

export interface ResultadoEnvio {
  ok: boolean;
  erro?: ErroEnvio;
  duplicado?: boolean;
  prontuarioDuplicadoId?: string | null;
  prontuarioDuplicadoCriadoEm?: string | null;
  prontuarioDuplicadoStatus?: string | null;
  professorNome?: string;
}

export interface EnvioSincronizado extends ResultadoEnvio {
  prontuarioId: string;
}

export interface SyncResponse {
  aplicadas: number;
  descartadas: number;
  serverTime: number;
  envios?: EnvioSincronizado[];
}
