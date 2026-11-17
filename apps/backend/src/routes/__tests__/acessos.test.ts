import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://teste:teste@localhost:5432/teste";
process.env.DATABASE_SSL = "false";
process.env.JWT_SECRET = "jwt-secret-de-teste-com-mais-de-32-caracteres";
process.env.RESET_TOKEN_SECRET = "reset-secret-de-teste-com-mais-de-32-caracteres";
process.env.BACKUP_KEY = "backup-key-de-teste-com-mais-de-32-caracteres";
process.env.PROFESSOR_KEY_PASSPHRASE = "passphrase-de-teste-com-mais-de-32-caracteres";
process.env.AUTORIZACAO_TTL_DIAS = "7";

const { acessosRoutes } = await import("../acessos");
const { decryptPrivateKey, encryptPrivateKey, generateKeyPair, verify } = await import("../../lib/signature");

const PASSPHRASE = process.env.PROFESSOR_KEY_PASSPHRASE;
const PROFESSOR_ID = "prof-1";
const OUTRO_PROFESSOR_ID = "prof-2";
const ALUNO_ID = "aluno-1";
const PRONT_ID = "pront-1";

interface ChaveEstado {
  publicKey: string | null;
  encryptedPrivateKey: string | null;
  keySalt: string | null;
  keyIv: string | null;
  keyIter: number | null;
}

interface AutorizacaoEstado {
  id: string;
  professorId: string;
  revokedAt: string | null;
  [campo: string]: unknown;
}

let chave: ChaveEstado;
let autorizacoes: AutorizacaoEstado[];
let consultas: { text: string; values?: unknown[] }[];
let vencedorDaCorrida: ChaveEstado | null;
let logs: unknown[];

const semChave = (): ChaveEstado => ({
  publicKey: null,
  encryptedPrivateKey: null,
  keySalt: null,
  keyIv: null,
  keyIter: null,
});

function chaveCifrada(par: { publicKeyPem: string; privateKeyPem: string }): ChaveEstado {
  const c = encryptPrivateKey(par.privateKeyPem, PASSPHRASE);
  return { publicKey: par.publicKeyPem, encryptedPrivateKey: c.ciphertextB64, keySalt: c.saltB64, keyIv: c.ivB64, keyIter: c.iter };
}

function query(text: string, values: unknown[] = []) {
  consultas.push({ text, values });
  const sql = text.replace(/\s+/g, " ").trim();
  const ok = (rows: unknown[] = [], rowCount = rows.length) => ({ rows, rowCount });

  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return ok();
  if (sql.includes('FROM "Prontuario"')) {
    return values[0] === PRONT_ID
      ? ok([{ status: "EM_ANDAMENTO", alunoTitularId: ALUNO_ID, professorSupervisorId: PROFESSOR_ID }])
      : ok();
  }
  if (sql.startsWith('SELECT "publicKey"')) return ok([{ ...chave }]);
  if (sql.startsWith('UPDATE "Usuario"')) {
    if (vencedorDaCorrida) {
      chave = vencedorDaCorrida;
      return ok([], 0);
    }
    if (chave.publicKey !== null) return ok([], 0);
    [chave.publicKey, chave.encryptedPrivateKey, chave.keySalt, chave.keyIv, chave.keyIter] = values as [
      string,
      string,
      string,
      string,
      number,
    ];
    return ok([], 1);
  }
  if (sql.startsWith('INSERT INTO "AutorizacaoAssinada"')) {
    const [id, professorId, alunoId, prontuarioId, operations, issuedAt, expiresAt, nonce, signature, publicKeyPem] =
      values as string[];
    autorizacoes.push({
      id, professorId, alunoId, prontuarioId, operations, issuedAt, expiresAt, nonce, signature, publicKeyPem,
      revokedAt: null,
    });
    return ok([], 1);
  }
  if (sql.startsWith('SELECT "id", "professorId", "revokedAt" FROM "AutorizacaoAssinada"')) {
    const a = autorizacoes.find((x) => x.id === values[0]);
    return a ? ok([{ id: a.id, professorId: a.professorId, revokedAt: a.revokedAt }]) : ok();
  }
  if (sql.startsWith('UPDATE "AutorizacaoAssinada"')) {
    const a = autorizacoes.find((x) => x.id === values[1] && x.revokedAt === null);
    if (!a) return ok([], 0);
    a.revokedAt = values[0] as string;
    return ok([], 1);
  }
  throw new Error(`consulta inesperada no mock: ${sql.slice(0, 80)}`);
}

