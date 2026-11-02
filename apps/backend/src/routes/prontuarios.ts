import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  assinarSchema,
  devolverSchema,
  type AssinarResponse,
  type CodigoErroRevisao,
  type DevolverResponse,
} from "@prontuario/shared";
import { transacao } from "../db";
import { enviarProntuario } from "../lib/envio";
import { reabrirProntuario } from "../lib/reabertura";
import { verificarSenha } from "../lib/senha";

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

interface ProfessorRow {
  id: string;
  nome: string;
  matricula: string | null;
  senhaHash: string;
}

interface ProntuarioRevisaoRow {
  status: string;
  professorSupervisorId: string | null;
}

interface RevisaoDetalheRow {
  assinadoEm: string | null;
  assinadoPorNome: string | null;
  devolvidoEm: string | null;
  devolvidoPorNome: string | null;
  motivoDevolucao: string | null;
  comentarioDevolucao: string | null;
}

function contarProcedimentos(conteudo: string | undefined): number {
  if (!conteudo) return 0;
  try {
    const dados = JSON.parse(conteudo) as { itens?: unknown };
    return Array.isArray(dados.itens) ? dados.itens.length : 0;
  } catch {
    return 0;
  }
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
  const buscarSecaoProcedimentos = db.prepare(
    "SELECT conteudo FROM Secao WHERE prontuarioId = ? AND secaoId = 'procedimentos'",
  );
  const buscarRevisao = db.prepare(
    `SELECT assinadoEm, assinadoPorNome, devolvidoEm, devolvidoPorNome, motivoDevolucao, comentarioDevolucao
     FROM Prontuario WHERE id = ?`,
  );
  const buscarProfessor = db.prepare(
    "SELECT id, nome, matricula, senhaHash FROM Usuario WHERE id = ? AND UPPER(perfil) = 'PROFESSOR' AND ativo = 1",
  );
  const buscarParaAcao = db.prepare("SELECT status, professorSupervisorId FROM Prontuario WHERE id = ?");
  const gravarAssinatura = db.prepare(
    `UPDATE Prontuario
     SET status = 'ASSINADO', assinadoEm = ?, assinadoPorId = ?, assinadoPorNome = ?, assinaturaInvalidada = 0, atualizadoEm = ?
     WHERE id = ?`,
  );
  const gravarDevolucao = db.prepare(
    `UPDATE Prontuario
     SET status = 'DEVOLVIDO',
         devolvidoEm = ?, devolvidoPorId = ?, devolvidoPorNome = ?, motivoDevolucao = ?, comentarioDevolucao = ?,
         assinaturaInvalidada = CASE WHEN assinadoEm IS NULL THEN assinaturaInvalidada ELSE 1 END,
         assinadoEm = NULL, assinadoPorId = NULL, assinadoPorNome = NULL,
         atualizadoEm = ?
     WHERE id = ?`,
  );
  const buscarEnvio = db.prepare(
    `SELECT MAX(ts) AS ts FROM SyncOperationLog
     WHERE prontuarioId = ? AND entity = 'prontuario' AND op = 'enviar' AND descartada = 0`,
  );

  const registrarLog = db.prepare(
    `INSERT INTO SyncOperationLog (id, prontuarioId, entity, entityId, op, ts, descartada)
     VALUES (?, ?, 'prontuario', ?, ?, ?, 0)`,
  );

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

    const ehSupervisor = !ehAluno(req.user.perfil) && linha.professorSupervisorId === req.user.sub;
    const podeAgir = ehSupervisor && linha.status.toUpperCase() === "ENVIADO";

    const envio = buscarEnvio.get(linha.id) as unknown as { ts: number | null } | undefined;
    const enviadoEm = envio?.ts ? new Date(envio.ts).toISOString() : null;

    const revisao = buscarRevisao.get(linha.id) as unknown as RevisaoDetalheRow;

    return { ...linha, ...revisao, secoes, podeAgir, ehSupervisor, enviadoEm };
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/enviar", protegida, async (req, reply) => {
    if (!ehAluno(req.user.perfil)) {
      return reply.status(403).send({ message: "Apenas o aluno titular pode enviar o prontuário." });
    }

    const { id } = req.params;
    const resultado = transacao(db, () => {
      const r = enviarProntuario(db, id, req.user.sub);
      if (r.ok) registrarLog.run(randomUUID(), id, id, "enviar", Date.now());
      return r;
    });

    if (!resultado.ok) {
      if (resultado.erro === "nao_encontrado") {
        return reply.status(404).send({ message: "Prontuário não encontrado." });
      }
      if (resultado.erro === "ja_enviado") {
        return reply.status(409).send({ message: "Prontuário já foi enviado" });
      }
      return { ok: false, erro: resultado.erro };
    }

    req.log.info({ prontuarioId: id, duplicado: resultado.duplicado }, "prontuário enviado ao professor");
    return resultado;
  });
  app.post<{ Params: { id: string } }>("/prontuarios/:id/reabrir", protegida, async (req, reply) => {
    if (!ehAluno(req.user.perfil)) {
      return reply.status(403).send({ message: "Apenas o aluno titular pode reabrir o prontuário." });
    }

    const { id } = req.params;
    const resultado = transacao(db, () => {
      const r = reabrirProntuario(db, id, req.user.sub);
      if (r === "ok") registrarLog.run(randomUUID(), id, id, "reabrir", Date.now());
      return r;
    });

    if (resultado === "nao_encontrado") return reply.status(404).send({ message: "Prontuário não encontrado." });
    if (resultado === "nao_devolvido") {
      return reply.status(409).send({ message: "Prontuário não está devolvido", codigo: "NAO_DEVOLVIDO" });
    }

    req.log.info({ prontuarioId: id }, "prontuário reaberto pelo aluno");
    return { ok: true };
  });

  const recusar = (reply: FastifyReply, status: number, message: string, codigo: CodigoErroRevisao) =>
    reply.status(status).send({ message, codigo });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/assinar", protegida, async (req, reply) => {
    const { matricula, senha } = assinarSchema.parse(req.body);

    const professor = buscarProfessor.get(req.user.sub) as unknown as ProfessorRow | undefined;
    if (!professor) return reply.status(403).send({ message: "Apenas professores podem assinar prontuários." });

    if (!professor.matricula || professor.matricula !== matricula) {
      return recusar(reply, 401, "Matrícula não confere", "MATRICULA_NAO_CONFERE");
    }
    if (!(await verificarSenha(senha, professor.senhaHash))) {
      return recusar(reply, 401, "Senha incorreta", "SENHA_INCORRETA");
    }

    const { id } = req.params;
    const resultado = transacao(db, () => {
      const pront = buscarParaAcao.get(id) as unknown as ProntuarioRevisaoRow | undefined;
      if (!pront) return { erro: 404 as const };
      if (pront.status.toUpperCase() !== "ENVIADO") return { erro: 409 as const };
      if (pront.professorSupervisorId !== professor.id) return { erro: 403 as const };

      const agora = new Date().toISOString();
      gravarAssinatura.run(agora, professor.id, professor.nome, agora, id);
      registrarLog.run(randomUUID(), id, id, "assinar", Date.now());

      const secao = buscarSecaoProcedimentos.get(id) as unknown as { conteudo: string } | undefined;
      return { agora, procedimentos: contarProcedimentos(secao?.conteudo) };
    });

    if ("erro" in resultado) {
      if (resultado.erro === 404) return reply.status(404).send({ message: "Prontuário não encontrado." });
      if (resultado.erro === 409) {
        return recusar(reply, 409, "Prontuário não está aguardando assinatura", "NAO_AGUARDANDO");
      }
      return recusar(reply, 403, "Apenas o professor supervisor pode assinar", "NAO_SUPERVISOR");
    }

    req.log.info({ prontuarioId: id, professorId: professor.id }, "prontuário assinado");
    const resposta: AssinarResponse = {
      ok: true,
      assinadoEm: resultado.agora,
      assinadoPorNome: professor.nome,
      procedimentosAssinados: resultado.procedimentos,
    };
    return resposta;
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/devolver", protegida, async (req, reply) => {
    const { motivo, comentario } = devolverSchema.parse(req.body);

    const professor = buscarProfessor.get(req.user.sub) as unknown as ProfessorRow | undefined;
    if (!professor) return reply.status(403).send({ message: "Apenas professores podem devolver prontuários." });

    const { id } = req.params;
    const resultado = transacao(db, () => {
      const pront = buscarParaAcao.get(id) as unknown as ProntuarioRevisaoRow | undefined;
      if (!pront) return { erro: 404 as const };
      if (pront.status.toUpperCase() !== "ENVIADO") return { erro: 409 as const };
      if (pront.professorSupervisorId !== professor.id) return { erro: 403 as const };

      const agora = new Date().toISOString();
      gravarDevolucao.run(agora, professor.id, professor.nome, motivo, comentario, agora, id);
      registrarLog.run(randomUUID(), id, id, "devolver", Date.now());
      return { agora };
    });

    if ("erro" in resultado) {
      if (resultado.erro === 404) return reply.status(404).send({ message: "Prontuário não encontrado." });
      if (resultado.erro === 409) {
        return recusar(reply, 409, "Prontuário não está aguardando revisão", "NAO_AGUARDANDO");
      }
      return recusar(reply, 403, "Apenas o professor supervisor pode devolver", "NAO_SUPERVISOR");
    }

    req.log.info({ prontuarioId: id, professorId: professor.id, motivo }, "prontuário devolvido ao aluno");
    const resposta: DevolverResponse = {
      ok: true,
      devolvidoEm: resultado.agora,
      devolvidoPorNome: professor.nome,
    };
    return resposta;
  });
};
