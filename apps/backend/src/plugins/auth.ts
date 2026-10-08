import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { env } from "../env";

// Nenhuma rota é protegida na Sprint 1; o plugin só disponibiliza app.jwt.sign.
export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET });
});
