import { randomUUID } from "node:crypto";
import { executar, type Executor } from "../db";
import { env } from "../env";

interface EmailRedefinicao {
  para: string;
  nome: string;
  link: string;
  db?: Executor;
  usuarioId?: string | null;
}

export class EmailNaoConfiguradoError extends Error {
  constructor() {
    super("Serviço de e-mail não configurado");
    this.name = "EmailNaoConfiguradoError";
  }
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function htmlDoEmail(nome: string, link: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F3F4EF;font-family:'IBM Plex Sans',Arial,sans-serif;color:#1E241F;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D8DBD2;border-radius:14px;padding:28px;">
    <h1 style="margin:0 0 16px;font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:500;">Prontuário Digital</h1>
    <p style="margin:0 0 12px;font-size:15px;">Olá, ${escapar(nome)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#5B655D;">
      Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${escapar(link)}" style="display:inline-block;background:#1F6F64;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">Redefinir minha senha</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#A6543C;">Este link expira em 30 minutos.</p>
    <p style="margin:0;font-size:13px;color:#8B948A;">Se não foi você, ignore este e-mail.</p>
  </div>
</body>
</html>`;
}

export async function enviarEmailRedefinicao({ para, nome, link, db, usuarioId }: EmailRedefinicao): Promise<void> {
  if (!env.BREVO_API_KEY || !env.MAIL_FROM_EMAIL) {
    if (db) {
      await executar(
        db,
        `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), usuarioId ?? null, null, "email-nao-enviado", JSON.stringify({ motivo: "brevo-nao-configurado" })],
      );
    }
    throw new EmailNaoConfiguradoError();
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM_EMAIL },
        to: [{ email: para, name: nome }],
        subject: "Redefinição de senha - Prontuário Digital UEPB",
        htmlContent: htmlDoEmail(nome, link),
      }),
    });
    if (!res.ok) {
      console.error(`[mail] Brevo respondeu ${res.status}: ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    console.error("[mail] falha ao enviar e-mail de redefinição:", err);
  }
}

export async function enviarEmailConfirmacao({ para, nome, link }: { para: string; nome: string; link: string }): Promise<void> {
  if (!env.BREVO_API_KEY || !env.MAIL_FROM_EMAIL) throw new EmailNaoConfiguradoError();

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F3F4EF;font-family:Arial,sans-serif;color:#1E241F;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D8DBD2;border-radius:14px;padding:28px;">
    <h1 style="margin:0 0 16px;font-size:22px;">Prontuário Digital</h1>
    <p>Olá, ${escapar(nome)}.</p>
    <p>Para concluir seu cadastro, confirme seu endereço de e-mail clicando no botão abaixo.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${escapar(link)}" style="display:inline-block;background:#1F6F64;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">Confirmar meu e-mail</a>
    </p>
    <p style="font-size:13px;color:#A6543C;">Este link expira em 24 horas.</p>
    <p style="font-size:13px;color:#8B948A;">Se você não solicitou este cadastro, ignore esta mensagem.</p>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM_EMAIL },
      to: [{ email: para, name: nome }],
      subject: "Confirme seu e-mail - Prontuário Digital UEPB",
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    console.error(`[mail] Brevo respondeu ${res.status}: ${detalhe}`);
    throw new Error("Não foi possível enviar o e-mail de confirmação.");
  }
}
