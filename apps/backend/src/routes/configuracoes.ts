import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { semestreSchema, type IndicadorPacientes, type SemestreResponse } from "@prontuario/shared";
import { executar, todas, transacao, uma } from "../db";

const CHAVE_INICIO = "semestre_inicio";
const CHAVE_FIM = "semestre_fim";

export const configuracoesRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarSemestre = `SELECT "chave", "valor" FROM "Configuracao" WHERE "chave" = ANY($1::text[])`;
  const gravarValor = `INSERT INTO "Configuracao" ("chave", "valor", "atualizadoEm") VALUES ($1, $2, $3)
     ON CONFLICT ("chave") DO UPDATE SET "valor" = EXCLUDED."valor", "atualizadoEm" = EXCLUDED."atualizadoEm"`;
  const registrarAuditoria = `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, NULL, $3, $4)`;
  const contarPacientes = `SELECT COUNT(DISTINCT "pacienteNome" || '|' || COALESCE("pacienteDataNascimento"::text, '')) AS total
     FROM "Prontuario"
     WHERE "status" IN ('ENVIADO', 'ASSINADO', 'DEVOLVIDO', 'TRANSFERIDO')
       AND ("criadoEm" AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date`;
  const contarPacientesDoProfessor = `${contarPacientes}
       AND "professorSupervisorId" = $3`;

  const somenteProfessor = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ message: "Apenas professores podem acessar esta informação." });
    }
  };
  const protegida = { preHandler: [app.autenticar, somenteProfessor] };

  const lerSemestre = async (): Promise<SemestreResponse> => {
    const linhas = await todas<{ chave: string; valor: string }>(db, buscarSemestre, [[CHAVE_INICIO, CHAVE_FIM]]);
    const valorDe = (chave: string) => linhas.find((l) => l.chave === chave)?.valor ?? null;
    return { inicio: valorDe(CHAVE_INICIO), fim: valorDe(CHAVE_FIM) };
  };

  app.get("/configuracoes/semestre", protegida, async (): Promise<SemestreResponse> => lerSemestre());

  app.put("/configuracoes/semestre", protegida, async (req) => {
    const { inicio, fim } = semestreSchema.parse(req.body);
    const agora = new Date().toISOString();

    await transacao(db, async (tx) => {
      await executar(tx, gravarValor, [CHAVE_INICIO, inicio, agora]);
      await executar(tx, gravarValor, [CHAVE_FIM, fim, agora]);
      await executar(tx, registrarAuditoria, [
        randomUUID(),
        req.user.sub,
        "configurar-semestre",
        JSON.stringify({ inicio, fim }),
      ]);
    });

    req.log.info({ professorId: req.user.sub, inicio, fim }, "semestre configurado");
    return { ok: true as const };
  });

  app.get<{ Querystring: { filtro?: string } }>("/indicador-pacientes", protegida, async (req): Promise<IndicadorPacientes> => {
    const { inicio, fim } = await lerSemestre();
    if (!inicio || !fim) return { total: 0, periodo: null };

    const linha =
      req.query.filtro === "todos"
        ? await uma<{ total: number }>(db, contarPacientes, [inicio, fim])
        : await uma<{ total: number }>(db, contarPacientesDoProfessor, [inicio, fim, req.user.sub]);
    return { total: linha?.total ?? 0, periodo: { inicio, fim } };
  });
};
