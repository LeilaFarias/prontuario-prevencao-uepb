import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalize,
  decryptPrivateKey,
  encryptPrivateKey,
  generateKeyPair,
  generateNonce,
  sign,
  verify,
} from "../signature.js";

const PASSPHRASE = "frase-secreta-de-teste-123";
const payload = {
  prontuarioId: "abc-123",
  professor: { nome: "Maria", matricula: 42 },
  itens: [{ b: 2, a: 1 }, "x"],
  nonce: "n-1",
};

describe("signature", () => {
  let kp: ReturnType<typeof generateKeyPair>;
  let other: ReturnType<typeof generateKeyPair>;

  before(() => {
    kp = generateKeyPair();
    other = generateKeyPair();
  });

  it("verify aceita assinatura válida", () => {
    const sig = sign(payload, kp.privateKeyPem);
    assert.equal(verify(payload, sig, kp.publicKeyPem), true);
  });

  it("verify rejeita payload adulterado", () => {
    const sig = sign(payload, kp.privateKeyPem);
    const tampered = { ...payload, prontuarioId: "abc-124" };
    assert.equal(verify(tampered, sig, kp.publicKeyPem), false);
  });

  it("verify rejeita chave pública errada", () => {
    const sig = sign(payload, kp.privateKeyPem);
    assert.equal(verify(payload, sig, other.publicKeyPem), false);
  });

  it("round-trip encryptPrivateKey/decryptPrivateKey", () => {
    const enc = encryptPrivateKey(kp.privateKeyPem, PASSPHRASE);
    assert.equal(enc.iter, 210000);
    assert.equal(Buffer.from(enc.saltB64, "base64").length, 16);
    assert.equal(Buffer.from(enc.ivB64, "base64").length, 12);
    assert.ok(!enc.ciphertextB64.includes("PRIVATE KEY"));
    assert.equal(decryptPrivateKey(enc, PASSPHRASE), kp.privateKeyPem);
  });

  it("decryptPrivateKey com passphrase errada lança erro (sem vazar segredos)", () => {
    const enc = encryptPrivateKey(kp.privateKeyPem, PASSPHRASE);
    const wrong = "passphrase-errada-xyz";
    assert.throws(
      () => decryptPrivateKey(enc, wrong),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(!err.message.includes(wrong));
        assert.ok(!err.message.includes(PASSPHRASE));
        assert.ok(!err.message.includes("PRIVATE KEY"));
        return true;
      },
    );
  });

  it("canonicalize é estável independente da ordem das chaves", () => {
    const a = { z: 1, a: { y: [ { d: 4, c: 3 } ], x: null }, m: "ç" };
    const b = { m: "ç", a: { x: null, y: [ { c: 3, d: 4 } ] }, z: 1 };
    assert.equal(canonicalize(a), canonicalize(b));
    assert.equal(canonicalize(a), '{"a":{"x":null,"y":[{"c":3,"d":4}]},"m":"ç","z":1}');
  });

  it("generateNonce devolve UUID v4", () => {
    assert.match(
      generateNonce(),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
