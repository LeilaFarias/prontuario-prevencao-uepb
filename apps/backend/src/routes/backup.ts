import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { executar } from "../db";
import { criptografarBackup, exportarBanco } from "../lib/backup";

export const backupRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  app.get("/admin/backup", { preHandler: app.autenticar }, async (req, reply) => {
    if (req.user.perfil !== "professor") {
      return reply.status(403).send({ message: "Apenas professores podem baixar o backup." });
    }

    const buffer = criptografarBackup(await exportarBanco(db));

    const nome = `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json.enc`;
    await executar(db, `INSERT INTO "AuditLog" ("id", "usuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4)`, [
      randomUUID(),
      req.user.sub,
      "backup-baixado",
      JSON.stringify({ arquivo: nome, tamanhoBytes: buffer.length }),
    ]);

    return reply
      .header("Content-Type", "application/octet-stream")
      .header("Content-Disposition", `attachment; filename="${nome}"`)
      .send(buffer);
  });
};
