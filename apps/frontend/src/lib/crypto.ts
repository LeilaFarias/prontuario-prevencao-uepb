export const PBKDF2_ITERATIONS = 210_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export interface EncryptedField {
  iv: string;
  ct: string;
}

export class LockedError extends Error {
  constructor(message = "Dados bloqueados. Desbloqueie com o PIN.") {
    super(message);
    this.name = "LockedError";
  }
}

export class DecryptError extends Error {
  constructor(message = "Falha ao decifrar o campo.") {
    super(message);
    this.name = "DecryptError";
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function importPbkdf2(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", secret as BufferSource, "PBKDF2", false, ["deriveBits", "deriveKey"]);
}

export async function deriveKey(sessionSecret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const base = await importPbkdf2(sessionSecret);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function pbkdf2Hash(secret: Uint8Array, salt: Uint8Array): Promise<string> {
  const base = await importPbkdf2(secret);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    base,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function encryptField(key: CryptoKey, plaintext: string): Promise<EncryptedField> {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(plaintext));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

export async function decryptField(key: CryptoKey, field: EncryptedField): Promise<string> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(field.iv) as BufferSource },
      key,
      fromBase64(field.ct) as BufferSource,
    );
    return dec.decode(pt);
  } catch {
    throw new DecryptError();
  }
}
