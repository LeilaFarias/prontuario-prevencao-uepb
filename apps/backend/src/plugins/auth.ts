import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { uma } from "../db";
import { env } from "../env";
import { SQL_VERSAO_ATUAL } from "../lib/termos";

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

const ROTAS_ISENTAS_TERMOS = new Set(["GET /users/me", "POST /users/me/aceitar-termos", "GET /termos", "GET /health"]);
const PREFIXOS_ISENTOS_TERMOS = ["/auth/"];

function rotaIsentaDeTermos(req: FastifyRequest): boolean {
  const caminho = req.url.split("?")[0] ?? "";
  return (
    ROTAS_ISENTAS_TERMOS.has(`${req.method} ${caminho}`) ||
    PREFIXOS_ISENTOS_TERMOS.some((prefixo) => caminho.startsWith(prefixo))
  );
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

    const usuario = await uma<{
      tokenVersion: number;
      termosAceitosEm: string | null;
      termosVersao: string | null;
      versaoAtual: string | null;
    }>(
      app.db,
      `SELECT "tokenVersion", "termosAceitosEm", "termosVersao", ${SQL_VERSAO_ATUAL} AS "versaoAtual"
         FROM "Usuario" WHERE "id" = $1 AND "ativo"`,
      [req.user.sub],
    );
    if (!usuario) return reply.status(401).send(SESSAO_EXPIRADA);
    if (usuario.tokenVersion !== (req.user.tokenVersion ?? 0)) return reply.status(401).send(SESSAO_EXPIRADA);

    const { versaoAtual } = usuario;
    const termosPendentes = !usuario.termosAceitosEm || usuario.termosVersao !== versaoAtual;
    if (
      versaoAtual &&
      (req.user.perfil === "aluno" || req.user.perfil === "professor") &&
      termosPendentes &&
      !rotaIsentaDeTermos(req)
    ) {
      return reply.status(403).send({
        message: "É necessário aceitar os Termos de Uso.",
        codigo: "TERMOS_NAO_ACEITOS",
        versaoAtual,
      });
    }
  });
});
