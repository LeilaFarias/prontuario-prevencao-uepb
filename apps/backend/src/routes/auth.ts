import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { loginSchema, signupSchema, type LoginResponse } from "@prontuario/shared";
import { executar, transacao, uma } from "../db";
import { env } from "../env";
import { emailPermitidoParaSignup, emailTemBypassConfirmacao } from "../lib/email-institucional";
import { enviarEmailConfirmacao } from "../lib/mail";
import { gerarHashesPinCriptografia, gerarHashesPinLiberacao } from "../lib/pin";
import { hashSenha, verificarSenha } from "../lib/senha";

const EXPIRACAO_CONFIRMAR_MS = 24 * 60 * 60 * 1000;
const gerarTokenConfirmacao = () => randomBytes(32).toString("hex");
const hashTokenConfirmacao = (token: string) => createHmac("sha256", env.RESET_TOKEN_SECRET).update(token).digest("hex");

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  perfil: string;
  matricula: string | null;
  ativo: boolean;
  tokenVersion: number;
  emailVerificadoEm: string | null;
}

interface ConfirmacaoRow {
  id: string;
  userId: string;
  expiraEm: string;
  usadoEm: string | null;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  async function criarTokenConfirmacao(userId: string, email: string, nome: string) {
    const token = gerarTokenConfirmacao();
    const agora = new Date().toISOString();
    await transacao(db, async (tx) => {
      await executar(tx, `UPDATE "EmailVerificationToken" SET "usadoEm" = $1 WHERE "userId" = $2 AND "usadoEm" IS NULL`, [agora, userId]);
      await executar(
        tx,
        `INSERT INTO "EmailVerificationToken" ("id", "userId", "tokenHash", "expiraEm", "criadoEm") VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), userId, hashTokenConfirmacao(token), new Date(Date.now() + EXPIRACAO_CONFIRMAR_MS).toISOString(), agora],
      );
    });
    const link = `${env.APP_URL}/confirmar-email?token=${token}`;
    await enviarEmailConfirmacao({ para: email, nome, link });
  }

  app.post("/auth/signup", async (req, reply) => {
    const dados = signupSchema.parse(req.body);
    const emailNormalizado = dados.email.trim().toLowerCase();
    const bypassConfirmacao = dados.perfil === "professor" && emailTemBypassConfirmacao(emailNormalizado, env.PROFESSOR_INVITE_CODE);

    if (!emailPermitidoParaSignup(emailNormalizado, dados.perfil, env.PROFESSOR_INVITE_CODE)) {
      return reply.status(400).send({
        message: dados.perfil === "aluno"
          ? "O cadastro de aluno é restrito a emails @aluno.uepb.edu.br."
          : "Para cadastrar um professor, use um e-mail @servidor.uepb.edu.br ou um e-mail autorizado na lista de convites.",
        codigo: "EMAIL_NAO_AUTORIZADO",
      });
    }

    const matricula = dados.perfil === "professor" ? dados.matricula || null : null;
    const existente = await uma<{ id: string; ativo: boolean }>(db, `SELECT "id", "ativo" FROM "Usuario" WHERE "email" = $1`, [emailNormalizado]);
    if (existente) {
      if (existente.ativo) return reply.status(409).send({ message: "Já existe uma conta com este e-mail." });
      return reply.status(400).send({ message: "Não foi possível criar a conta com este e-mail.", codigo: "EMAIL_INDISPONIVEL" });
    }

    if (matricula) {
      const matriculaExistente = await uma<{ id: string }>(db, `SELECT "id" FROM "Usuario" WHERE "matricula" = $1`, [matricula]);
      if (matriculaExistente) return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }

    const senhaHash = await hashSenha(dados.senha);
    const cripto = await gerarHashesPinCriptografia(dados.pin);
    const liberacao = dados.perfil === "professor" ? await gerarHashesPinLiberacao(dados.pin) : null;
    const id = randomUUID();
    const emailVerificadoEm = dados.perfil === "professor" && !bypassConfirmacao ? null : new Date().toISOString();

    await executar(
      db,
      `INSERT INTO "Usuario" ("id", "nome", "email", "senhaHash", "perfil", "matricula",
         "pinCriptografiaHash", "saltCriptografia", "pinHash", "saltServer", "pinHashClient", "saltClient", "emailVerificadoEm")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, dados.nome, emailNormalizado, senhaHash, dados.perfil.toUpperCase(), matricula,
        cripto.pinCriptografiaHash, cripto.saltCriptografia,
        liberacao?.pinHash ?? null, liberacao?.saltServer ?? null,
        liberacao?.pinHashClient ?? null, liberacao?.saltClient ?? null, emailVerificadoEm],
    );

    if (dados.perfil === "professor" && !bypassConfirmacao) {
      try {
        await criarTokenConfirmacao(id, emailNormalizado, dados.nome);
      } catch (erro) {
        req.log.error(erro, "Falha ao enviar confirmação de e-mail");
        return reply.status(201).send({
          id,
          emailConfirmationRequired: true,
          message: "Conta criada, mas não foi possível enviar o e-mail agora. Use a opção de reenviar confirmação na tela de login.",
          codigo: "CONFIRMACAO_EMAIL_NAO_ENVIADA",
        });
      }
    }

    return reply.status(201).send({
      id,
      emailConfirmationRequired: dados.perfil === "professor" && !bypassConfirmacao,
      message: bypassConfirmacao ? "Conta criada e e-mail autorizado." : "Conta criada.",
    });
  });

