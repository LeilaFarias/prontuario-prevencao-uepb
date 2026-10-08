import fp from "fastify-plugin";
import type { DatabaseSync } from "node:sqlite";
import { abrirBanco } from "../db";

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseSync;
  }
}

export default fp(async (app) => {
  const db = abrirBanco();
  app.decorate("db", db);
  app.addHook("onClose", async () => db.close());
});
