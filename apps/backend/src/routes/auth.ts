import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { loginSchema, signupSchema, type LoginResponse } from "@prontuario/shared";
import { env } from "../env";
import { hashSenha, verificarSenha } from "../lib/senha";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  perfil: string;
  matricula: string | null;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  app.post("/auth/signup", async (req, reply) => {
    const dados = signupSchema.parse(req.body);
    const matricula = dados.perfil === "professor" ? dados.matricula || null : null;

    if (db.prepare("SELECT 1 FROM Usuario WHERE email = ?").get(dados.email)) {
      return reply.status(409).send({ message: "Já existe uma conta com este e-mail ou usuário." });
    }
    if (matricula && db.prepare("SELECT 1 FROM Usuario WHERE matricula = ?").get(matricula)) {
      return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }

    const id = randomUUID();
    db.prepare(
      "INSERT INTO Usuario (id, nome, email, senhaHash, perfil, matricula) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, dados.nome, dados.email, await hashSenha(dados.senha), dados.perfil.toUpperCase(), matricula);

    return reply.status(201).send({ id });
  });

  app.post("/auth/login", async (req, reply) => {
    const dados = loginSchema.parse(req.body);
    const usuario = db.prepare("SELECT * FROM Usuario WHERE email = ?").get(dados.email) as
      | UsuarioRow
      | undefined;
    const ok = usuario ? await verificarSenha(dados.senha, usuario.senhaHash) : false;
    if (!usuario || !ok) {
      return reply.status(401).send({ message: "E-mail/usuário ou senha incorretos." });
    }

    const perfil = usuario.perfil.toLowerCase() as "aluno" | "professor";
    const accessToken = app.jwt.sign({ sub: usuario.id, perfil }, { expiresIn: env.JWT_ACCESS_TTL });
    const refreshToken = app.jwt.sign(
      { sub: usuario.id, perfil, tipo: "refresh" },
      { expiresIn: env.JWT_REFRESH_TTL },
    );

    const resposta: LoginResponse = {
      accessToken,
      refreshToken,
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil, matricula: usuario.matricula },
    };
    return resposta;
  });
};
