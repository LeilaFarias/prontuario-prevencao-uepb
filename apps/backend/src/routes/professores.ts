import type { FastifyPluginAsync } from "fastify";
import { todas } from "../db";

interface ProfessorRow {
  id: string;
  nome: string;
  matricula: string | null;
}

export const professoresRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const listar = `SELECT "id", "nome", "matricula" FROM "Usuario" WHERE UPPER("perfil") = 'PROFESSOR' AND "ativo" ORDER BY "nome"`;

  app.get("/professores", { preHandler: app.autenticar }, async () => {
    return todas<ProfessorRow>(db, listar);
  });
};