const db = { connect: async () => ({ query: async (t: string, v?: unknown[]) => query(t, v), release: () => {} }) };

interface Rota {
  opts: { preHandler?: unknown };
  handler: (req: unknown, reply: unknown) => Promise<unknown>;
}
const rotas = new Map<string, Rota>();

const autenticar = async (req: { user?: unknown }, reply: MockReply) => {
  if (!req.user) return reply.status(401).send({ error: "Não autenticado." });
};

const app = {
  db,
  autenticar,
  get: (path: string, opts: Rota["opts"], handler: Rota["handler"]) => rotas.set(`GET ${path}`, { opts, handler }),
  post: (path: string, opts: Rota["opts"], handler: Rota["handler"]) => rotas.set(`POST ${path}`, { opts, handler }),
};

class MockReply {
  statusCode = 200;
  body: unknown = undefined;
  sent = false;
  status(codigo: number) {
    this.statusCode = codigo;
    return this;
  }
  send(corpo: unknown) {
    this.body = corpo;
    this.sent = true;
    return this;
  }
}

async function chamar(rota: string, user: { sub: string; perfil: string } | undefined, body: unknown) {
  const r = rotas.get(rota);
  assert.ok(r, `rota ${rota} não registrada`);
  const log = {
    info: (...a: unknown[]) => logs.push(a),
    error: (...a: unknown[]) => logs.push(a),
    warn: (...a: unknown[]) => logs.push(a),
  };
  const req = { user, body, log };
  const reply = new MockReply();
  await (r.opts.preHandler as typeof autenticar)(req, reply);
  if (reply.sent) return reply;
  const retorno = await r.handler(req, reply);
  if (!reply.sent && retorno !== undefined) reply.body = retorno;
  return reply;
}

const professor = { sub: PROFESSOR_ID, perfil: "PROFESSOR" };
const aluno = { sub: ALUNO_ID, perfil: "ALUNO" };
const corpoValido = { alunoId: ALUNO_ID, prontuarioId: PRONT_ID, operations: ["atualizar-secao"] };

before(async () => {
  await (acessosRoutes as unknown as (a: unknown, o: unknown) => Promise<void>)(app, {});
});

beforeEach(() => {
  chave = semChave();
  autorizacoes = [];
  consultas = [];
  vencedorDaCorrida = null;
  logs = [];
});

