import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../env";
import { criptografarBackup } from "../lib/backup";

export const backupRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  app.get("/admin/backup", { preHandler: app.autenticar }, async (req, reply) => {
    if (req.user.perfil !== "professor") {
      return reply.status(403).send({ message: "Apenas professores podem baixar o backup." });
    }

    const arquivo = path.resolve(process.cwd(), env.DATABASE_URL.replace(/^file:/, ""));
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const buffer = criptografarBackup(arquivo);

    const nome = `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db.enc`;
    db.prepare("INSERT INTO AuditLog (id, usuarioId, acao, detalhe) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      req.user.sub,
      "backup-baixado",
      JSON.stringify({ arquivo: nome, tamanhoBytes: buffer.length }),
    );

    return reply
      .header("Content-Type", "application/octet-stream")
      .header("Content-Disposition", `attachment; filename="${nome}"`)
      .send(buffer);
  });
};
