import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { TABELAS, transacao, type Db } from "../db";
import { env } from "../env";

const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ERRO_BACKUP = "Backup corrompido ou chave incorreta";
const VERSAO_BACKUP = 1;

type Linha = Record<string, unknown>;

interface Snapshot {
  versao: number;
  geradoEm: string;
  tabelas: Record<string, Linha[]>;
}

const derivarChave = (): Buffer => scryptSync(env.BACKUP_KEY, "backup-salt", 32);

export function criptografarBackup(dados: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, derivarChave(), iv);
  const cifrado = Buffer.concat([cipher.update(dados), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]);
}

export function descriptografarBackup(buffer: Buffer): Buffer {
  if (buffer.length < IV_BYTES + TAG_BYTES) throw new Error(ERRO_BACKUP);

  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const cifrado = buffer.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITMO, derivarChave(), iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(cifrado), decipher.final()]);
  } catch {
    throw new Error(ERRO_BACKUP);
  }
}

export async function exportarBanco(db: Db): Promise<Buffer> {
  const tabelas = await transacao(db, async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const resultado: Record<string, Linha[]> = {};
    for (const tabela of TABELAS) {
      const { rows } = await tx.query(`SELECT to_jsonb(t)::text AS linha FROM "${tabela}" t`);
      resultado[tabela] = rows.map((r) => JSON.parse(r.linha as string) as Linha);
    }
    return resultado;
  });
  const snapshot: Snapshot = { versao: VERSAO_BACKUP, geradoEm: new Date().toISOString(), tabelas };
  return Buffer.from(JSON.stringify(snapshot), "utf8");
}

export async function restaurarBanco(db: Db, dados: Buffer): Promise<Record<string, number>> {
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(dados.toString("utf8")) as Snapshot;
  } catch {
    throw new Error(ERRO_BACKUP);
  }
  if (snapshot.versao !== VERSAO_BACKUP || typeof snapshot.tabelas !== "object" || snapshot.tabelas === null) {
    throw new Error(ERRO_BACKUP);
  }
  if (!snapshot.tabelas.Usuario?.length) {
    throw new Error("Banco restaurado inválido: tabela Usuario ausente ou sem registros");
  }

  return transacao(db, async (tx) => {
    await tx.query(`TRUNCATE ${TABELAS.map((t) => `"${t}"`).join(", ")}`);
    const contagens: Record<string, number> = {};
    for (const tabela of TABELAS) {
      const linhas = snapshot.tabelas[tabela] ?? [];
      if (linhas.length > 0) {
        await tx.query(
          `INSERT INTO "${tabela}" SELECT * FROM jsonb_populate_recordset(NULL::"${tabela}", $1::jsonb)`,
          [JSON.stringify(linhas)],
        );
      }
      contagens[tabela] = linhas.length;
    }
    return contagens;
  });
}
