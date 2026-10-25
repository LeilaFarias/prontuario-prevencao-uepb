import type { FastifyPluginAsync } from "fastify";

interface ProntuarioListaRow {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
  alunoTitularId: string;
  professorSupervisorId: string | null;
  alunoNome: string;
}

interface SecaoRow {
  secaoId: string;
  conteudo: string;
}

const ATUALIZADO_EM_EFETIVO = `
  MAX(
    p.atualizadoEm,
    COALESCE((SELECT MAX(s.atualizadoEm) FROM Secao s WHERE s.prontuarioId = p.id), p.atualizadoEm)
  )`;

const COLUNAS = `
  p.id,
  p.pacienteNome,
  substr(p.pacienteDataNascimento, 1, 10) AS pacienteDataNascimento,
  p.status,
  p.criadoEm,
  ${ATUALIZADO_EM_EFETIVO} AS atualizadoEm,
  p.alunoTitularId,
  p.professorSupervisorId,
  u.nome AS alunoNome`;

export const prontuariosRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const listarTodos = db.prepare(
    `SELECT ${COLUNAS}
     FROM Prontuario p
     JOIN Usuario u ON u.id = p.alunoTitularId
     ORDER BY atualizadoEm DESC`,
  );
  const listarDoAluno = db.prepare(
    `SELECT ${COLUNAS}
     FROM Prontuario p
     JOIN Usuario u ON u.id = p.alunoTitularId
     WHERE p.alunoTitularId = ?
     ORDER BY atualizadoEm DESC`,
  );
  const buscarUm = db.prepare(
    `SELECT ${COLUNAS}
     FROM Prontuario p
     JOIN Usuario u ON u.id = p.alunoTitularId
     WHERE p.id = ?`,
  );
  const buscarSecoes = db.prepare("SELECT secaoId, conteudo FROM Secao WHERE prontuarioId = ?");

  const ehAluno = (perfil: string): boolean => perfil.toLowerCase() === "aluno";

  app.get("/prontuarios", protegida, async (req) => {
    const userId = req.user.sub;
    const linhas = ehAluno(req.user.perfil) ? listarDoAluno.all(userId) : listarTodos.all();
    return linhas as unknown as ProntuarioListaRow[];
  });

  app.get<{ Params: { id: string } }>("/prontuarios/:id", protegida, async (req, reply) => {
    const linha = buscarUm.get(req.params.id) as unknown as ProntuarioListaRow | undefined;
    if (!linha) return reply.status(404).send({ message: "Prontuário não encontrado." });

    if (ehAluno(req.user.perfil) && linha.alunoTitularId !== req.user.sub) {
      return reply.status(403).send({ message: "Você não tem acesso a este prontuário." });
    }

    const secoes: Record<string, unknown> = {};
    for (const s of buscarSecoes.all(linha.id) as unknown as SecaoRow[]) {
      try {
        secoes[s.secaoId] = JSON.parse(s.conteudo);
      } catch {
        req.log.warn({ prontuarioId: linha.id, secaoId: s.secaoId }, "seção com JSON inválido ignorada");
      }
    }

    return { ...linha, secoes };
  });
};
