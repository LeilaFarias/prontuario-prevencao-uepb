import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "./env";

// SQLite não tem enum nem Json: ambos são TEXT. Datas em ISO 8601.
const AGORA = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Usuario (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  senhaHash  TEXT NOT NULL,
  perfil     TEXT NOT NULL,            -- 'ALUNO' | 'PROFESSOR'
  matricula  TEXT UNIQUE,
  criadoEm   TEXT NOT NULL DEFAULT (${AGORA}),
  ativo      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Prontuario (
  id                     TEXT PRIMARY KEY,
  status                 TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  criadoEm               TEXT NOT NULL DEFAULT (${AGORA}),
  atualizadoEm           TEXT NOT NULL DEFAULT (${AGORA}),
  pacienteNome           TEXT NOT NULL,
  pacienteDataNascimento TEXT,
  alunoTitularId         TEXT NOT NULL REFERENCES Usuario(id),
  professorSupervisorId  TEXT REFERENCES Usuario(id),
  assinadoEm             TEXT,
  assinaturaInvalidada   INTEGER NOT NULL DEFAULT 0,
  acessoExpiraEm         TEXT,
  acessoRevogadoEm       TEXT
);
CREATE INDEX IF NOT EXISTS idx_pront_aluno ON Prontuario(alunoTitularId);
CREATE INDEX IF NOT EXISTS idx_pront_prof ON Prontuario(professorSupervisorId);
CREATE INDEX IF NOT EXISTS idx_pront_paciente ON Prontuario(pacienteNome, pacienteDataNascimento);

CREATE TABLE IF NOT EXISTS Secao (
  id           TEXT PRIMARY KEY,
  prontuarioId TEXT NOT NULL REFERENCES Prontuario(id) ON DELETE CASCADE,
  secaoId      TEXT NOT NULL,          -- 'dados-pessoais', 'historia-medica', etc
  conteudo     TEXT NOT NULL,          -- JSON serializado
  atualizadoEm TEXT NOT NULL DEFAULT (${AGORA}),
  UNIQUE (prontuarioId, secaoId)
);
CREATE INDEX IF NOT EXISTS idx_secao_pront ON Secao(prontuarioId);

CREATE TABLE IF NOT EXISTS SyncOperationLog (
  id           TEXT PRIMARY KEY,
  prontuarioId TEXT REFERENCES Prontuario(id) ON DELETE SET NULL,
  entity       TEXT NOT NULL,
  entityId     TEXT NOT NULL,
  op           TEXT NOT NULL,
  ts           INTEGER NOT NULL,
  aplicadaEm   TEXT NOT NULL DEFAULT (${AGORA}),
  descartada   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_log_entity ON SyncOperationLog(entityId);
CREATE INDEX IF NOT EXISTS idx_log_ts ON SyncOperationLog(ts);

CREATE TABLE IF NOT EXISTS PasswordResetToken (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  expiraEm  TEXT NOT NULL,
  usadoEm   TEXT,
  criadoEm  TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES Usuario(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reset_userId ON PasswordResetToken(userId);
CREATE INDEX IF NOT EXISTS idx_reset_expiraEm ON PasswordResetToken(expiraEm);
`;

/** Bancos criados antes da Sprint 2 não têm Usuario.ativo; SQLite não tem ADD COLUMN IF NOT EXISTS. */
function migrarColunaAtivo(db: DatabaseSync): void {
  const colunas = db.prepare("PRAGMA table_info(Usuario)").all() as unknown as { name: string }[];
  if (!colunas.some((c) => c.name === "ativo")) {
    db.exec("ALTER TABLE Usuario ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1");
  }
}

/** Abre o arquivo SQLite (criando-o se preciso) e garante que o schema existe. */
export function abrirBanco(): DatabaseSync {
  const arquivo = path.resolve(process.cwd(), env.DATABASE_URL.replace(/^file:/, ""));
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrarColunaAtivo(db);
  return db;
}

/** Executa `fn` numa transação; desfaz tudo se lançar erro. */
export function transacao<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
