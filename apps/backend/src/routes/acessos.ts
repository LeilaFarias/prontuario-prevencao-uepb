import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AcessoPendente, AcessoVigente, AcessosResponse } from "@prontuario/shared";
import { executar, todas, transacao, uma, type Executor } from "../db";
import { env } from "../env";
import { tempoDeEspera } from "../lib/acesso";
import { decryptPrivateKey, encryptPrivateKey, generateKeyPair, generateNonce, sign } from "../lib/signature";

interface PendenteRow {
  id: string;
  pacienteNome: string;
  acessoSolicitadoEm: string;
  alunoNome: string;
}

interface VigenteRow {
  id: string;
  pacienteNome: string;
  acessoExpiraEm: string;
  alunoNome: string;
}

interface ProntuarioVinculoRow {
  status: string;
  alunoTitularId: string;
  professorSupervisorId: string | null;
}

interface ChaveRow {
  publicKey: string | null;
  encryptedPrivateKey: string | null;
  keySalt: string | null;
  keyIv: string | null;
  keyIter: number | null;
}

interface AutorizacaoRow {
  id: string;
  professorId: string;
  revokedAt: string | null;
}

type Falha = { falha: 403 | 404 | 500; error: string };

const autorizarSchema = z.object({
  alunoId: z.string().trim().min(1),
  prontuarioId: z.string().trim().min(1),
  operations: z.array(z.string().trim().min(1)).min(1).max(50),
});

const revogarSchema = z.object({ autorizacaoId: z.string().trim().min(1) });

const NAO_ENCONTRADO: Falha = { falha: 404, error: "Prontuário não encontrado." };
const NAO_SUPERVISOR: Falha = { falha: 403, error: "Apenas o professor supervisor pode realizar esta ação." };
const ALUNO_DIVERGENTE: Falha = { falha: 403, error: "O aluno informado não é o titular do prontuário." };
const CHAVE_INDISPONIVEL: Falha = { falha: 500, error: "Não foi possível acessar a chave de assinatura do professor." };
const AUTORIZACAO_NAO_ENCONTRADA: Falha = { falha: 404, error: "Autorização não encontrada." };
const NAO_AUTOR: Falha = { falha: 403, error: "Apenas o professor autor da autorização pode revogá-la." };

const buscarAcesso = `SELECT "status", "alunoTitularId", "professorSupervisorId",
       "acessoSolicitadoEm", "acessoExpiraEm", "acessoRevogadoEm", "acessoRecusadoEm"
      FROM "Prontuario" WHERE "id" = $1 FOR UPDATE`;
const buscarChave = `SELECT "publicKey", "encryptedPrivateKey", "keySalt", "keyIv", "keyIter" FROM "Usuario" WHERE "id" = $1`;
const gravarChave = `UPDATE "Usuario"
      SET "publicKey" = $1, "encryptedPrivateKey" = $2, "keySalt" = $3, "keyIv" = $4, "keyIter" = $5
      WHERE "id" = $6 AND "publicKey" IS NULL`;
const inserirAutorizacao = `INSERT INTO "AutorizacaoAssinada"
      ("id", "professorId", "alunoId", "prontuarioId", "operations", "issuedAt", "expiresAt", "nonce", "signature", "publicKeyPem")
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`;
const buscarAutorizacao = `SELECT "id", "professorId", "revokedAt" FROM "AutorizacaoAssinada" WHERE "id" = $1 FOR UPDATE`;
const gravarRevogacao = `UPDATE "AutorizacaoAssinada" SET "revokedAt" = $1 WHERE "id" = $2 AND "revokedAt" IS NULL`;

const DIA_MS = 24 * 3600 * 1000;

interface ParDeChaves {
  publicKeyPem: string;
  privateKeyPem: string;
}

async function obterChaveDoProfessor(tx: Executor, professorId: string): Promise<ParDeChaves | null> {
  let chave = await uma<ChaveRow>(tx, buscarChave, [professorId]);
  if (!chave) return null;

  if (!chave.publicKey) {
    const par = generateKeyPair();
    const cifrada = encryptPrivateKey(par.privateKeyPem, env.PROFESSOR_KEY_PASSPHRASE);
    const afetadas = await executar(tx, gravarChave, [
      par.publicKeyPem,
      cifrada.ciphertextB64,
      cifrada.saltB64,
      cifrada.ivB64,
      cifrada.iter,
      professorId,
    ]);
    if (afetadas === 1) return par;
    chave = await uma<ChaveRow>(tx, buscarChave, [professorId]);
    if (!chave) return null;
  }

  if (!chave.publicKey || !chave.encryptedPrivateKey || !chave.keySalt || !chave.keyIv || chave.keyIter === null) {
    return null;
  }
  const privateKeyPem = decryptPrivateKey(
    { ciphertextB64: chave.encryptedPrivateKey, saltB64: chave.keySalt, ivB64: chave.keyIv, iter: chave.keyIter },
    env.PROFESSOR_KEY_PASSPHRASE,
  );
  return { publicKeyPem: chave.publicKey, privateKeyPem };
}

