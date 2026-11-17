import { beforeEach, describe, expect, it } from "vitest";
import { canonicalize } from "../canonical";
import { validateForUse, type OfflineAuth, type OfflineOp } from "../offlineAuth";

const PAYLOAD = {
  professorId: "prof-1",
  alunoId: "aluno-1",
  prontuarioId: "pront-1",
  operations: ["anamnese:create", "anamnese:update"],
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  nonce: "nonce-abc",
};

const CANONICAL_ESPERADO =
  '{"alunoId":"aluno-1","expiresAt":"2099-01-01T00:00:00.000Z","issuedAt":"2026-01-01T00:00:00.000Z","nonce":"nonce-abc","operations":["anamnese:create","anamnese:update"],"professorId":"prof-1","prontuarioId":"pront-1"}';

const OP: OfflineOp = { entity: "anamnese", op: "update", prontuarioId: "pront-1", nonce: "nonce-abc" };

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function build(payload: typeof PAYLOAD, keys: CryptoKeyPair): Promise<OfflineAuth> {
  const spki = await crypto.subtle.exportKey("spki", keys.publicKey);
  const b64 = toB64(spki).replace(/(.{64})/g, "$1\n");
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(canonicalize(payload)),
  );
  return { ...payload, operations: [...payload.operations], signature: toB64(sig), publicKeyPem, revokedAt: null };
}

describe("canonicalize (frontend)", () => {
  it("produz a string esperada do backend", () => {
    expect(canonicalize(PAYLOAD)).toBe(CANONICAL_ESPERADO);
  });
  it("ordena chaves recursivamente e omite undefined", () => {
    expect(canonicalize({ b: { z: 1, a: [{ y: 2, x: undefined, w: 3 }] }, a: "é" })).toBe(
      '{"a":"é","b":{"a":[{"w":3,"y":2}],"z":1}}',
    );
  });
});

describe("validateForUse", () => {
  let keys: CryptoKeyPair;
  let auth: OfflineAuth;

  beforeEach(async () => {
    keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    auth = await build(PAYLOAD, keys);
  });

  it("autorização válida passa", async () => {
    expect(await validateForUse(auth, OP)).toEqual({ ok: true });
  });

  it("assinatura adulterada falha (signature)", async () => {
    const bytes = Uint8Array.from(atob(auth.signature), (c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const r = await validateForUse({ ...auth, signature: toB64(bytes) }, OP);
    expect(r).toEqual({ ok: false, motivo: "signature" });
  });

  it("payload adulterado após assinatura falha (signature)", async () => {
    const r = await validateForUse({ ...auth, operations: ["anamnese:delete"] }, { ...OP, op: "delete" });
    expect(r).toEqual({ ok: false, motivo: "signature" });
  });

  it("expirada falha (expired)", async () => {
    const vencida = await build({ ...PAYLOAD, expiresAt: "2020-01-01T00:00:00.000Z" }, keys);
    expect(await validateForUse(vencida, OP)).toEqual({ ok: false, motivo: "expired" });
  });

  it("nonce diferente falha (nonce)", async () => {
    expect(await validateForUse(auth, { ...OP, nonce: "outro" })).toEqual({ ok: false, motivo: "nonce" });
  });

  it("prontuarioId diferente falha (prontuario)", async () => {
    expect(await validateForUse(auth, { ...OP, prontuarioId: "pront-2" })).toEqual({
      ok: false,
      motivo: "prontuario",
    });
  });

  it("op fora de operations[] falha (operation)", async () => {
    expect(await validateForUse(auth, { ...OP, op: "delete" })).toEqual({ ok: false, motivo: "operation" });
  });

  it("revokedAt != null falha (revoked)", async () => {
    const r = await validateForUse({ ...auth, revokedAt: "2026-06-01T00:00:00.000Z" }, OP);
    expect(r).toEqual({ ok: false, motivo: "revoked" });
  });
});
