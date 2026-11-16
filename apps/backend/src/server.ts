import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { env } from "./env";
import dbPlugin from "./plugins/db";
import authPlugin from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { recuperacaoRoutes } from "./routes/recuperacao";
import { syncRoutes } from "./routes/sync";
import { prontuariosRoutes } from "./routes/prontuarios";
import { acessosRoutes } from "./routes/acessos";
import { configuracoesRoutes } from "./routes/configuracoes";
import { userRoutes } from "./routes/users";
import { professoresRoutes } from "./routes/professores";
import { notificacoesRoutes } from "./routes/notificacoes";
import { backupRoutes } from "./routes/backup";

const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");

const API_PREFIXES = [
  "/auth",
  "/prontuarios",
  "/sync",
  "/admin",
  "/users",
  "/alunos",
  "/professores",
  "/fila-revisao",
  "/encaminhamentos",
  "/acessos",
  "/notificacoes",
  "/health",
  "/configuracoes",
  "/indicador-pacientes",
];

const isApiPath = (url: string) =>
  API_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`));

const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

if (env.CORS_ORIGIN !== "") {
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
  });
}
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
});
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
  allowList: (req) => !isApiPath(req.url),
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    message: `Muitas requisições. Tente novamente em ${context.after}.`,
  }),
});
await app.register(dbPlugin);
await app.register(authPlugin);

app.addHook("preHandler", async (req, reply) => {
  if (req.method !== "GET") return;
  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html")) return;
  if (req.headers.authorization) return;
  return reply.type("text/html").sendFile("index.html");
});

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) {
    return reply.status(400).send({ message: err.issues[0]?.message ?? "Dados inválidos" });
  }
  if (err.statusCode === 429) {
    return reply.status(429).send({ message: err.message });
  }
  app.log.error(err);
  return reply.status(err.statusCode ?? 500).send({ message: "Erro interno do servidor." });
});

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(recuperacaoRoutes);
await app.register(syncRoutes);
await app.register(prontuariosRoutes);
await app.register(acessosRoutes);
await app.register(configuracoesRoutes);
await app.register(userRoutes);
await app.register(professoresRoutes);
await app.register(notificacoesRoutes);
await app.register(backupRoutes);

await app.register(fastifyStatic, { root: FRONTEND_DIST, prefix: "/" });

app.setNotFoundHandler((_req, reply) => {
  return reply.status(404).send({ message: "Rota não encontrada", codigo: "NAO_ENCONTRADO" });
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });