import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { semestreSchema, type IndicadorPacientes, type SemestreResponse } from "@prontuario/shared";
import { transacao } from "../db";

const CHAVE_INICIO = "semestre_inicio";
const CHAVE_FIM = "semestre_fim";

export const configuracoesRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarValor = db.prepare("SELECT valor FROM Configuracao WHERE chave = ?");
  const gravarValor = db.prepare(
    `INSERT INTO Configuracao (chave, valor, atualizadoEm) VALUES (?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizadoEm = excluded.atualizadoEm`,
  );
  const registrarAuditoria = db.prepare(
    "INSERT INTO AuditLog (id, usuarioId, prontuarioId, acao, detalhe) VALUES (?, ?, NULL, ?, ?)",
  );
  const contarPacientes = db.prepare(
    `SELECT COUNT(DISTINCT pacienteNome || '|' || COALESCE(pacienteDataNascimento, '')) AS total
     FROM Prontuario
     WHERE status IN ('ENVIADO', 'ASSINADO', 'DEVOLVIDO', 'TRANSFERIDO')
       AND substr(criadoEm, 1, 10) BETWEEN ? AND ?`,
  );
  const contarPacientesDoProfessor = db.prepare(
    `SELECT COUNT(DISTINCT pacienteNome || '|' || COALESCE(pacienteDataNascimento, '')) AS total
     FROM Prontuario
     WHERE status IN ('ENVIADO', 'ASSINADO', 'DEVOLVIDO', 'TRANSFERIDO')
       AND substr(criadoEm, 1, 10) BETWEEN ? AND ?
       AND professorSupervisorId = ?`,
  );

  const somenteProfessor = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ message: "Apenas professores podem acessar esta informação." });
    }
  };
  const protegida = { preHandler: [app.autenticar, somenteProfessor] };

  const lerSemestre = (): SemestreResponse => {
    const inicio = buscarValor.get(CHAVE_INICIO) as unknown as { valor: string } | undefined;
    const fim = buscarValor.get(CHAVE_FIM) as unknown as { valor: string } | undefined;
    return { inicio: inicio?.valor ?? null, fim: fim?.valor ?? null };
  };

  app.get("/configuracoes/semestre", protegida, async (): Promise<SemestreResponse> => lerSemestre());

  app.put("/configuracoes/semestre", protegida, async (req) => {
    const { inicio, fim } = semestreSchema.parse(req.body);
    const agora = new Date().toISOString();

    transacao(db, () => {
      gravarValor.run(CHAVE_INICIO, inicio, agora);
      gravarValor.run(CHAVE_FIM, fim, agora);
      registrarAuditoria.run(randomUUID(), req.user.sub, "configurar-semestre", JSON.stringify({ inicio, fim }));
    });

    req.log.info({ professorId: req.user.sub, inicio, fim }, "semestre configurado");
    return { ok: true as const };
  });

  app.get<{ Querystring: { filtro?: string } }>("/indicador-pacientes", protegida, async (req): Promise<IndicadorPacientes> => {
    const { inicio, fim } = lerSemestre();
    if (!inicio || !fim) return { total: 0, periodo: null };

    const { total } = (
      req.query.filtro === "todos"
        ? contarPacientes.get(inicio, fim)
        : contarPacientesDoProfessor.get(inicio, fim, req.user.sub)
    ) as unknown as { total: number };
    return { total, periodo: { inicio, fim } };
  });
};