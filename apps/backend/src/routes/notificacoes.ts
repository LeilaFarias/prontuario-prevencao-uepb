import type { FastifyPluginAsync } from "fastify";
import type { NotificacaoAluno } from "@prontuario/shared";
import { executar, todas } from "../db";

export const notificacoesRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const listar = `SELECT "id", "prontuarioId", "tipo", "mensagem", "criadoEm"
     FROM "Notificacao" WHERE "usuarioId" = $1 AND "lidaEm" IS NULL ORDER BY "criadoEm" DESC`;
  const marcarLida = `UPDATE "Notificacao" SET "lidaEm" = $1 WHERE "id" = $2 AND "usuarioId" = $3 AND "lidaEm" IS NULL`;

  app.get("/notificacoes", protegida, async (req) => {
    return todas<NotificacaoAluno>(db, listar, [req.user.sub]);
  });

  app.post<{ Params: { id: string } }>("/notificacoes/:id/lida", protegida, async (req) => {
    await executar(db, marcarLida, [new Date().toISOString(), req.params.id, req.user.sub]);
    return { ok: true };
  });
};
