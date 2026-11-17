import { canonicalize } from "./canonical";

type Instante = string | number | Date;

export interface OfflineAuth {
  id?: string;
  professorId: string;
  alunoId: string;
  prontuarioId: string;
  operations: string | string[];
  issuedAt: Instante;
  expiresAt: Instante;
  nonce: string;
  signature: string;
  publicKeyPem: string;
  revokedAt?: Instante | null;
}

export interface OfflineOp {
  entity: string;
  op: string;
  prontuarioId: string;
  nonce: unknown;
  alunoId?: string;
}

export type MotivoOffline = "signature" | "expired" | "nonce" | "prontuario" | "operation" | "revoked";
export type ValidateResult = { ok: true } | { ok: false; motivo: MotivoOffline };

const fail = (motivo: MotivoOffline): ValidateResult => ({ ok: false, motivo });

function toMs(v: Instante): number {
  return v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
}

function toIso(v: Instante): string {
  if (typeof v === "string") return v;
  return new Date(v).toISOString();
}

function lerOperations(valor: unknown): string[] | null {
  let lista = valor;
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(lista) || !lista.every((i) => typeof i === "string")) return null;
  return lista as string[];
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END) [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function assinaturaValida(auth: OfflineAuth, operations: string[]): Promise<boolean> {
  try {
    const payload = {
      professorId: auth.professorId,
      alunoId: auth.alunoId,
      prontuarioId: auth.prontuarioId,
      operations,
      issuedAt: toIso(auth.issuedAt),
      expiresAt: toIso(auth.expiresAt),
      nonce: auth.nonce,
    };
    const key = await crypto.subtle.importKey(
      "spki",
      pemToDer(auth.publicKeyPem),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64ToBytes(auth.signature) as unknown as BufferSource,
      new TextEncoder().encode(canonicalize(payload)),
    );
  } catch {
    return false;
  }
}

export async function validateForUse(auth: OfflineAuth, op: OfflineOp): Promise<ValidateResult> {
  const operations = lerOperations(auth.operations);
  if (!operations) return fail("signature");

  if (!(await assinaturaValida(auth, operations))) return fail("signature");
  if (!(Date.now() < toMs(auth.expiresAt))) return fail("expired");
  if (auth.revokedAt != null) return fail("revoked");
  if (typeof op.nonce !== "string" || op.nonce !== auth.nonce) return fail("nonce");
  if (op.prontuarioId !== auth.prontuarioId) return fail("prontuario");
  if (!operations.includes(`${op.entity}:${op.op}`)) return fail("operation");
  return { ok: true };
}
