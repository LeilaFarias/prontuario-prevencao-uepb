import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { loginSchema, signupSchema, type LoginResponse } from "@prontuario/shared";
import { executar, uma } from "../db";
import { env } from "../env";
import { hashSenha, verificarSenha } from "../lib/senha";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  perfil: string;
  matricula: string | null;
  ativo: boolean;
  tokenVersion: number;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
app.post("/auth/signup", async (req, reply) => {
  const dados = signupSchema.parse(req.body);
  const matricula = dados.perfil === "professor" ? dados.matricula || null : null;

  const existente = await uma<{ id: string; ativo: boolean }>(
    db,
    `SELECT "id", "ativo" FROM "Usuario" WHERE "email" = $1`,
    [dados.email],
  );

  if (existente && existente.ativo) {
    return reply.status(409).send({ message: "Já existe uma conta com este e-mail." });
  }

  if (matricula) {
    const matriculaExistente = await uma<{ id: string }>(
      db,
      `SELECT "id" FROM "Usuario" WHERE "matricula" = $1`,
      [matricula],
    );

    if (matriculaExistente && matriculaExistente.id !== existente?.id) {
      return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }
  }

  const senhaHash = await hashSenha(dados.senha);

  if (existente) {
    await executar(
      db,
      `UPDATE "Usuario"
       SET "ativo" = TRUE,
           "nome" = $1,
           "senhaHash" = $2,
           "perfil" = $3,
           "matricula" = $4
       WHERE "id" = $5`,
      [dados.nome, senhaHash, dados.perfil.toUpperCase(), matricula, existente.id],
    );

    return reply.status(200).send({ id: existente.id, reativada: true });
  }

  const id = randomUUID();
  await executar(
    db,
    `INSERT INTO "Usuario" ("id", "nome", "email", "senhaHash", "perfil", "matricula") VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, dados.nome, dados.email, senhaHash, dados.perfil.toUpperCase(), matricula],
  );

  return reply.status(201).send({ id });
});

  app.post(
    "/auth/login",
      { config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: "15 minutes" } } },    
      async (req, reply) => {
      const dados = loginSchema.parse(req.body);
      const usuario = await uma<UsuarioRow>(db, `SELECT * FROM "Usuario" WHERE "email" = $1`, [dados.email]);
      const ok = usuario ? await verificarSenha(dados.senha, usuario.senhaHash) : false;
      if (!usuario || !ok) {
        return reply.status(401).send({ message: "E-mail ou senha incorretos." });
      }

      if (!usuario.ativo) {
        return reply.status(401).send({ message: "Conta desativada." });
      }

      const perfil = usuario.perfil.toLowerCase() as "aluno" | "professor";
      const { tokenVersion } = usuario;
      const accessToken = app.jwt.sign({ sub: usuario.id, perfil, tokenVersion }, { expiresIn: env.JWT_ACCESS_TTL });
      const refreshToken = app.jwt.sign(
        { sub: usuario.id, perfil, tokenVersion, tipo: "refresh" },
        { expiresIn: env.JWT_REFRESH_TTL },
      );

      const resposta: LoginResponse = {
        accessToken,
        refreshToken,
        user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil, matricula: usuario.matricula },
      };
      return resposta;
    },
  );
};