  app.get("/auth/verify-email-token", async (req) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.query);
    const registro = await uma<ConfirmacaoRow>(db,
      `SELECT "id", "userId", "expiraEm", "usadoEm" FROM "EmailVerificationToken" WHERE "tokenHash" = $1`,
      [hashTokenConfirmacao(token)],
    );
    return { valido: !!registro && registro.usadoEm === null && registro.expiraEm >= new Date().toISOString() };
  });

  app.post("/auth/confirm-email", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const registro = await uma<ConfirmacaoRow>(db,
      `SELECT "id", "userId", "expiraEm", "usadoEm" FROM "EmailVerificationToken" WHERE "tokenHash" = $1`,
      [hashTokenConfirmacao(token)],
    );
    if (!registro || registro.usadoEm !== null || registro.expiraEm < new Date().toISOString()) {
      return reply.status(400).send({ message: "Link inválido ou expirado." });
    }
    const agora = new Date().toISOString();
    const confirmado = await transacao(db, async (tx) => {
      const consumido = await executar(tx, `UPDATE "EmailVerificationToken" SET "usadoEm" = $1 WHERE "id" = $2 AND "usadoEm" IS NULL AND "expiraEm" > $1`, [agora, registro.id]);
      if (!consumido) return false;
      await executar(tx, `UPDATE "Usuario" SET "emailVerificadoEm" = $1 WHERE "id" = $2`, [agora, registro.userId]);
      await executar(tx, `UPDATE "EmailVerificationToken" SET "usadoEm" = $1 WHERE "userId" = $2 AND "usadoEm" IS NULL`, [agora, registro.userId]);
      return true;
    });
    if (!confirmado) return reply.status(400).send({ message: "Link inválido ou expirado." });
    return { ok: true };
  });

  app.post("/auth/resend-confirmation", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (req, reply) => {
    const { email } = z.object({ email: z.string().email().transform((v) => v.trim().toLowerCase()) }).parse(req.body);
    const usuario = await uma<{ id: string; nome: string; email: string; emailVerificadoEm: string | null; perfil: string }>(
      db, `SELECT "id", "nome", "email", "emailVerificadoEm", "perfil" FROM "Usuario" WHERE "email" = $1 AND "ativo"`, [email],
    );
    if (usuario && usuario.perfil.toLowerCase() === "professor" && !usuario.emailVerificadoEm) {
      await criarTokenConfirmacao(usuario.id, usuario.email, usuario.nome);
    }
    return { ok: true, message: "Se houver uma conta aguardando confirmação para esse e-mail, enviaremos um novo link." };
  });

  app.post("/auth/login", { config: { rateLimit: env.LOGIN_RATE_LIMIT_MAX === 0 ? false : { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: "1 minute" } } }, async (req, reply) => {
    const dados = loginSchema.parse(req.body);
    const usuario = await uma<UsuarioRow>(db, `SELECT * FROM "Usuario" WHERE "email" = $1`, [dados.email]);
    const ok = usuario ? await verificarSenha(dados.senha, usuario.senhaHash) : false;
    if (!usuario || !ok) return reply.status(401).send({ message: "E-mail ou senha incorretos." });
    if (!usuario.ativo) return reply.status(401).send({ message: "Conta desativada." });
    if (usuario.perfil.toLowerCase() === "professor" && !usuario.emailVerificadoEm) {
      return reply.status(403).send({
        message: "Confirme seu e-mail pelo link enviado antes de entrar. Se necessário, solicite um novo link.",
        codigo: "EMAIL_NAO_VERIFICADO",
      });
    }

    const perfil = usuario.perfil.toLowerCase() as "aluno" | "professor";
    const { tokenVersion } = usuario;
    const accessToken = app.jwt.sign({ sub: usuario.id, perfil, tokenVersion }, { expiresIn: env.JWT_ACCESS_TTL });
    const refreshToken = app.jwt.sign({ sub: usuario.id, perfil, tokenVersion, tipo: "refresh" }, { expiresIn: env.JWT_REFRESH_TTL });
    const resposta: LoginResponse = {
      accessToken, refreshToken,
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil, matricula: usuario.matricula },
    };
    return resposta;
  });
};