describe("POST /acessos/autorizar", () => {
  it("professor autenticado autoriza: 200 com {id, payload, signature, publicKeyPem}", async () => {
    const reply = await chamar("POST /acessos/autorizar", professor, corpoValido);
    assert.equal(reply.statusCode, 200);
    const corpo = reply.body as {
      id: string;
      payload: Record<string, unknown>;
      signature: string;
      publicKeyPem: string;
    };
    assert.deepEqual(Object.keys(corpo).sort(), ["id", "payload", "publicKeyPem", "signature"]);
    assert.equal(corpo.payload.professorId, PROFESSOR_ID);
    assert.equal(corpo.payload.alunoId, ALUNO_ID);
    assert.equal(corpo.payload.prontuarioId, PRONT_ID);
    assert.deepEqual(corpo.payload.operations, ["atualizar-secao"]);
    assert.match(String(corpo.payload.nonce), /^[0-9a-f-]{36}$/);
    const emitida = new Date(String(corpo.payload.issuedAt)).getTime();
    const expira = new Date(String(corpo.payload.expiresAt)).getTime();
    assert.equal(expira - emitida, 7 * 24 * 3600 * 1000);
    assert.equal(verify(corpo.payload, corpo.signature, corpo.publicKeyPem), true);
    assert.equal(autorizacoes.length, 1);
    assert.equal(autorizacoes[0]?.id, corpo.id);
    assert.equal(autorizacoes[0]?.publicKeyPem, corpo.publicKeyPem);
  });

  it("resposta, logs e consultas de saída não vazam chave cifrada, salt, iv nem PEM privado", async () => {
    const reply = await chamar("POST /acessos/autorizar", professor, corpoValido);
    const saida = JSON.stringify(reply.body);
    assert.ok(chave.encryptedPrivateKey && chave.keySalt && chave.keyIv);
    for (const proibido of ["encryptedPrivateKey", "keySalt", "keyIv", "keyIter", "PRIVATE KEY"]) {
      assert.ok(!saida.includes(proibido), `resposta contém ${proibido}`);
    }
    for (const segredo of [chave.encryptedPrivateKey, chave.keySalt, chave.keyIv, PASSPHRASE]) {
      assert.ok(!saida.includes(segredo), "resposta contém material secreto");
      assert.ok(!JSON.stringify(logs).includes(segredo), "log contém material secreto");
    }
    assert.ok(!JSON.stringify(logs).includes("PRIVATE KEY"));
  });

  it("primeira autorização gera e persiste a chave cifrada; a segunda reutiliza a mesma", async () => {
    const primeira = await chamar("POST /acessos/autorizar", professor, corpoValido);
    const publica = (primeira.body as { publicKeyPem: string }).publicKeyPem;
    assert.equal(chave.publicKey, publica);
    assert.equal(chave.keyIter, 210000);
    const pem = decryptPrivateKey(
      {
        ciphertextB64: chave.encryptedPrivateKey as string,
        saltB64: chave.keySalt as string,
        ivB64: chave.keyIv as string,
        iter: chave.keyIter as number,
      },
      PASSPHRASE,
    );
    assert.match(pem, /BEGIN PRIVATE KEY/);

    const segunda = await chamar("POST /acessos/autorizar", professor, corpoValido);
    assert.equal((segunda.body as { publicKeyPem: string }).publicKeyPem, publica);
    assert.equal(consultas.filter((c) => c.text.includes('UPDATE "Usuario"')).length, 1);
  });

  it("corrida na primeira chave: UPDATE com 0 linhas relê e usa a chave vencedora", async () => {
    const vencedora = generateKeyPair();
    vencedorDaCorrida = chaveCifrada(vencedora);
    const reply = await chamar("POST /acessos/autorizar", professor, corpoValido);
    assert.equal(reply.statusCode, 200);
    const corpo = reply.body as { payload: Record<string, unknown>; signature: string; publicKeyPem: string };
    assert.equal(corpo.publicKeyPem, vencedora.publicKeyPem);
    assert.equal(chave.publicKey, vencedora.publicKeyPem);
    assert.equal(verify(corpo.payload, corpo.signature, vencedora.publicKeyPem), true);
  });

  it("passphrase incompatível com a chave salva: 500 genérico sem vazar segredos", async () => {
    const outra = encryptPrivateKey(generateKeyPair().privateKeyPem, "outra-passphrase-com-mais-de-32-caracteres!!");
    const par = generateKeyPair();
    chave = {
      publicKey: par.publicKeyPem,
      encryptedPrivateKey: outra.ciphertextB64,
      keySalt: outra.saltB64,
      keyIv: outra.ivB64,
      keyIter: outra.iter,
    };
    const reply = await chamar("POST /acessos/autorizar", professor, corpoValido);
    assert.equal(reply.statusCode, 500);
    const saida = JSON.stringify([reply.body, logs]);
    assert.ok(!saida.includes(PASSPHRASE));
    assert.ok(!saida.includes(outra.ciphertextB64));
    assert.equal(autorizacoes.length, 0);
  });

  it("aluno chamando /autorizar recebe 403 e nada é persistido", async () => {
    const reply = await chamar("POST /acessos/autorizar", aluno, corpoValido);
    assert.equal(reply.statusCode, 403);
    assert.equal(autorizacoes.length, 0);
    assert.equal(consultas.length, 0);
  });

  it("usuário não autenticado recebe 401 (rota protegida por app.autenticar)", async () => {
    assert.equal(rotas.get("POST /acessos/autorizar")?.opts.preHandler, autenticar);
    const reply = await chamar("POST /acessos/autorizar", undefined, corpoValido);
    assert.equal(reply.statusCode, 401);
    assert.equal(autorizacoes.length, 0);
  });

  it("professor que não é o supervisor do prontuário recebe 403", async () => {
    const reply = await chamar("POST /acessos/autorizar", { sub: OUTRO_PROFESSOR_ID, perfil: "PROFESSOR" }, corpoValido);
    assert.equal(reply.statusCode, 403);
    assert.equal(autorizacoes.length, 0);
  });

  it("aluno diferente do titular do prontuário recebe 403; prontuário inexistente recebe 404", async () => {
    const divergente = await chamar("POST /acessos/autorizar", professor, { ...corpoValido, alunoId: "aluno-x" });
    assert.equal(divergente.statusCode, 403);
    const inexistente = await chamar("POST /acessos/autorizar", professor, { ...corpoValido, prontuarioId: "nao-existe" });
    assert.equal(inexistente.statusCode, 404);
    assert.equal(autorizacoes.length, 0);
  });
});

