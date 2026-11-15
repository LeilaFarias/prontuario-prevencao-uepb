import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { env } from "../env";

const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ERRO_BACKUP = "Backup corrompido ou chave incorreta";

const derivarChave = (): Buffer => scryptSync(env.BACKUP_KEY, "backup-salt", 32);

export function criptografarBackup(arquivoPath: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, derivarChave(), iv);
  const cifrado = Buffer.concat([cipher.update(readFileSync(arquivoPath)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]);
}

export function descriptografarBackup(buffer: Buffer, destinoPath: string): void {
  if (buffer.length < IV_BYTES + TAG_BYTES) throw new Error(ERRO_BACKUP);

  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const cifrado = buffer.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITMO, derivarChave(), iv);
  decipher.setAuthTag(tag);

  let claro: Buffer;
  try {
    claro = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  } catch {
    throw new Error(ERRO_BACKUP);
  }
  writeFileSync(destinoPath, claro);
}
