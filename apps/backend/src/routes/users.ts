import { pbkdf2, randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  aceitarTermosSchema,
  alterarMatriculaSchema,
  alterarSenhaSchema,
  atualizarPerfilSchema,
  excluirContaSchema,
  type TermosResposta,
  type UsuarioMe,
} from "@prontuario/shared";
import { executar, todas, transacao, uma } from "../db";
import { hashSenha, verificarSenha } from "../lib/senha";
import { SQL_VERSAO_ATUAL } from "../lib/termos";

const scryptAsync = promisify(scrypt);
const pbkdf2Async = promisify(pbkdf2);

const definirPinSchema = z.object({
  pin: z.string().regex(/^\d{8}$/, "PIN deve ter 8 dígitos"),
});

const resetPinCriptografiaSchema = z.object({
  senha: z.string().min(1, "Informe a senha"),
});

const excluirContaComMotivoSchema = excluirContaSchema.extend({
  motivo: z.string().trim().max(500).optional(),
});

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  matricula: string | null;
  criadoEm: string;
  termosAceitosEm: string | null;
  termosVersao: string | null;
  versaoAtual: string | null;
  temPinCriptografia: boolean;
  saltCriptografia: string | null;
}

interface AlunoRow {
  id: string;
  nome: string;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const buscarMe = async (id: string): Promise<UsuarioMe> => {
    const u = (await uma<UsuarioRow>(
      db,
      `SELECT "id", "nome", "email", "perfil", "matricula", "criadoEm", "termosAceitosEm", "termosVersao",
              ${SQL_VERSAO_ATUAL} AS "versaoAtual",
              ("pinCriptografiaHash" IS NOT NULL) AS "temPinCriptografia", "saltCriptografia"
         FROM "Usuario" WHERE "id" = $1`,
      [id],
    )) as UsuarioRow;
    return { ...u, perfil: u.perfil.toLowerCase() as UsuarioMe["perfil"] };
  };

  const buscarHash = async (id: string): Promise<string | undefined> =>
    (await uma<{ senhaHash: string }>(db, `SELECT "senhaHash" FROM "Usuario" WHERE "id" = $1`, [id]))?.senhaHash;

  const listarAlunos = `SELECT "id", "nome" FROM "Usuario" WHERE UPPER("perfil") = 'ALUNO' AND "ativo" ORDER BY "nome"`;

