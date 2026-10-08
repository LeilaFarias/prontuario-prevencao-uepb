import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env";
import dbPlugin from "./plugins/db";
import authPlugin from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
});
await app.register(dbPlugin);
await app.register(authPlugin);

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) {
    return reply.status(400).send({ message: err.issues[0]?.message ?? "Dados inválidos" });
  }
  app.log.error(err);
  return reply.status(err.statusCode ?? 500).send({ message: "Erro interno do servidor." });
});

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(syncRoutes);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