describe("POST /acessos/revogar", () => {
  async function emitir(): Promise<string> {
    const reply = await chamar("POST /acessos/autorizar", professor, corpoValido);
    return (reply.body as { id: string }).id;
  }

  it("revogar seta revokedAt", async () => {
    const id = await emitir();
    assert.equal(autorizacoes[0]?.revokedAt, null);
    const reply = await chamar("POST /acessos/revogar", professor, { autorizacaoId: id });
    assert.equal(reply.statusCode, 200);
    const revokedAt = autorizacoes[0]?.revokedAt;
    assert.ok(typeof revokedAt === "string" && !Number.isNaN(new Date(revokedAt).getTime()));
    assert.equal((reply.body as { revokedAt: string }).revokedAt, revokedAt);
  });

  it("revogar de novo é idempotente e preserva o primeiro revokedAt", async () => {
    const id = await emitir();
    await chamar("POST /acessos/revogar", professor, { autorizacaoId: id });
    const primeiro = autorizacoes[0]?.revokedAt;
    const reply = await chamar("POST /acessos/revogar", professor, { autorizacaoId: id });
    assert.equal(reply.statusCode, 200);
    assert.equal(autorizacoes[0]?.revokedAt, primeiro);
  });

  it("só o professor autor revoga; aluno recebe 403; id inexistente recebe 404", async () => {
    const id = await emitir();
    const outro = await chamar("POST /acessos/revogar", { sub: OUTRO_PROFESSOR_ID, perfil: "PROFESSOR" }, { autorizacaoId: id });
    assert.equal(outro.statusCode, 403);
    const comoAluno = await chamar("POST /acessos/revogar", aluno, { autorizacaoId: id });
    assert.equal(comoAluno.statusCode, 403);
    const inexistente = await chamar("POST /acessos/revogar", professor, { autorizacaoId: "nao-existe" });
    assert.equal(inexistente.statusCode, 404);
    assert.equal(autorizacoes[0]?.revokedAt, null);
  });

  it("não autenticado recebe 401", async () => {
    const reply = await chamar("POST /acessos/revogar", undefined, { autorizacaoId: "x" });
    assert.equal(reply.statusCode, 401);
  });
});
