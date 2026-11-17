import type { FastifyPluginAsync } from "fastify";
import { todas } from "../db";

interface ProfessorRow {
  id: string;
  nome: string;
  email: string;
}

export const professoresRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const listar = `SELECT "id", "nome", "email" FROM "Usuario" WHERE UPPER("perfil") = 'PROFESSOR' AND "ativo" ORDER BY "nome"`;

  app.get("/professores", { preHandler: app.autenticar }, async () => {
    return todas<ProfessorRow>(db, listar);
  });
};