export const acessosRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const listarPendentes = `SELECT p."id", p."pacienteNome", p."acessoSolicitadoEm", u."nome" AS "alunoNome"
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     WHERE p."professorSupervisorId" = $1
       AND p."descartadoEm" IS NULL
       AND p."acessoSolicitadoEm" IS NOT NULL
       AND p."acessoExpiraEm" IS NULL
       AND p."acessoRevogadoEm" IS NULL
     ORDER BY p."acessoSolicitadoEm" DESC`;
  const listarVigentes = `SELECT p."id", p."pacienteNome", p."acessoExpiraEm", u."nome" AS "alunoNome"
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     WHERE p."professorSupervisorId" = $1
       AND p."descartadoEm" IS NULL
       AND p."acessoExpiraEm" IS NOT NULL
       AND p."acessoExpiraEm" > $2
       AND p."acessoRevogadoEm" IS NULL
     ORDER BY p."acessoExpiraEm" ASC`;

  app.get("/acessos", { preHandler: app.autenticar }, async (req, reply): Promise<AcessosResponse | void> => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ error: "Apenas professores podem consultar acessos." });
    }

    const agora = Date.now();
    const pendentes = (await todas<PendenteRow>(db, listarPendentes, [req.user.sub])).map(
      (r): AcessoPendente => ({
        prontuarioId: r.id,
        pacienteNome: r.pacienteNome,
        alunoNome: r.alunoNome,
        solicitadoEm: r.acessoSolicitadoEm,
        tempoEspera: tempoDeEspera(r.acessoSolicitadoEm, agora),
      }),
    );
    const vigentes = (await todas<VigenteRow>(db, listarVigentes, [req.user.sub, new Date(agora).toISOString()])).map(
      (r): AcessoVigente => ({
        prontuarioId: r.id,
        pacienteNome: r.pacienteNome,
        alunoNome: r.alunoNome,
        acessoExpiraEm: r.acessoExpiraEm,
        segundosRestantes: Math.max(0, Math.floor((new Date(r.acessoExpiraEm).getTime() - agora) / 1000)),
      }),
    );
    return { pendentes, vigentes };
  });

  app.post("/acessos/autorizar", { preHandler: app.autenticar }, async (req, reply) => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ error: "Apenas professores podem autorizar acessos." });
    }
    const dados = autorizarSchema.parse(req.body);
    const professorId = req.user.sub;

    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioVinculoRow>(tx, buscarAcesso, [dados.prontuarioId]);
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== professorId) return NAO_SUPERVISOR;
      if (pront.alunoTitularId !== dados.alunoId) return ALUNO_DIVERGENTE;

      let chave: ParDeChaves | null;
      try {
        chave = await obterChaveDoProfessor(tx, professorId);
      } catch {
        return CHAVE_INDISPONIVEL;
      }
      if (!chave) return CHAVE_INDISPONIVEL;

      const agora = Date.now();
      const payload = {
        professorId,
        alunoId: dados.alunoId,
        prontuarioId: dados.prontuarioId,
        operations: dados.operations,
        issuedAt: new Date(agora).toISOString(),
        expiresAt: new Date(agora + env.AUTORIZACAO_TTL_DIAS * DIA_MS).toISOString(),
        nonce: generateNonce(),
      };
      const signature = sign(payload, chave.privateKeyPem);
      const id = randomUUID();
      await executar(tx, inserirAutorizacao, [
        id,
        professorId,
        payload.alunoId,
        payload.prontuarioId,
        JSON.stringify(payload.operations),
        payload.issuedAt,
        payload.expiresAt,
        payload.nonce,
        signature,
        chave.publicKeyPem,
      ]);
      return { resposta: { id, payload, signature, publicKeyPem: chave.publicKeyPem } };
    });

    if ("falha" in resultado) {
      if (resultado.falha === 500) req.log.error({ professorId }, "falha ao acessar a chave de assinatura");
      return reply.status(resultado.falha).send({ error: resultado.error });
    }
    req.log.info(
      { autorizacaoId: resultado.resposta.id, prontuarioId: dados.prontuarioId, professorId },
      "autorização assinada emitida",
    );
    return resultado.resposta;
  });

  app.post("/acessos/revogar", { preHandler: app.autenticar }, async (req, reply) => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ error: "Apenas professores podem revogar autorizações." });
    }
    const { autorizacaoId } = revogarSchema.parse(req.body);

    const resultado = await transacao(db, async (tx) => {
      const autorizacao = await uma<AutorizacaoRow>(tx, buscarAutorizacao, [autorizacaoId]);
      if (!autorizacao) return AUTORIZACAO_NAO_ENCONTRADA;
      if (autorizacao.professorId !== req.user.sub) return NAO_AUTOR;
      if (autorizacao.revokedAt) return { ok: true as const, revokedAt: autorizacao.revokedAt };

      const agora = new Date().toISOString();
      await executar(tx, gravarRevogacao, [agora, autorizacaoId]);
      return { ok: true as const, revokedAt: agora };
    });

    if ("falha" in resultado) return reply.status(resultado.falha).send({ error: resultado.error });
    req.log.info({ autorizacaoId, professorId: req.user.sub }, "autorização revogada");
    return resultado;
  });
};
