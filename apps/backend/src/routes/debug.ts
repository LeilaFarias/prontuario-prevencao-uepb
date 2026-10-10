import type { FastifyPluginAsync } from "fastify";

const route: FastifyPluginAsync = async (app) => {
  app.get("/debug/db", async () => {
    const usuarios = app.db.prepare(
      "SELECT id, nome, email, perfil, matricula, ativo, criadoEm FROM Usuario ORDER BY criadoEm DESC"
    ).all();

    const prontuarios = app.db.prepare(
      `SELECT p.id, p.pacienteNome, p.status, p.criadoEm, p.atualizadoEm,
              u.nome AS alunoNome
       FROM Prontuario p
       JOIN Usuario u ON u.id = p.alunoTitularId
       ORDER BY p.criadoEm DESC`
    ).all();

    const secoes = app.db.prepare(
      `SELECT prontuarioId, secaoId, length(conteudo) AS tamanhoBytes, atualizadoEm
       FROM Secao ORDER BY atualizadoEm DESC`
    ).all();

    const log = app.db.prepare(
      `SELECT id, entity, op, entityId, descartada, aplicadaEm
       FROM SyncOperationLog ORDER BY aplicadaEm DESC LIMIT 50`
    ).all();

    const totais = {
      usuarios: (app.db.prepare("SELECT COUNT(*) AS n FROM Usuario").get() as { n: number }).n,
      prontuarios: (app.db.prepare("SELECT COUNT(*) AS n FROM Prontuario").get() as { n: number }).n,
      secoes: (app.db.prepare("SELECT COUNT(*) AS n FROM Secao").get() as { n: number }).n,
      operacoesSync: (app.db.prepare("SELECT COUNT(*) AS n FROM SyncOperationLog").get() as { n: number }).n,
    };

    return { totais, usuarios, prontuarios, secoes, log };
  });

  app.get<{ Params: { id: string } }>("/debug/prontuario/:id", async (req, reply) => {
    const { id } = req.params;

    const prontuario = app.db.prepare(
      `SELECT p.*, u.nome AS alunoNome
       FROM Prontuario p
       JOIN Usuario u ON u.id = p.alunoTitularId
       WHERE p.id = ?`
    ).get(id) as any;

    if (!prontuario) return reply.code(404).send({ error: "Não encontrado" });

    const secoesRaw = app.db.prepare(
      "SELECT secaoId, conteudo, atualizadoEm FROM Secao WHERE prontuarioId = ?"
    ).all(id) as { secaoId: string; conteudo: string; atualizadoEm: string }[];

    const secoes = secoesRaw.map((s) => ({
      secaoId: s.secaoId,
      atualizadoEm: s.atualizadoEm,
      conteudo: (() => {
        try { return JSON.parse(s.conteudo); } catch { return s.conteudo; }
      })(),
    }));

    return { prontuario, secoes };
  });
};

export default route;