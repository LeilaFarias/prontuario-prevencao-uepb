import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "./env";

const AGORA = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Usuario (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  senhaHash  TEXT NOT NULL,
  perfil     TEXT NOT NULL,
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
  acessoRevogadoEm       TEXT,
  acessoSolicitadoEm     TEXT
);
CREATE INDEX IF NOT EXISTS idx_pront_aluno ON Prontuario(alunoTitularId);
CREATE INDEX IF NOT EXISTS idx_pront_prof ON Prontuario(professorSupervisorId);
CREATE INDEX IF NOT EXISTS idx_pront_paciente ON Prontuario(pacienteNome, pacienteDataNascimento);
CREATE INDEX IF NOT EXISTS idx_pront_solicitado
  ON Prontuario(acessoSolicitadoEm)
  WHERE acessoSolicitadoEm IS NOT NULL;

CREATE TABLE IF NOT EXISTS Secao (
  id           TEXT PRIMARY KEY,
  prontuarioId TEXT NOT NULL REFERENCES Prontuario(id) ON DELETE CASCADE,
  secaoId      TEXT NOT NULL,
  conteudo     TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS AuditLog (
  id           TEXT PRIMARY KEY,
  usuarioId    TEXT REFERENCES Usuario(id) ON DELETE SET NULL,
  prontuarioId TEXT REFERENCES Prontuario(id) ON DELETE SET NULL,
  acao         TEXT NOT NULL,
  detalhe      TEXT,
  criadoEm     TEXT NOT NULL DEFAULT (${AGORA})
);
CREATE INDEX IF NOT EXISTS idx_audit_pront ON AuditLog(prontuarioId);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON AuditLog(usuarioId);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON AuditLog(acao);
`;

function migrarColunaAtivo(db: DatabaseSync): void {
  const colunas = db.prepare("PRAGMA table_info(Usuario)").all() as unknown as { name: string }[];
  if (!colunas.some((c) => c.name === "ativo")) {
    db.exec("ALTER TABLE Usuario ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1");
  }
}

function migrarColunaSinalizadoDuplicidade(db: DatabaseSync): void {
  const colunas = db.prepare("PRAGMA table_info(Prontuario)").all() as unknown as { name: string }[];
  if (!colunas.some((c) => c.name === "sinalizadoDuplicidade")) {
    db.exec("ALTER TABLE Prontuario ADD COLUMN sinalizadoDuplicidade INTEGER NOT NULL DEFAULT 0");
  }
}

const COLUNAS_REVISAO: ReadonlyArray<readonly [string, string]> = [
  ["assinadoEm", "TEXT"],
  ["assinadoPorId", "TEXT REFERENCES Usuario(id)"],
  ["assinadoPorNome", "TEXT"],
  ["devolvidoEm", "TEXT"],
  ["devolvidoPorId", "TEXT REFERENCES Usuario(id)"],
  ["devolvidoPorNome", "TEXT"],
  ["motivoDevolucao", "TEXT"],
  ["comentarioDevolucao", "TEXT"],
];

function migrarColunasRevisao(db: DatabaseSync): void {
  const colunas = db.prepare("PRAGMA table_info(Prontuario)").all() as unknown as { name: string }[];
  const existentes = new Set(colunas.map((c) => c.name));
  for (const [nome, definicao] of COLUNAS_REVISAO) {
    if (!existentes.has(nome)) db.exec(`ALTER TABLE Prontuario ADD COLUMN ${nome} ${definicao}`);
  }
}

const COLUNAS_ACESSO: ReadonlyArray<string> = ["acessoSolicitadoEm", "acessoExpiraEm", "acessoRevogadoEm"];

function migrarColunasAcesso(db: DatabaseSync): void {
  const colunas = db.prepare("PRAGMA table_info(Prontuario)").all() as unknown as { name: string }[];
  const existentes = new Set(colunas.map((c) => c.name));
  for (const nome of COLUNAS_ACESSO) {
    if (!existentes.has(nome)) db.exec(`ALTER TABLE Prontuario ADD COLUMN ${nome} TEXT`);
  }
}

export function abrirBanco(): DatabaseSync {
  const arquivo = path.resolve(process.cwd(), env.DATABASE_URL.replace(/^file:/, ""));
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrarColunaAtivo(db);
  migrarColunaSinalizadoDuplicidade(db);
  migrarColunasRevisao(db);
  migrarColunasAcesso(db);
  return db;
}

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