  app.get("/alunos", protegida, async (req, reply) => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ message: "Apenas professores podem listar alunos." });
    }
    return todas<AlunoRow>(db, listarAlunos);
  });

  app.get("/termos", async (_req, reply) => {
    const termos = await uma<TermosResposta>(
      db,
      `SELECT "versao", "conteudo", "publicadaEm" FROM "TermosVersao" ORDER BY "publicadaEm" DESC LIMIT 1`,
    );
    if (!termos) return reply.status(404).send({ message: "Termos não publicados.", codigo: "TERMOS_NAO_PUBLICADOS" });
    return termos;
  });

  app.get("/users/me", protegida, async (req) => buscarMe(req.user.sub));

  app.post("/users/me/aceitar-termos", protegida, async (req, reply) => {
    const id = req.user.sub;
    const { versao } = aceitarTermosSchema.parse(req.body);

    if (!(await uma(db, `SELECT "id" FROM "TermosVersao" WHERE "versao" = $1`, [versao]))) {
      return reply.status(400).send({ message: "Versão dos termos inexistente.", codigo: "TERMOS_VERSAO_INVALIDA" });
    }

    await transacao(db, async (tx) => {
      await executar(tx, `UPDATE "Usuario" SET "termosAceitosEm" = now(), "termosVersao" = $1 WHERE "id" = $2`, [versao, id]);
      await executar(tx, `INSERT INTO "AuditLog" ("id", "usuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4)`, [
        randomUUID(),
        id,
        "termos-aceitos",
        JSON.stringify({ usuarioId: id, versao }),
      ]);
    });
    return reply.status(204).send();
  });

  app.put("/users/me", protegida, async (req, reply) => {
    const id = req.user.sub;
    const dados = atualizarPerfilSchema.parse(req.body);

    if (dados.email && (await uma(db, `SELECT "id" FROM "Usuario" WHERE "email" = $1 AND "id" != $2`, [dados.email, id]))) {
      return reply.status(409).send({ message: "Este e-mail já está em uso." });
    }

    const campos: string[] = [];
    const valores: string[] = [];
    if (dados.nome) {
      valores.push(dados.nome);
      campos.push(`"nome" = $${valores.length}`);
    }
    if (dados.email) {
      valores.push(dados.email);
      campos.push(`"email" = $${valores.length}`);
    }
    if (campos.length > 0) {
      await executar(db, `UPDATE "Usuario" SET ${campos.join(", ")} WHERE "id" = $${valores.length + 1}`, [...valores, id]);
    }
    return buscarMe(id);
  });

  app.put("/users/me/password", protegida, async (req, reply) => {
    const id = req.user.sub;
    const dados = alterarSenhaSchema.parse(req.body);

    const hashAtual = await buscarHash(id);
    if (!hashAtual || !(await verificarSenha(dados.senhaAtual, hashAtual))) {
      return reply.status(401).send({ message: "Senha atual incorreta." });
    }

    await executar(db, `UPDATE "Usuario" SET "senhaHash" = $1, "tokenVersion" = "tokenVersion" + 1 WHERE "id" = $2`, [
      await hashSenha(dados.novaSenha),
      id,
    ]);
    return { ok: true };
  });

  app.put("/users/me/pin", protegida, async (req, reply) => {
    const { pin } = definirPinSchema.parse(req.body);
    const saltServer = randomBytes(16).toString("hex");
    const saltClient = randomBytes(16).toString("hex");
    const pinHashServer = ((await scryptAsync(pin, saltServer, 64)) as Buffer).toString("hex");
    const pinHashClient = (await pbkdf2Async(pin, saltClient, 600000, 32, "sha256")).toString("hex");

    await executar(
      db,
      `UPDATE "Usuario" SET "pinHash" = $1, "saltServer" = $2, "pinHashClient" = $3, "saltClient" = $4 WHERE "id" = $5`,
      [pinHashServer, saltServer, pinHashClient, saltClient, req.user.sub],
    );
    return reply.status(204).send();
  });

  app.put("/users/me/pin-criptografia", protegida, async (req, reply) => {
    const { pin } = definirPinSchema.parse(req.body);
    const salt = randomBytes(16).toString("hex");
    const pinCriptografiaHash = ((await scryptAsync(pin, salt, 64)) as Buffer).toString("hex");

    await executar(db, `UPDATE "Usuario" SET "pinCriptografiaHash" = $1, "saltCriptografia" = $2 WHERE "id" = $3`, [
      pinCriptografiaHash,
      salt,
      req.user.sub,
    ]);
    return reply.status(204).send();
  });

  app.post(
    "/users/me/pin-criptografia/reset",
    { ...protegida, config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const id = req.user.sub;
      const { senha } = resetPinCriptografiaSchema.parse(req.body);

      const hash = await buscarHash(id);
      if (!hash || !(await verificarSenha(senha, hash))) {
        return reply.status(401).send({ message: "Senha incorreta." });
      }

      await executar(db, `UPDATE "Usuario" SET "pinCriptografiaHash" = NULL, "saltCriptografia" = NULL WHERE "id" = $1`, [id]);
      return reply.status(204).send();
    },
  );

  app.put("/users/me/matricula", protegida, async (req, reply) => {
    const id = req.user.sub;
    const atual = await buscarMe(id);
    if (atual.perfil !== "professor") {
      return reply.status(403).send({ message: "Apenas professores possuem matrícula." });
    }

    const { matricula } = alterarMatriculaSchema.parse(req.body);
    if (await uma(db, `SELECT "id" FROM "Usuario" WHERE "matricula" = $1 AND "id" != $2`, [matricula, id])) {
      return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }

    await executar(db, `UPDATE "Usuario" SET "matricula" = $1 WHERE "id" = $2`, [matricula, id]);
    return buscarMe(id);
  });

  app.delete("/users/me", protegida, async (req, reply) => {
    const id = req.user.sub;
    const { senha, motivo } = excluirContaComMotivoSchema.parse(req.body);

    const hash = await buscarHash(id);
    if (!hash || !(await verificarSenha(senha, hash))) {
      return reply.status(401).send({ message: "Senha incorreta." });
    }

    const motivoExclusao = motivo || null;
    await transacao(db, async (tx) => {
      await executar(tx, `UPDATE "Usuario" SET "ativo" = FALSE, "motivoExclusao" = $1 WHERE "id" = $2`, [motivoExclusao, id]);
      await executar(tx, `INSERT INTO "AuditLog" ("id", "usuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4)`, [
        randomUUID(),
        id,
        "conta-desativada",
        JSON.stringify({ usuarioId: id, motivo: motivoExclusao }),
      ]);
    });
    return { ok: true };
  });
};
