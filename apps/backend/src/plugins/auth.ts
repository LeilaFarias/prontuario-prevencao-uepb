import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env";

interface TokenPayload {
  sub: string;
  perfil: "aluno" | "professor";
  tokenVersion: number;
  tipo?: "refresh";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const SESSAO_EXPIRADA = {
  message: "Sessão inválida ou expirada. Entre novamente.",
  codigo: "SESSAO_EXPIRADA",
};

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate("autenticar", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send(SESSAO_EXPIRADA);
    }
    if (req.user.tipo === "refresh") return reply.status(401).send(SESSAO_EXPIRADA);

    const usuario = app.db
      .prepare("SELECT tokenVersion FROM Usuario WHERE id = ? AND ativo = 1")
      .get(req.user.sub) as unknown as { tokenVersion: number } | undefined;
    if (!usuario) return reply.status(401).send(SESSAO_EXPIRADA);
    if (usuario.tokenVersion !== (req.user.tokenVersion ?? 0)) return reply.status(401).send(SESSAO_EXPIRADA);
  });
});
