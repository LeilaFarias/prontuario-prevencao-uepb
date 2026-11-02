import type { FastifyPluginAsync } from "fastify";
import type { NotificacaoAluno } from "@prontuario/shared";

export const notificacoesRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const listar = db.prepare(
    `SELECT id, prontuarioId, tipo, mensagem, criadoEm
     FROM Notificacao WHERE usuarioId = ? AND lidaEm IS NULL ORDER BY criadoEm DESC`,
  );
  const marcarLida = db.prepare(
    "UPDATE Notificacao SET lidaEm = ? WHERE id = ? AND usuarioId = ? AND lidaEm IS NULL",
  );

  app.get("/notificacoes", protegida, async (req) => {
    return listar.all(req.user.sub) as unknown as NotificacaoAluno[];
  });

  app.post<{ Params: { id: string } }>("/notificacoes/:id/lida", protegida, async (req) => {
    marcarLida.run(new Date().toISOString(), req.params.id, req.user.sub);
    return { ok: true };
  });
};
