import fp from "fastify-plugin";
import { criarPool, migrar, type Db } from "../db";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export default fp(async (app) => {
  const db = criarPool();
  await migrar(db);
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await db.end();
  });
});
