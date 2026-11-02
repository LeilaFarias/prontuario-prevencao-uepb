import type { FastifyPluginAsync } from "fastify";
import type { AcessoPendente, AcessoVigente, AcessosResponse } from "@prontuario/shared";
import { tempoDeEspera } from "../lib/acesso";

interface PendenteRow {
  id: string;
  pacienteNome: string;
  acessoSolicitadoEm: string;
  alunoNome: string;
}

interface VigenteRow {
  id: string;
  pacienteNome: string;
  acessoExpiraEm: string;
  alunoNome: string;
}

export const acessosRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const listarPendentes = db.prepare(
    `SELECT p.id, p.pacienteNome, p.acessoSolicitadoEm, u.nome AS alunoNome
     FROM Prontuario p
     JOIN Usuario u ON u.id = p.alunoTitularId
     WHERE p.professorSupervisorId = ?
       AND p.acessoSolicitadoEm IS NOT NULL
       AND p.acessoExpiraEm IS NULL
       AND p.acessoRevogadoEm IS NULL
     ORDER BY p.acessoSolicitadoEm DESC`,
  );
  const listarVigentes = db.prepare(
    `SELECT p.id, p.pacienteNome, p.acessoExpiraEm, u.nome AS alunoNome
     FROM Prontuario p
     JOIN Usuario u ON u.id = p.alunoTitularId
     WHERE p.professorSupervisorId = ?
       AND p.acessoExpiraEm IS NOT NULL
       AND p.acessoExpiraEm > ?
       AND p.acessoRevogadoEm IS NULL
     ORDER BY p.acessoExpiraEm ASC`,
  );

  app.get("/acessos", { preHandler: app.autenticar }, async (req, reply): Promise<AcessosResponse | void> => {
    if (req.user.perfil.toLowerCase() !== "professor") {
      return reply.status(403).send({ error: "Apenas professores podem consultar acessos." });
    }

    const agora = Date.now();
    const pendentes = (listarPendentes.all(req.user.sub) as unknown as PendenteRow[]).map(
      (r): AcessoPendente => ({
        prontuarioId: r.id,
        pacienteNome: r.pacienteNome,
        alunoNome: r.alunoNome,
        solicitadoEm: r.acessoSolicitadoEm,
        tempoEspera: tempoDeEspera(r.acessoSolicitadoEm, agora),
      }),
    );
    const vigentes = (listarVigentes.all(req.user.sub, new Date(agora).toISOString()) as unknown as VigenteRow[]).map(
      (r): AcessoVigente => ({
        prontuarioId: r.id,
        pacienteNome: r.pacienteNome,
        alunoNome: r.alunoNome,
        acessoExpiraEm: r.acessoExpiraEm,
        segundosRestantes: Math.max(0, Math.floor((new Date(r.acessoExpiraEm).getTime() - agora) / 1000)),
      }),
    );
    return { pendentes, vigentes };
  });
};
