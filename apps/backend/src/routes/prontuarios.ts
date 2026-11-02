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
import { ACESSO_DURACAO_MS, estadoAcesso, pedidoPendente, type AcessoRow } from "../lib/acesso";
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
  acessoExpiraEm: string | null;
  acessoRevogadoEm: string | null;
  acessoSolicitadoEm: string | null;
  acessoRecusadoEm: string | null;
}

interface ProntuarioAcessoRow extends AcessoRow {
  status: string;
  alunoTitularId: string;
  professorSupervisorId: string | null;
}

interface RevisaoDetalheRow extends AcessoRow {
  assinadoEm: string | null;
  assinadoPorNome: string | null;
  devolvidoEm: string | null;
  devolvidoPorNome: string | null;
  motivoDevolucao: string | null;
  comentarioDevolucao: string | null;
}

interface SolicitarAcessoBody {
  professorSupervisorId?: string;
  professorSupervisorNome?: string;
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
    `SELECT assinadoEm, assinadoPorNome, devolvidoEm, devolvidoPorNome, motivoDevolucao, comentarioDevolucao,
       acessoSolicitadoEm, acessoExpiraEm, acessoRevogadoEm, acessoRecusadoEm
      FROM Prontuario WHERE id = ?`,
  );
  const buscarNomeProfessor = db.prepare("SELECT nome FROM Usuario WHERE id = ?");
  const buscarAcesso = db.prepare(
    `SELECT status, alunoTitularId, professorSupervisorId,
       acessoSolicitadoEm, acessoExpiraEm, acessoRevogadoEm, acessoRecusadoEm
      FROM Prontuario WHERE id = ?`,
  );
  const gravarSolicitacao = db.prepare(
    `UPDATE Prontuario
      SET acessoSolicitadoEm = ?,
          acessoExpiraEm = NULL,
          acessoRevogadoEm = NULL,
          acessoRecusadoEm = NULL,
          professorSupervisorId = COALESCE(?, professorSupervisorId),
          atualizadoEm = ?
      WHERE id = ?`,
  );
  const gravarAprovacao = db.prepare(
    `UPDATE Prontuario
      SET acessoExpiraEm = ?, acessoRevogadoEm = NULL, acessoSolicitadoEm = NULL,
          acessoRecusadoEm = NULL, atualizadoEm = ?
      WHERE id = ?`,
  );
  const gravarRevogacao = db.prepare(
    `UPDATE Prontuario
      SET acessoRevogadoEm = ?, acessoExpiraEm = NULL, acessoRecusadoEm = NULL, atualizadoEm = ?
      WHERE id = ?`,
  );
  const gravarRecusa = db.prepare(
    `UPDATE Prontuario
      SET acessoSolicitadoEm = NULL,
          acessoRecusadoEm = ?,
          acessoRevogadoEm = ?,
          atualizadoEm = ?
      WHERE id = ?`,
  );
  const buscarProfessor = db.prepare(
    "SELECT id, nome, matricula, senhaHash FROM Usuario WHERE id = ? AND UPPER(perfil) = 'PROFESSOR' AND ativo = 1",
  );
  const buscarParaAcao = db.prepare(
    `SELECT status, professorSupervisorId,
            acessoExpiraEm, acessoRevogadoEm, acessoSolicitadoEm, acessoRecusadoEm
     FROM Prontuario WHERE id = ?`,
  );
  const gravarAssinatura = db.prepare(
    `UPDATE Prontuario
     SET status = 'ASSINADO', assinadoEm = ?, assinadoPorId = ?, assinadoPorNome = ?, assinaturaInvalidada = 0,
         acessoSolicitadoEm = NULL, acessoExpiraEm = NULL, acessoRevogadoEm = NULL, acessoRecusadoEm = NULL,
         atualizadoEm = ?
     WHERE id = ?`,
  );
  const gravarDevolucao = db.prepare(
    `UPDATE Prontuario
     SET status = 'DEVOLVIDO',
         devolvidoEm = ?, devolvidoPorId = ?, devolvidoPorNome = ?, motivoDevolucao = ?, comentarioDevolucao = ?,
         assinaturaInvalidada = CASE WHEN assinadoEm IS NULL THEN assinaturaInvalidada ELSE 1 END,
         assinadoEm = NULL, assinadoPorId = NULL, assinadoPorNome = NULL,
         acessoExpiraEm = ?, acessoRevogadoEm = NULL, acessoSolicitadoEm = NULL, acessoRecusadoEm = NULL,
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

    const alunoUser = ehAluno(req.user.perfil);
    if (alunoUser && linha.alunoTitularId !== req.user.sub) {
      return reply.status(403).send({ message: "Você não tem acesso a este prontuário." });
    }

    const revisao = buscarRevisao.get(linha.id) as unknown as RevisaoDetalheRow;
    const estado = estadoAcesso(revisao);
    const professor = linha.professorSupervisorId
      ? (buscarNomeProfessor.get(linha.professorSupervisorId) as unknown as { nome: string } | undefined)
      : undefined;
    const professorSupervisorNome = professor?.nome ?? null;

    const podeVerConteudo = !alunoUser || estado.acessoVigente;

    if (!podeVerConteudo) {
      return {
        id: linha.id,
        pacienteNome: linha.pacienteNome,
        status: linha.status,
        bloqueado: true,
        acessoExpiraEm: revisao.acessoExpiraEm,
        acessoSolicitadoEm: revisao.acessoSolicitadoEm,
        acessoRevogadoEm: revisao.acessoRevogadoEm,
        acessoRecusadoEm: revisao.acessoRecusadoEm,
        professorSupervisorId: linha.professorSupervisorId,
        professorSupervisorNome,
        secoes: {},
      };
    }

    const secoes: Record<string, unknown> = {};
    for (const s of buscarSecoes.all(linha.id) as unknown as SecaoRow[]) {
      try {
        secoes[s.secaoId] = JSON.parse(s.conteudo);
      } catch {
        req.log.warn({ prontuarioId: linha.id, secaoId: s.secaoId }, "seção com JSON inválido ignorada");
      }
    }

    const ehSupervisor = !alunoUser && linha.professorSupervisorId === req.user.sub;
    const podeAgir = ehSupervisor && linha.status.toUpperCase() === "ENVIADO";

    const envio = buscarEnvio.get(linha.id) as unknown as { ts: number | null } | undefined;
    const enviadoEm = envio?.ts ? new Date(envio.ts).toISOString() : null;

    return {
      ...linha,
      ...revisao,
      ...estado,
      bloqueado: false,
      professorSupervisorNome,
      secoes,
      podeAgir,
      ehSupervisor,
      enviadoEm,
    };
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

  type FalhaAcesso = { falha: 400 | 403 | 404 | 409; error: string };

  const responderFalha = (reply: FastifyReply, f: FalhaAcesso) => reply.status(f.falha).send({ error: f.error });

  const NAO_ENCONTRADO: FalhaAcesso = { falha: 404, error: "Prontuário não encontrado." };
  const NAO_SUPERVISOR: FalhaAcesso = { falha: 403, error: "Apenas o professor supervisor pode realizar esta ação." };
  const SEM_PEDIDO: FalhaAcesso = { falha: 409, error: "Sem pedido pendente" };
  const SEM_ACESSO_VIGENTE: FalhaAcesso = { falha: 409, error: "Sem acesso vigente para revogar" };
  const STATUS_NAO_PERMITE_SOLICITAR: FalhaAcesso = {
    falha: 409,
    error: "Status não permite solicitação de acesso",
  };
  const PROFESSOR_INVALIDO: FalhaAcesso = { falha: 400, error: "Professor inválido ou inativo." };

  const statusPermiteSolicitar = (status: string): boolean => {
    const s = status.toUpperCase();
    return s === "EM_ANDAMENTO" || s === "ASSINADO";
  };

  app.post<{ Params: { id: string }; Body: SolicitarAcessoBody }>(
    "/prontuarios/:id/solicitar-acesso",
    protegida,
    async (req, reply) => {
      const { id } = req.params;
      const body = (req.body ?? {}) as SolicitarAcessoBody;

      const resultado = transacao(db, () => {
        const pront = buscarAcesso.get(id) as unknown as ProntuarioAcessoRow | undefined;
        if (!pront || pront.alunoTitularId !== req.user.sub) return NAO_ENCONTRADO;

        if (!statusPermiteSolicitar(pront.status)) return STATUS_NAO_PERMITE_SOLICITAR;

        const estado = estadoAcesso(pront);
        if (estado.acessoVigente) return { ok: true as const, jaTemAcesso: true };
        if (estado.pedidoPendente) return { ok: true as const, jaSolicitado: true };

        const professorDoBody = body.professorSupervisorId ?? null;

        if (professorDoBody) {
          const prof = buscarProfessor.get(professorDoBody) as unknown as
            | { id: string; nome: string }
            | undefined;
          if (!prof) return PROFESSOR_INVALIDO;
        }

        const professorEfetivo = professorDoBody ?? pront.professorSupervisorId;
        if (!professorEfetivo) return { ok: false as const, erro: "professor_obrigatorio" as const };

        const agora = new Date().toISOString();
        gravarSolicitacao.run(agora, professorDoBody, agora, id);
        registrarLog.run(randomUUID(), id, id, "solicitar-acesso", Date.now());
        return { ok: true as const };
      });

      if ("falha" in resultado) return responderFalha(reply, resultado);
      if ("ok" in resultado && resultado.ok === false) {
        return reply.status(400).send(resultado);
      }
      return resultado;
    },
  );

  app.post<{ Params: { id: string } }>("/prontuarios/:id/aprovar-acesso", protegida, async (req, reply) => {
    const { id } = req.params;
    const resultado = transacao(db, () => {
      const pront = buscarAcesso.get(id) as unknown as ProntuarioAcessoRow | undefined;
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;
      if (!pedidoPendente(pront)) return SEM_PEDIDO;

      const agora = Date.now();
      const acessoExpiraEm = new Date(agora + ACESSO_DURACAO_MS).toISOString();
      gravarAprovacao.run(acessoExpiraEm, new Date(agora).toISOString(), id);
      registrarLog.run(randomUUID(), id, id, "aprovar-acesso", agora);
      return { ok: true as const, acessoExpiraEm };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "acesso temporário aprovado");
    return resultado;
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/revogar-acesso", protegida, async (req, reply) => {
    const { id } = req.params;
    const resultado = transacao(db, () => {
      const pront = buscarAcesso.get(id) as unknown as ProntuarioAcessoRow | undefined;
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;

      const estado = estadoAcesso(pront);
      if (!estado.acessoVigente) return SEM_ACESSO_VIGENTE;

      const agora = new Date().toISOString();
      gravarRevogacao.run(agora, agora, id);
      registrarLog.run(randomUUID(), id, id, "revogar-acesso", Date.now());
      return { ok: true as const };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "acesso temporário revogado");
    return resultado;
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/recusar-acesso", protegida, async (req, reply) => {
    const { id } = req.params;
    const resultado = transacao(db, () => {
      const pront = buscarAcesso.get(id) as unknown as ProntuarioAcessoRow | undefined;
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;
      if (!pedidoPendente(pront)) return SEM_PEDIDO;

      const agora = new Date().toISOString();
      gravarRecusa.run(agora, agora, agora, id);
      registrarLog.run(randomUUID(), id, id, "recusar-acesso", Date.now());
      return { ok: true as const };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "pedido de acesso recusado");
    return resultado;
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

      const agoraMs = Date.now();
      const agora = new Date(agoraMs).toISOString();

      const temAcessoVigente =
        !!pront.acessoExpiraEm &&
        new Date(pront.acessoExpiraEm).getTime() > agoraMs &&
        !pront.acessoRevogadoEm;

      const novoAcessoExpiraEm = temAcessoVigente
        ? (pront.acessoExpiraEm as string)
        : new Date(agoraMs + ACESSO_DURACAO_MS).toISOString();

      gravarDevolucao.run(
        agora,
        professor.id,
        professor.nome,
        motivo,
        comentario,
        novoAcessoExpiraEm,
        agora,
        id,
      );
      registrarLog.run(randomUUID(), id, id, "devolver", agoraMs);
      return { agora, novoAcessoExpiraEm };
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