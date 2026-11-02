import type { FastifyPluginAsync } from "fastify";

interface ProfessorRow {
  id: string;
  nome: string;
  matricula: string | null;
}

export const professoresRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const listar = db.prepare(
    "SELECT id, nome, matricula FROM Usuario WHERE UPPER(perfil) = 'PROFESSOR' AND ativo = 1 ORDER BY nome",
  );

  app.get("/professores", { preHandler: app.autenticar }, async () => {
    return listar.all() as unknown as ProfessorRow[];
  });
};
