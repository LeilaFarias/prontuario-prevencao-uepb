import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://teste:teste@localhost:5432/teste";
process.env.DATABASE_SSL ??= "false";
process.env.JWT_SECRET = "jwt-secret-de-teste-com-mais-de-32-caracteres";
process.env.RESET_TOKEN_SECRET = "reset-secret-de-teste-com-mais-de-32-caracteres";
process.env.BACKUP_KEY = "backup-key-de-teste-com-mais-de-32-caracteres";
process.env.PROFESSOR_KEY_PASSPHRASE = "passphrase-de-teste-com-mais-de-32-caracteres";

const { migrar, criarPool, TABELAS } = await import("../../db");

type Consulta = { text: string; values?: unknown[] };

async function executarMigracaoComMock(): Promise<Consulta[]> {
  const consultas: Consulta[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      consultas.push({ text, values });
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  const db = { connect: async () => client } as unknown as Parameters<typeof migrar>[0];
  await migrar(db);
  return consultas;
}

const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

function blocoCreateTable(consultas: Consulta[], tabela: string): string {
  const alvo = consultas.find((c) => c.text.includes(`CREATE TABLE IF NOT EXISTS "${tabela}"`));
  assert.ok(alvo, `CREATE TABLE IF NOT EXISTS "${tabela}" não encontrado`);
  return normalizar(alvo.text);
}

describe("migrar (mock, sem Postgres)", () => {
  it("toda DDL usa IF NOT EXISTS e nada é destrutivo", async () => {
    const consultas = await executarMigracaoComMock();
    const sql = consultas.map((c) => c.text).join("\n;\n");
    assert.doesNotMatch(sql, /CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\s+(?!IF NOT EXISTS)/i);
    assert.doesNotMatch(sql, /ADD\s+COLUMN\s+(?!IF NOT EXISTS)/i);
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
    assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  });

  it("TABELAS inclui AutorizacaoAssinada e mantém LiberacaoOffline", () => {
    assert.ok((TABELAS as readonly string[]).includes("AutorizacaoAssinada"));
    assert.ok((TABELAS as readonly string[]).includes("LiberacaoOffline"));
    assert.equal(new Set(TABELAS).size, TABELAS.length);
  });

  it("Usuario recebe as 5 colunas de chave, todas NULL permitidas", async () => {
    const consultas = await executarMigracaoComMock();
    const alter = consultas
      .map((c) => normalizar(c.text))
      .find((t) => t.startsWith('ALTER TABLE "Usuario"') && t.includes('"publicKey"'));
    assert.ok(alter, "ALTER TABLE Usuario com publicKey não encontrado");
    for (const coluna of [
      'ADD COLUMN IF NOT EXISTS "publicKey" TEXT NULL',
      'ADD COLUMN IF NOT EXISTS "encryptedPrivateKey" TEXT NULL',
      'ADD COLUMN IF NOT EXISTS "keySalt" TEXT NULL',
      'ADD COLUMN IF NOT EXISTS "keyIv" TEXT NULL',
      'ADD COLUMN IF NOT EXISTS "keyIter" INTEGER NULL',
    ]) {
      assert.ok(alter.includes(coluna), `faltou: ${coluna}`);
    }
    assert.doesNotMatch(alter, /NOT NULL/);
  });

  it("AutorizacaoAssinada tem as colunas, tipos e constraints esperados", async () => {
    const bloco = blocoCreateTable(await executarMigracaoComMock(), "AutorizacaoAssinada");
    for (const trecho of [
      '"id" TEXT PRIMARY KEY',
      '"professorId" TEXT NOT NULL REFERENCES "Usuario"("id")',
      '"alunoId" TEXT NOT NULL REFERENCES "Usuario"("id")',
      '"prontuarioId" TEXT NOT NULL REFERENCES "Prontuario"("id") ON DELETE CASCADE',
      '"operations" JSONB NOT NULL',
      '"issuedAt" TIMESTAMPTZ NOT NULL',
      '"expiresAt" TIMESTAMPTZ NOT NULL',
      '"nonce" TEXT NOT NULL',
      '"signature" TEXT NOT NULL',
      '"publicKeyPem" TEXT NOT NULL',
      '"revokedAt" TIMESTAMPTZ,',
      '"operationId" TEXT UNIQUE',
      '"criadoEm" TIMESTAMPTZ NOT NULL DEFAULT now()',
    ]) {
      assert.ok(bloco.includes(trecho), `faltou: ${trecho}`);
    }
  });

  it("AutorizacaoAssinada tem índices em alunoId e prontuarioId", async () => {
    const sql = (await executarMigracaoComMock()).map((c) => normalizar(c.text));
    assert.ok(
      sql.some((t) =>
        t.includes('CREATE INDEX IF NOT EXISTS idx_autorizacao_aluno ON "AutorizacaoAssinada"("alunoId")'),
      ),
    );
    assert.ok(
      sql.some((t) =>
        t.includes('CREATE INDEX IF NOT EXISTS idx_autorizacao_pront ON "AutorizacaoAssinada"("prontuarioId")'),
      ),
    );
  });

  it("RLS é habilitado para AutorizacaoAssinada", async () => {
    const sql = (await executarMigracaoComMock()).map((c) => normalizar(c.text));
    assert.ok(sql.includes('ALTER TABLE "AutorizacaoAssinada" ENABLE ROW LEVEL SECURITY'));
  });

  it("LiberacaoOffline segue sem campos de assinatura", async () => {
    const bloco = blocoCreateTable(await executarMigracaoComMock(), "LiberacaoOffline");
    assert.ok(bloco.includes('"sincronizado" BOOLEAN NOT NULL DEFAULT false'));
    assert.doesNotMatch(bloco, /signature|nonce|publicKeyPem|revokedAt|operationId/);
  });

  it("migração é determinística (mesmas consultas em execuções repetidas)", async () => {
    const a = (await executarMigracaoComMock()).map((c) => c.text);
    const b = (await executarMigracaoComMock()).map((c) => c.text);
    assert.deepEqual(a, b);
  });
});

describe("migrar (requer Postgres: defina TEST_DATABASE_URL)", { skip: !process.env.TEST_DATABASE_URL }, () => {
  it("é idempotente e cria colunas e tabela no banco real", async () => {
    const db = criarPool();
    try {
      await migrar(db);
      await migrar(db);
      const usuario = await db.query(
        `SELECT column_name, is_nullable FROM information_schema.columns
          WHERE table_name = 'Usuario'
            AND column_name IN ('publicKey','encryptedPrivateKey','keySalt','keyIv','keyIter')`,
      );
      assert.equal(usuario.rowCount, 5);
      assert.ok(usuario.rows.every((r: { is_nullable: string }) => r.is_nullable === "YES"));
      const autorizacao = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'AutorizacaoAssinada'`,
      );
      assert.equal(autorizacao.rowCount, 13);
      const rls = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'AutorizacaoAssinada'`);
      assert.equal(rls.rows[0]?.relrowsecurity, true);
    } finally {
      await db.end();
    }
  });
});
