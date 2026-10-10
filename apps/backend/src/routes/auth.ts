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
  ativo: number;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
app.post("/auth/signup", async (req, reply) => {
  const dados = signupSchema.parse(req.body);
  const matricula = dados.perfil === "professor" ? dados.matricula || null : null;

  const existente = db.prepare(
    "SELECT id, ativo FROM Usuario WHERE email = ?"
  ).get(dados.email) as { id: string; ativo: number } | undefined;

  if (existente && existente.ativo === 1) {
    return reply.status(409).send({ message: "Já existe uma conta com este e-mail." });
  }

  if (matricula) {
    const matriculaExistente = db.prepare(
      "SELECT id FROM Usuario WHERE matricula = ?"
    ).get(matricula) as { id: string } | undefined;

    if (matriculaExistente && matriculaExistente.id !== existente?.id) {
      return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }
  }

  const senhaHash = await hashSenha(dados.senha);

  if (existente) {
    db.prepare(`
      UPDATE Usuario
      SET ativo = 1,
          nome = ?,
          senhaHash = ?,
          perfil = ?,
          matricula = ?
      WHERE id = ?
    `).run(
      dados.nome,
      senhaHash,
      dados.perfil.toUpperCase(),
      matricula,
      existente.id
    );

    return reply.status(200).send({ id: existente.id, reativada: true });
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO Usuario (id, nome, email, senhaHash, perfil, matricula) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, dados.nome, dados.email, senhaHash, dados.perfil.toUpperCase(), matricula);

  return reply.status(201).send({ id });
});

  app.post("/auth/login", async (req, reply) => {
    const dados = loginSchema.parse(req.body);
    const usuario = db.prepare("SELECT * FROM Usuario WHERE email = ?").get(dados.email) as
      | UsuarioRow
      | undefined;
    const ok = usuario ? await verificarSenha(dados.senha, usuario.senhaHash) : false;
    if (!usuario || !ok) {
      return reply.status(401).send({ message: "E-mail ou senha incorretos." });
    }

    if (!usuario.ativo) {
      return reply.status(401).send({ message: "Conta desativada." });
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
