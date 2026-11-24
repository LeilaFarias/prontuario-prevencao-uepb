import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  MENSAGEM_FORGOT_PASSWORD,
  forgotPasswordSchema,
  resetPasswordBodySchema,
} from "@prontuario/shared";
import { executar, transacao, uma } from "../db";
import { env } from "../env";
import { enviarEmailRedefinicao } from "../lib/mail";
import { invalidarSessaoCache } from "../lib/sessaoCache";
import { hashSenha } from "../lib/senha";

const EXPIRA_EM_MS = 30 * 60 * 1000;
const LIMITE_PEDIDOS = 3;
const JANELA_MS = 60 * 60 * 1000;
const LINK_INVALIDO = { error: "Link inválido ou expirado" };

const gerarToken = () => randomBytes(32).toString("hex");
const hashToken = (token: string) => createHmac("sha256", env.RESET_TOKEN_SECRET).update(token).digest("hex");

const pedidos = new Map<string, number[]>();

function excedeuLimite(email: string): boolean {
  const agora = Date.now();
  const recentes = (pedidos.get(email) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= LIMITE_PEDIDOS) {
    pedidos.set(email, recentes);
    return true;
  }
  recentes.push(agora);
  pedidos.set(email, recentes);
  return false;
}

interface TokenRow {
  id: string;
  userId: string;
  expiraEm: string;
  usadoEm: string | null;
}

export const recuperacaoRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [email, ts] of pedidos) {
      if (ts.every((t) => agora - t >= JANELA_MS)) pedidos.delete(email);
    }
  }, JANELA_MS);
  limpeza.unref();
  app.addHook("onClose", async () => clearInterval(limpeza));

  const buscarToken = (token: string): Promise<TokenRow | undefined> =>
    uma<TokenRow>(
      db,
      `SELECT "id", "userId", "expiraEm", "usadoEm" FROM "PasswordResetToken" WHERE "tokenHash" = $1`,
      [hashToken(token)],
    );

  const tokenValido = (t: TokenRow | undefined): t is TokenRow =>
    !!t && t.usadoEm === null && t.expiraEm >= new Date().toISOString();

  app.post("/auth/forgot-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const resposta = { ok: true, message: MENSAGEM_FORGOT_PASSWORD };

    const usuario = await uma<{ id: string; nome: string; email: string }>(
      db,
      `SELECT "id", "nome", "email" FROM "Usuario" WHERE "email" = $1 AND "ativo"`,
      [email],
    );
    if (!usuario) return resposta;

    if (excedeuLimite(email)) return resposta;

    const token = gerarToken();
    const agora = new Date().toISOString();
    await transacao(db, async (tx) => {
      await executar(tx, `UPDATE "PasswordResetToken" SET "usadoEm" = $1 WHERE "userId" = $2 AND "usadoEm" IS NULL`, [
        agora,
        usuario.id,
      ]);
      await executar(
        tx,
        `INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiraEm", "criadoEm") VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), usuario.id, hashToken(token), new Date(Date.now() + EXPIRA_EM_MS).toISOString(), agora],
      );
    });

    const link = `${env.APP_URL}/redefinir-senha?token=${token}`;
    await enviarEmailRedefinicao({ para: usuario.email, nome: usuario.nome, link });
    return resposta;
  });

  app.get("/auth/verify-reset-token", async (req) => {
    const { token } = req.query as { token?: string };
    if (!token) return { valido: false };
    return { valido: tokenValido(await buscarToken(token)) };
  });

  app.post("/auth/reset-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const { token, novaSenha } = resetPasswordBodySchema.parse(req.body);

    const registro = await buscarToken(token);
    if (!tokenValido(registro)) return reply.status(400).send(LINK_INVALIDO);

    const novoHash = await hashSenha(novaSenha);
    const agora = new Date().toISOString();

    const aplicado = await transacao(db, async (tx) => {
      // Reconfirma dentro da transação: impede uso duplo do mesmo token
      const marcados = await executar(
        tx,
        `UPDATE "PasswordResetToken" SET "usadoEm" = $1 WHERE "id" = $2 AND "usadoEm" IS NULL`,
        [agora, registro.id],
      );
      if (marcados === 0) return false;
      await executar(tx, `UPDATE "Usuario" SET "senhaHash" = $1, "tokenVersion" = "tokenVersion" + 1 WHERE "id" = $2`, [
        novoHash,
        registro.userId,
      ]);
      await executar(tx, `UPDATE "PasswordResetToken" SET "usadoEm" = $1 WHERE "userId" = $2 AND "usadoEm" IS NULL`, [
        agora,
        registro.userId,
      ]);
      return true;
    });

    if (!aplicado) return reply.status(400).send(LINK_INVALIDO);
    invalidarSessaoCache(registro.userId);
    return { ok: true };
  });
};
