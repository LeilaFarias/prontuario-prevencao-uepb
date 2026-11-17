import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPair,
  generateNonce,
  sign,
  verificarAutorizacao,
  type AutorizacaoPersistida,
  type OperacaoAutorizada,
} from "../../lib/signature";

const PROFESSOR_ID = "prof-1";
const ALUNO_ID = "aluno-1";
const PRONT_ID = "pront-1";
const T = (iso: string) => new Date(iso).getTime();

let par: ReturnType<typeof generateKeyPair>;
let outroPar: ReturnType<typeof generateKeyPair>;

function emitir(
  opcoes: { issuedAt?: string; expiresAt?: string; operations?: string[]; revokedAt?: string | null } = {},
): AutorizacaoPersistida {
  const payload = {
    professorId: PROFESSOR_ID,
    alunoId: ALUNO_ID,
    prontuarioId: PRONT_ID,
    operations: opcoes.operations ?? ["secao:update", "prontuario:update"],
    issuedAt: opcoes.issuedAt ?? "2026-11-16T10:00:00.000Z",
    expiresAt: opcoes.expiresAt ?? "2026-12-16T10:00:00.000Z",
    nonce: generateNonce(),
  };
  return {
    id: "aut-1",
    ...payload,
    operations: JSON.stringify(payload.operations),
    signature: sign(payload, par.privateKeyPem),
    publicKeyPem: par.publicKeyPem,
    revokedAt: opcoes.revokedAt ?? null,
  };
}

const operacao = (auth: AutorizacaoPersistida, extra: Partial<OperacaoAutorizada> = {}): OperacaoAutorizada => ({
  entity: "secao",
  op: "update",
  prontuarioId: PRONT_ID,
  alunoId: ALUNO_ID,
  nonce: auth.nonce,
  ...extra,
});

before(() => {
  par = generateKeyPair();
  outroPar = generateKeyPair();
});

describe("verificarAutorizacao", () => {
  it("assinatura válida → operação aplicada", () => {
    const auth = emitir();
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth), T("2026-11-17T09:00:00.000Z")), { ok: true });
  });

  it("assinatura adulterada → rejeitada com motivo", () => {
    const ampliada = emitir();
    ampliada.operations = JSON.stringify(["secao:update", "prontuario:update", "prontuario:enviar"]);
    const r1 = verificarAutorizacao(ampliada, operacao(ampliada, { entity: "prontuario", op: "enviar" }), T("2026-11-17T09:00:00.000Z"));
    assert.deepEqual(r1, { ok: false, motivo: "assinatura inválida" });

    const prorrogada = emitir();
    prorrogada.expiresAt = "2027-12-16T10:00:00.000Z";
    const r2 = verificarAutorizacao(prorrogada, operacao(prorrogada), T("2026-11-17T09:00:00.000Z"));
    assert.deepEqual(r2, { ok: false, motivo: "assinatura inválida" });

    const chaveTrocada = emitir();
    chaveTrocada.publicKeyPem = outroPar.publicKeyPem;
    const r3 = verificarAutorizacao(chaveTrocada, operacao(chaveTrocada), T("2026-11-17T09:00:00.000Z"));
    assert.deepEqual(r3, { ok: false, motivo: "assinatura inválida" });
  });

  it("autorização expirada → rejeitada", () => {
    const auth = emitir({ expiresAt: "2026-11-20T10:00:00.000Z" });
    const r = verificarAutorizacao(auth, operacao(auth), T("2026-11-21T09:00:00.000Z"));
    assert.deepEqual(r, { ok: false, motivo: "autorização expirada" });
  });

  it("autorização revogada → operação feita depois da revogação é rejeitada; feita antes, aceita", () => {
    const auth = emitir({ revokedAt: "2026-11-17T12:00:00.000Z" });
    const depois = verificarAutorizacao(auth, operacao(auth), T("2026-11-17T12:00:00.001Z"));
    assert.deepEqual(depois, { ok: false, motivo: "autorização revogada" });
    const antes = verificarAutorizacao(auth, operacao(auth), T("2026-11-17T11:59:59.000Z"));
    assert.deepEqual(antes, { ok: true });
    const noInstante = verificarAutorizacao(auth, operacao(auth), T("2026-11-17T12:00:00.000Z"));
    assert.deepEqual(noInstante, { ok: true });
  });

  it("operação fora do escopo operations[] → rejeitada", () => {
    const auth = emitir();
    const r = verificarAutorizacao(auth, operacao(auth, { entity: "secao", op: "delete" }), T("2026-11-17T09:00:00.000Z"));
    assert.deepEqual(r, { ok: false, motivo: "operação fora do escopo da autorização" });
    const outraEntidade = verificarAutorizacao(
      auth,
      operacao(auth, { entity: "prontuario", op: "enviar" }),
      T("2026-11-17T09:00:00.000Z"),
    );
    assert.equal(outraEntidade.ok, false);
  });

  it("operação válida de madrugada, sincronizada ao meio-dia → aceita (vale op.ts, não o relógio)", () => {
    const auth = emitir({ issuedAt: "2026-01-09T22:00:00.000Z", expiresAt: "2026-01-10T06:00:00.000Z" });
    const madrugada = T("2026-01-10T03:00:00.000Z");
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth), madrugada), { ok: true });
    const depoisDoVencimento = T("2026-01-10T07:00:00.000Z");
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth), depoisDoVencimento), {
      ok: false,
      motivo: "autorização expirada",
    });
  });

  it("nonce divergente ou ausente → rejeitada", () => {
    const auth = emitir();
    const ts = T("2026-11-17T09:00:00.000Z");
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth, { nonce: "outro" }), ts), {
      ok: false,
      motivo: "nonce não confere",
    });
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth, { nonce: undefined }), ts), {
      ok: false,
      motivo: "nonce não confere",
    });
  });

  it("prontuário ou aluno diferentes dos da autorização → rejeitada", () => {
    const auth = emitir();
    const ts = T("2026-11-17T09:00:00.000Z");
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth, { prontuarioId: "pront-2" }), ts), {
      ok: false,
      motivo: "prontuário não corresponde à autorização",
    });
    assert.deepEqual(verificarAutorizacao(auth, operacao(auth, { alunoId: "aluno-2" }), ts), {
      ok: false,
      motivo: "autorização não pertence ao aluno",
    });
  });

  it("operations como JSONB devolvido pelo banco (string) ou como array são equivalentes; lixo é rejeitado", () => {
    const auth = emitir();
    const ts = T("2026-11-17T09:00:00.000Z");
    assert.equal(verificarAutorizacao({ ...auth, operations: ["secao:update", "prontuario:update"] }, operacao(auth), ts).ok, true);
    assert.deepEqual(verificarAutorizacao({ ...auth, operations: "{não é json" }, operacao(auth), ts), {
      ok: false,
      motivo: "autorização malformada",
    });
  });

  it("chave pública ilegível → rejeitada sem lançar erro", () => {
    const auth = { ...emitir(), publicKeyPem: "lixo" };
    const r = verificarAutorizacao(auth, operacao(auth), T("2026-11-17T09:00:00.000Z"));
    assert.deepEqual(r, { ok: false, motivo: "assinatura inválida" });
  });
});
