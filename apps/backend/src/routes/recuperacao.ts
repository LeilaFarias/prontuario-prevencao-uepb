import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  MENSAGEM_FORGOT_PASSWORD,
  forgotPasswordSchema,
  resetPasswordBodySchema,
} from "@prontuario/shared";
import { transacao } from "../db";
import { env } from "../env";
import { enviarEmailRedefinicao } from "../lib/mail";
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

  // Limpeza periódica do Map para não crescer indefinidamente
  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [email, ts] of pedidos) {
      if (ts.every((t) => agora - t >= JANELA_MS)) pedidos.delete(email);
    }
  }, JANELA_MS);
  limpeza.unref();
  app.addHook("onClose", async () => clearInterval(limpeza));

  const buscarToken = (token: string): TokenRow | undefined =>
    db
      .prepare("SELECT id, userId, expiraEm, usadoEm FROM PasswordResetToken WHERE tokenHash = ?")
      .get(hashToken(token)) as unknown as TokenRow | undefined;

  const tokenValido = (t: TokenRow | undefined): t is TokenRow =>
    !!t && t.usadoEm === null && t.expiraEm >= new Date().toISOString();

  app.post("/auth/forgot-password", async (req) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const resposta = { ok: true, message: MENSAGEM_FORGOT_PASSWORD };

    const usuario = db.prepare("SELECT id, nome, email FROM Usuario WHERE email = ? AND ativo = 1").get(email) as unknown as
      | { id: string; nome: string; email: string }
      | undefined;
    if (!usuario) return resposta;

    // Acima do limite: mesma resposta, mas nenhum e-mail é enviado
    if (excedeuLimite(email)) return resposta;

    const token = gerarToken();
    const agora = new Date().toISOString();
    transacao(db, () => {
      db.prepare("UPDATE PasswordResetToken SET usadoEm = ? WHERE userId = ? AND usadoEm IS NULL").run(
        agora,
        usuario.id,
      );
      db.prepare(
        "INSERT INTO PasswordResetToken (id, userId, tokenHash, expiraEm, criadoEm) VALUES (?, ?, ?, ?, ?)",
      ).run(randomUUID(), usuario.id, hashToken(token), new Date(Date.now() + EXPIRA_EM_MS).toISOString(), agora);
    });

    const link = `${env.APP_URL}/redefinir-senha?token=${token}`;
    await enviarEmailRedefinicao({ para: usuario.email, nome: usuario.nome, link });
    return resposta;
  });

  app.get("/auth/verify-reset-token", async (req) => {
    const { token } = req.query as { token?: string };
    if (!token) return { valido: false };
    return { valido: tokenValido(buscarToken(token)) };
  });

  app.post("/auth/reset-password", async (req, reply) => {
    const { token, novaSenha } = resetPasswordBodySchema.parse(req.body);

    const registro = buscarToken(token);
    if (!tokenValido(registro)) return reply.status(400).send(LINK_INVALIDO);

    const novoHash = await hashSenha(novaSenha);
    const agora = new Date().toISOString();

    const aplicado = transacao(db, () => {
      // Reconfirma dentro da transação: impede uso duplo do mesmo token
      const marcado = db
        .prepare("UPDATE PasswordResetToken SET usadoEm = ? WHERE id = ? AND usadoEm IS NULL")
        .run(agora, registro.id);
      if (Number(marcado.changes) === 0) return false;
      db.prepare("UPDATE Usuario SET senhaHash = ? WHERE id = ?").run(novoHash, registro.userId);
      db.prepare("UPDATE PasswordResetToken SET usadoEm = ? WHERE userId = ? AND usadoEm IS NULL").run(
        agora,
        registro.userId,
      );
      return true;
    });

    if (!aplicado) return reply.status(400).send(LINK_INVALIDO);
    return { ok: true };
  });
};
