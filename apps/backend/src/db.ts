import pg from "pg";
import type { Pool as PgPool, PoolClient, QueryResult } from "pg";
import { env } from "./env";

const { Pool, types } = pg;

const lerTimestamptz = types.getTypeParser(types.builtins.TIMESTAMPTZ);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (valor: string) => (lerTimestamptz(valor) as Date).toISOString());
types.setTypeParser(types.builtins.INT8, (valor: string) => Number(valor));
types.setTypeParser(types.builtins.JSONB, (valor: string) => valor);

export type Db = PgPool;

export interface Executor {
  query: (texto: string, valores?: unknown[]) => Promise<QueryResult>;
}

export const TABELAS = [
  "Usuario",
  "Prontuario",
  "Secao",
  "SyncOperationLog",
  "PasswordResetToken",
  "AuditLog",
  "Notificacao",
  "Configuracao",
] as const;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS "Usuario" (
  "id"             TEXT PRIMARY KEY,
  "nome"           TEXT NOT NULL,
  "email"          TEXT NOT NULL UNIQUE,
  "senhaHash"      TEXT NOT NULL,
  "perfil"         TEXT NOT NULL,
  "matricula"      TEXT UNIQUE,
  "criadoEm"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ativo"          BOOLEAN NOT NULL DEFAULT TRUE,
  "motivoExclusao" TEXT,
  "tokenVersion"   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Prontuario" (
  "id"                     TEXT PRIMARY KEY,
  "status"                 TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  "criadoEm"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizadoEm"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "pacienteNome"           TEXT NOT NULL,
  "pacienteDataNascimento" TIMESTAMPTZ,
  "alunoTitularId"         TEXT NOT NULL REFERENCES "Usuario"("id"),
  "professorSupervisorId"  TEXT REFERENCES "Usuario"("id"),
  "assinadoEm"             TIMESTAMPTZ,
  "assinadoPorId"          TEXT REFERENCES "Usuario"("id"),
  "assinadoPorNome"        TEXT,
  "assinaturaInvalidada"   BOOLEAN NOT NULL DEFAULT FALSE,
  "devolvidoEm"            TIMESTAMPTZ,
  "devolvidoPorId"         TEXT REFERENCES "Usuario"("id"),
  "devolvidoPorNome"       TEXT,
  "motivoDevolucao"        TEXT,
  "comentarioDevolucao"    TEXT,
  "acessoSolicitadoEm"     TIMESTAMPTZ,
  "acessoExpiraEm"         TIMESTAMPTZ,
  "acessoRevogadoEm"       TIMESTAMPTZ,
  "acessoRecusadoEm"       TIMESTAMPTZ,
  "descartadoEm"           TIMESTAMPTZ,
  "descartadoPorId"        TEXT REFERENCES "Usuario"("id"),
  "sinalizadoDuplicidade"  BOOLEAN NOT NULL DEFAULT FALSE,
  "transferidoDe"          TEXT,
  "transferidoPara"        TEXT
);
CREATE INDEX IF NOT EXISTS idx_pront_aluno ON "Prontuario"("alunoTitularId");
CREATE INDEX IF NOT EXISTS idx_pront_prof ON "Prontuario"("professorSupervisorId");
CREATE INDEX IF NOT EXISTS idx_pront_paciente ON "Prontuario"("pacienteNome", "pacienteDataNascimento");
CREATE INDEX IF NOT EXISTS idx_pront_solicitado
  ON "Prontuario"("acessoSolicitadoEm")
  WHERE "acessoSolicitadoEm" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Secao" (
  "id"           TEXT PRIMARY KEY,
  "prontuarioId" TEXT NOT NULL REFERENCES "Prontuario"("id") ON DELETE CASCADE,
  "secaoId"      TEXT NOT NULL,
  "conteudo"     JSONB NOT NULL,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("prontuarioId", "secaoId")
);
CREATE INDEX IF NOT EXISTS idx_secao_pront ON "Secao"("prontuarioId");

CREATE TABLE IF NOT EXISTS "SyncOperationLog" (
  "id"           TEXT PRIMARY KEY,
  "prontuarioId" TEXT REFERENCES "Prontuario"("id") ON DELETE SET NULL,
  "entity"       TEXT NOT NULL,
  "entityId"     TEXT NOT NULL,
  "op"           TEXT NOT NULL,
  "ts"           BIGINT NOT NULL,
  "aplicadaEm"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "descartada"   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_log_entity ON "SyncOperationLog"("entityId");
CREATE INDEX IF NOT EXISTS idx_log_ts ON "SyncOperationLog"("ts");
CREATE INDEX IF NOT EXISTS idx_log_pront ON "SyncOperationLog"("prontuarioId");

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiraEm"  TIMESTAMPTZ NOT NULL,
  "usadoEm"   TIMESTAMPTZ,
  "criadoEm"  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_userId ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS idx_reset_expiraEm ON "PasswordResetToken"("expiraEm");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"           TEXT PRIMARY KEY,
  "usuarioId"    TEXT REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "prontuarioId" TEXT REFERENCES "Prontuario"("id") ON DELETE SET NULL,
  "acao"         TEXT NOT NULL,
  "detalhe"      JSONB,
  "criadoEm"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_pront ON "AuditLog"("prontuarioId");
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON "AuditLog"("usuarioId");
CREATE INDEX IF NOT EXISTS idx_audit_acao ON "AuditLog"("acao");

CREATE TABLE IF NOT EXISTS "Notificacao" (
  "id"           TEXT PRIMARY KEY,
  "usuarioId"    TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "prontuarioId" TEXT REFERENCES "Prontuario"("id") ON DELETE SET NULL,
  "tipo"         TEXT NOT NULL,
  "mensagem"     TEXT NOT NULL,
  "criadoEm"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lidaEm"       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON "Notificacao"("usuarioId", "lidaEm");

CREATE TABLE IF NOT EXISTS "Configuracao" (
  "chave"        TEXT PRIMARY KEY,
  "valor"        TEXT NOT NULL,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const LOCK_MIGRACAO = 727274;

export function criarPool(): Db {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  });
  pool.on("error", (err) => console.error("[db] erro em conexão ociosa:", err));
  return pool;
}

export async function migrar(db: Db): Promise<void> {
  await transacao(db, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock($1)", [LOCK_MIGRACAO]);
    await tx.query(SCHEMA);
    for (const tabela of TABELAS) {
      await tx.query(`ALTER TABLE "${tabela}" ENABLE ROW LEVEL SECURITY`);
    }
  });
}

export async function transacao<T>(db: Db, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  let conexaoQuebrada: Error | undefined;
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (falhaRollback) {
      conexaoQuebrada = falhaRollback as Error;
    }
    throw err;
  } finally {
    client.release(conexaoQuebrada);
  }
}

export async function comSavepoint<T>(tx: Executor, fn: () => Promise<T>): Promise<T> {
  await tx.query("SAVEPOINT operacao");
  try {
    const resultado = await fn();
    await tx.query("RELEASE SAVEPOINT operacao");
    return resultado;
  } catch (err) {
    await tx.query("ROLLBACK TO SAVEPOINT operacao");
    throw err;
  }
}

export async function todas<T>(ex: Executor, sql: string, params: unknown[] = []): Promise<T[]> {
  const resultado = await ex.query(sql, params);
  return resultado.rows as T[];
}

export async function uma<T>(ex: Executor, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await todas<T>(ex, sql, params))[0];
}

export async function executar(ex: Executor, sql: string, params: unknown[] = []): Promise<number> {
  const resultado = await ex.query(sql, params);
  return resultado.rowCount ?? 0;
}
