import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_MAX_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

export interface KeyPairPem {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface EncryptedPrivateKey {
  ciphertextB64: string;
  saltB64: string;
  ivB64: string;
  iter: number;
}

export function generateKeyPair(): KeyPairPem {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

function deriveKey(passphrase: string, salt: Buffer, iter: number): Buffer {
  return pbkdf2Sync(Buffer.from(passphrase, "utf8"), salt, iter, KEY_BYTES, "sha256");
}

function assertPassphrase(passphrase: unknown): asserts passphrase is string {
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new Error("Passphrase inválida.");
  }
}

export function encryptPrivateKey(pem: string, passphrase: string): EncryptedPrivateKey {
  assertPassphrase(passphrase);
  if (typeof pem !== "string" || pem.length === 0) {
    throw new Error("Chave privada inválida.");
  }
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: Buffer.concat([ct, tag]).toString("base64"),
    saltB64: salt.toString("base64"),
    ivB64: iv.toString("base64"),
    iter: PBKDF2_ITERATIONS,
  };
}

export function decryptPrivateKey(payload: EncryptedPrivateKey, passphrase: string): string {
  assertPassphrase(passphrase);
  if (
    !payload ||
    typeof payload.ciphertextB64 !== "string" ||
    typeof payload.saltB64 !== "string" ||
    typeof payload.ivB64 !== "string" ||
    !Number.isInteger(payload.iter) ||
    payload.iter < 1 ||
    payload.iter > PBKDF2_MAX_ITERATIONS
  ) {
    throw new Error("Payload de chave cifrada inválido.");
  }
  const salt = Buffer.from(payload.saltB64, "base64");
  const iv = Buffer.from(payload.ivB64, "base64");
  const data = Buffer.from(payload.ciphertextB64, "base64");
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || data.length <= TAG_BYTES) {
    throw new Error("Payload de chave cifrada inválido.");
  }
  try {
    const key = deriveKey(passphrase, salt, payload.iter);
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
    const pt = Buffer.concat([
      decipher.update(data.subarray(0, data.length - TAG_BYTES)),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    throw new Error("Falha ao decifrar a chave privada (passphrase incorreta ou dados corrompidos).");
  }
}

function normalize(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    const maybe = value as { toJSON?: () => unknown };
    if (typeof maybe.toJSON === "function") return normalize(maybe.toJSON());
    if (Array.isArray(value)) return value.map((v) => normalize(v));
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      if (src[k] === undefined) continue;
      out[k] = normalize(src[k]);
    }
    return out;
  }
  return value;
}

export function canonicalize(payload: unknown): string {
  const result = JSON.stringify(normalize(payload));
  if (result === undefined) throw new Error("Payload não serializável.");
  return result;
}

export function sign(payload: unknown, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  const sig = cryptoSign("sha256", Buffer.from(canonicalize(payload), "utf8"), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return sig.toString("base64");
}

export function verify(payload: unknown, signatureB64: string, publicKeyPem: string): boolean {
  const key = createPublicKey(publicKeyPem);
  try {
    const sig = Buffer.from(signatureB64, "base64");
    return cryptoVerify(
      "sha256",
      Buffer.from(canonicalize(payload), "utf8"),
      { key, dsaEncoding: "ieee-p1363" },
      sig,
    );
  } catch {
    return false;
  }
}

export function generateNonce(): string {
  return randomUUID();
}

export interface AutorizacaoPersistida {
  id: string;
  professorId: string;
  alunoId: string;
  prontuarioId: string;
  operations: string | string[];
  issuedAt: string | Date;
  expiresAt: string | Date;
  nonce: string;
  signature: string;
  publicKeyPem: string;
  revokedAt: string | Date | null;
}

export interface OperacaoAutorizada {
  entity: string;
  op: string;
  prontuarioId: string;
  alunoId: string;
  nonce: unknown;
}

export type ResultadoAutorizacao = { ok: true } | { ok: false; motivo: string };

const paraIso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : v);

function lerOperations(valor: unknown): string[] | null {
  let lista = valor;
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(lista) || !lista.every((item) => typeof item === "string")) return null;
  return lista as string[];
}

const rejeitar = (motivo: string): ResultadoAutorizacao => ({ ok: false, motivo });

// opTs vem do cliente: a validade é avaliada no momento declarado pela operação, não no da sincronização.
export function verificarAutorizacao(
  auth: AutorizacaoPersistida,
  operation: OperacaoAutorizada,
  opTs: number,
): ResultadoAutorizacao {
  const operations = lerOperations(auth.operations);
  if (!operations) return rejeitar("autorização malformada");

  const expiresAt = paraIso(auth.expiresAt);
  const payload = {
    professorId: auth.professorId,
    alunoId: auth.alunoId,
    prontuarioId: auth.prontuarioId,
    operations,
    issuedAt: paraIso(auth.issuedAt),
    expiresAt,
    nonce: auth.nonce,
  };
  let assinaturaValida = false;
  try {
    assinaturaValida = verify(payload, auth.signature, auth.publicKeyPem);
  } catch {
    assinaturaValida = false;
  }
  if (!assinaturaValida) return rejeitar("assinatura inválida");

  if (operation.alunoId !== auth.alunoId) return rejeitar("autorização não pertence ao aluno");
  if (typeof operation.nonce !== "string" || operation.nonce !== auth.nonce) return rejeitar("nonce não confere");
  if (operation.prontuarioId !== auth.prontuarioId) return rejeitar("prontuário não corresponde à autorização");
  if (!operations.includes(`${operation.entity}:${operation.op}`)) {
    return rejeitar("operação fora do escopo da autorização");
  }
  if (!Number.isFinite(opTs)) return rejeitar("timestamp da operação inválido");
  if (opTs >= Date.parse(expiresAt)) return rejeitar("autorização expirada");
  if (auth.revokedAt !== null && opTs > Date.parse(paraIso(auth.revokedAt))) return rejeitar("autorização revogada");
  return { ok: true };
}
