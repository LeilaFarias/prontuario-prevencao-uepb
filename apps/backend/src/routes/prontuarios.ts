import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  assinarSchema,
  comentarioProfessorSchema,
  devolverSchema,
  manterTitularidadeSchema,
  TIPOS_DESFECHO,
  transferirTitularidadeSchema,
  type DuplicidadeResponse,
  type Encaminhamento,
  type FilaRevisaoResponse,
  type ItemFilaRevisao,
  type HistoricoProntuario,
  type PartesDuplicidade,
  type AssinarResponse,
  type CodigoErroRevisao,
  type DevolverResponse,
  type ComentarioProfessorResponse,
} from "@prontuario/shared";
import { executar, todas, transacao, uma, type Executor } from "../db";
import {
  ACESSO_DURACAO_MS,
  estadoAcesso,
  pedidoPendente,
  type AcessoRow,
} from "../lib/acesso";
import { registrarAuditoria as auditar } from "../lib/auditoria";
import { buscarDuplicado, enviarProntuario } from "../lib/envio";
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
  professorSupervisorNome: string | null;
  sinalizadoDuplicidade: number;
  duplicidadeEmAnalise: number;
  transferidoDe: string | null;
  transferidoPara: string | null;
}

interface FilaRow {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
  sinalizadoDuplicidade: boolean;
  professorSupervisorId: string | null;
  alunoTitularId: string;
  atualizadoEm: string;
  alunoNome: string;
  professorSupervisorNome: string | null;
  tipoDesfecho: string | null;
  desfechoEnvio: string | null;
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
  desfechoEnvio: string | null;
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
  desfechoEnvio: string | null;
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
  GREATEST(
    p."atualizadoEm",
    COALESCE((SELECT MAX(s."atualizadoEm") FROM "Secao" s WHERE s."prontuarioId" = p."id"), p."atualizadoEm")
  )`;

const COLUNAS = `
  p."id",
  p."pacienteNome",
  to_char(p."pacienteDataNascimento" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "pacienteDataNascimento",
  p."status",
  p."criadoEm",
  ${ATUALIZADO_EM_EFETIVO} AS "atualizadoEm",
  p."alunoTitularId",
  p."professorSupervisorId",
  p."sinalizadoDuplicidade"::int AS "sinalizadoDuplicidade",
  CASE
    WHEN NOT p."sinalizadoDuplicidade"
      AND p."status" NOT IN ('EM_ANDAMENTO', 'TRANSFERIDO')
      AND EXISTS (
        SELECT 1 FROM "Prontuario" o
        WHERE o."id" != p."id"
          AND o."pacienteNome" = p."pacienteNome"
          AND o."pacienteDataNascimento" = p."pacienteDataNascimento"
          AND o."alunoTitularId" != p."alunoTitularId"
          AND o."status" = 'ENVIADO'
          AND o."sinalizadoDuplicidade"
      ) THEN 1 ELSE 0
  END AS "duplicidadeEmAnalise",
  p."transferidoDe",
  p."transferidoPara",
  u."nome" AS "alunoNome",
  pr."nome" AS "professorSupervisorNome"`;

export const prontuariosRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const listarTodos = `SELECT ${COLUNAS}
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Usuario" pr ON pr."id" = p."professorSupervisorId"
     WHERE p."descartadoEm" IS NULL
     ORDER BY "atualizadoEm" DESC`;
  const listarDoAluno = `SELECT ${COLUNAS}
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Usuario" pr ON pr."id" = p."professorSupervisorId"
     WHERE p."alunoTitularId" = $1 AND p."descartadoEm" IS NULL
     ORDER BY "atualizadoEm" DESC`;
  const listarEncaminhamentosDoProfessor = `SELECT p."id", p."pacienteNome", u."nome" AS "alunoNome", s."conteudo",
            c."conteudo" AS "consentimento"
     FROM "Prontuario" p
     JOIN "Secao" s ON s."prontuarioId" = p."id" AND s."secaoId" = 'conclusao'
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Secao" c ON c."prontuarioId" = p."id" AND c."secaoId" = 'consentimento'
     WHERE p."professorSupervisorId" = $1 AND p."status" = 'ASSINADO' AND p."descartadoEm" IS NULL
       AND s."conteudo"->>'tipoDesfecho' = 'encaminhado'
     ORDER BY p."atualizadoEm" DESC`;
  const selecionarFila = `SELECT p."id", p."pacienteNome", p."pacienteDataNascimento", p."sinalizadoDuplicidade", p."professorSupervisorId",
            p."alunoTitularId", ${ATUALIZADO_EM_EFETIVO} AS "atualizadoEm", u."nome" AS "alunoNome",
            pr."nome" AS "professorSupervisorNome", p."desfechoEnvio",
            (SELECT s."conteudo"->>'tipoDesfecho' FROM "Secao" s
              WHERE s."prontuarioId" = p."id" AND s."secaoId" = 'conclusao') AS "tipoDesfecho"
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Usuario" pr ON pr."id" = p."professorSupervisorId"`;
  const listarEnviados = `${selecionarFila}
     WHERE p."status" = 'ENVIADO' AND p."descartadoEm" IS NULL
     ORDER BY "atualizadoEm" DESC`;
  const listarEnviadosDoProfessor = `${selecionarFila}
     WHERE p."status" = 'ENVIADO' AND p."professorSupervisorId" = $1 AND p."descartadoEm" IS NULL
     ORDER BY "atualizadoEm" DESC`;
  const contarEnviados = `SELECT COUNT(*)::int AS "todos",
            COUNT(*) FILTER (WHERE "professorSupervisorId" = $1)::int AS "meus"
     FROM "Prontuario" WHERE "status" = 'ENVIADO' AND "descartadoEm" IS NULL`;
  const buscarConsentimentosEmLote = `SELECT "prontuarioId", "conteudo" FROM "Secao"
     WHERE "prontuarioId" = ANY($1::text[]) AND "secaoId" = 'consentimento'`;
  const listarDoProfessorPorStatus = `${selecionarFila}
     WHERE p."status" = $1 AND p."professorSupervisorId" = $2 AND p."descartadoEm" IS NULL
     ORDER BY "atualizadoEm" DESC`;
  const buscarSecoes = `SELECT "secaoId", "conteudo" FROM "Secao" WHERE "prontuarioId" = $1`;
  const buscarSecaoProcedimentos = `SELECT "conteudo" FROM "Secao" WHERE "prontuarioId" = $1 AND "secaoId" = 'procedimentos'`;
  const buscarDetalhe = `SELECT ${COLUNAS},
            p."desfechoEnvio", p."assinadoEm", p."assinadoPorNome", p."devolvidoEm", p."devolvidoPorNome",
            p."motivoDevolucao", p."comentarioDevolucao",
            p."acessoSolicitadoEm", p."acessoExpiraEm", p."acessoRevogadoEm", p."acessoRecusadoEm"
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Usuario" pr ON pr."id" = p."professorSupervisorId"
     WHERE p."id" = $1 AND p."descartadoEm" IS NULL`;
  const buscarPartes = `SELECT p."id" AS "prontuarioId", p."pacienteNome", p."pacienteDataNascimento", p."status", p."criadoEm",
            p."sinalizadoDuplicidade", p."alunoTitularId" AS "alunoId", u."nome" AS "alunoNome",
            p."professorSupervisorId" AS "professorId", pr."nome" AS "professorNome"
     FROM "Prontuario" p
     JOIN "Usuario" u ON u."id" = p."alunoTitularId"
     LEFT JOIN "Usuario" pr ON pr."id" = p."professorSupervisorId"
     WHERE p."id" = $1`;
  const buscarConsentimento = `SELECT "conteudo" FROM "Secao" WHERE "prontuarioId" = $1 AND "secaoId" = 'consentimento'`;
  const inserirNotificacao = `INSERT INTO "Notificacao" ("id", "usuarioId", "prontuarioId", "tipo", "mensagem") VALUES ($1, $2, $3, $4, $5)`;
  const gravarManutencao = `UPDATE "Prontuario" SET "professorSupervisorId" = $1, "sinalizadoDuplicidade" = FALSE, "atualizadoEm" = $2 WHERE "id" = $3`;
  const atualizarCarimbo = `UPDATE "Prontuario" SET "atualizadoEm" = $1 WHERE "id" = $2`;
  const gravarTransferenciaArquivado = `UPDATE "Prontuario"
     SET "status" = 'TRANSFERIDO', "transferidoPara" = $1, "sinalizadoDuplicidade" = FALSE, "atualizadoEm" = $2
     WHERE "id" = $3`;
  const gravarTransferenciaAtivo = `UPDATE "Prontuario"
     SET "status" = 'EM_ANDAMENTO', "transferidoDe" = $1, "professorSupervisorId" = $2,
         "assinaturaInvalidada" = CASE WHEN "assinadoEm" IS NULL THEN "assinaturaInvalidada" ELSE TRUE END,
         "assinadoEm" = NULL, "assinadoPorId" = NULL, "assinadoPorNome" = NULL,
         "sinalizadoDuplicidade" = FALSE, "atualizadoEm" = $3
     WHERE "id" = $4`;
  const registrarAuditoria = `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`;
  const buscarNomeProfessor = `SELECT "nome" FROM "Usuario" WHERE "id" = $1`;
  const buscarAcesso = `SELECT "status", "alunoTitularId", "professorSupervisorId",
       "acessoSolicitadoEm", "acessoExpiraEm", "acessoRevogadoEm", "acessoRecusadoEm"
      FROM "Prontuario" WHERE "id" = $1 FOR UPDATE`;
  const gravarSolicitacao = `UPDATE "Prontuario"
      SET "acessoSolicitadoEm" = $1,
          "acessoExpiraEm" = NULL,
          "acessoRevogadoEm" = NULL,
          "acessoRecusadoEm" = NULL,
          "professorSupervisorId" = COALESCE($2::text, "professorSupervisorId"),
          "atualizadoEm" = $3
      WHERE "id" = $4`;
  const gravarAprovacao = `UPDATE "Prontuario"
      SET "acessoExpiraEm" = $1, "acessoRevogadoEm" = NULL, "acessoSolicitadoEm" = NULL,
          "acessoRecusadoEm" = NULL, "atualizadoEm" = $2
      WHERE "id" = $3`;
  const gravarRevogacao = `UPDATE "Prontuario"
      SET "acessoRevogadoEm" = $1, "acessoExpiraEm" = NULL, "acessoRecusadoEm" = NULL, "atualizadoEm" = $2
      WHERE "id" = $3`;
  const gravarRecusa = `UPDATE "Prontuario"
      SET "acessoSolicitadoEm" = NULL,
          "acessoRecusadoEm" = $1,
          "acessoRevogadoEm" = $2,
          "atualizadoEm" = $3
      WHERE "id" = $4`;
  const buscarProfessor = `SELECT "id", "nome", "matricula", "senhaHash" FROM "Usuario" WHERE "id" = $1 AND UPPER("perfil") = 'PROFESSOR' AND "ativo"`;
  const buscarParaAcao = `SELECT "status", "desfechoEnvio", "professorSupervisorId",
            "acessoExpiraEm", "acessoRevogadoEm", "acessoSolicitadoEm", "acessoRecusadoEm"
     FROM "Prontuario" WHERE "id" = $1 FOR UPDATE`;
  const gravarAssinatura = `UPDATE "Prontuario"
     SET "status" = 'ASSINADO', "assinadoEm" = $1, "assinadoPorId" = $2, "assinadoPorNome" = $3, "assinaturaInvalidada" = FALSE,
         "acessoSolicitadoEm" = NULL, "acessoExpiraEm" = NULL, "acessoRevogadoEm" = NULL, "acessoRecusadoEm" = NULL,
         "atualizadoEm" = $4
     WHERE "id" = $5`;
  const gravarDevolucao = `UPDATE "Prontuario"
     SET "status" = 'DEVOLVIDO',
         "devolvidoEm" = $1, "devolvidoPorId" = $2, "devolvidoPorNome" = $3, "motivoDevolucao" = $4, "comentarioDevolucao" = $5,
         "assinaturaInvalidada" = CASE WHEN "assinadoEm" IS NULL THEN "assinaturaInvalidada" ELSE TRUE END,
         "assinadoEm" = NULL, "assinadoPorId" = NULL, "assinadoPorNome" = NULL,
         "acessoExpiraEm" = $6, "acessoRevogadoEm" = NULL, "acessoSolicitadoEm" = NULL, "acessoRecusadoEm" = NULL,
         "atualizadoEm" = $7
     WHERE "id" = $8`;
  const buscarEnvio = `SELECT MAX("ts") AS "ts" FROM "SyncOperationLog"
     WHERE "prontuarioId" = $1 AND "entity" = 'prontuario' AND "op" = 'enviar' AND NOT "descartada"`;

  const registrarLog = `INSERT INTO "SyncOperationLog" ("id", "prontuarioId", "entity", "entityId", "op", "ts", "descartada")
     VALUES ($1, $2, 'prontuario', $3, $4, $5, FALSE)`;

  const ehAluno = (perfil: string): boolean => perfil.toLowerCase() === "aluno";

  const duplaDoConsentimento = (conteudo: string | null | undefined): { alunoOperador: string; alunoAuxiliar: string } => {
    try {
      const c = JSON.parse(conteudo ?? "{}") as { alunoOperador?: unknown; alunoAuxiliar?: unknown };
      return {
        alunoOperador: typeof c.alunoOperador === "string" ? c.alunoOperador.trim() : "",
        alunoAuxiliar: typeof c.alunoAuxiliar === "string" ? c.alunoAuxiliar.trim() : "",
      };
    } catch {
      return { alunoOperador: "", alunoAuxiliar: "" };
    }
  };

  const lerDupla = async (
    ex: Executor,
    prontuarioId: string,
  ): Promise<{ alunoOperador: string; alunoAuxiliar: string }> => {
    const secao = await uma<{ conteudo: string }>(ex, buscarConsentimento, [prontuarioId]);
    return duplaDoConsentimento(secao?.conteudo);
  };

  const lerDuplasEmLote = async (
    ex: Executor,
    prontuarioIds: string[],
  ): Promise<Map<string, { alunoOperador: string; alunoAuxiliar: string }>> => {
    const duplas = new Map<string, { alunoOperador: string; alunoAuxiliar: string }>();
    if (prontuarioIds.length === 0) return duplas;
    const linhas = await todas<{ prontuarioId: string; conteudo: string }>(ex, buscarConsentimentosEmLote, [prontuarioIds]);
    for (const l of linhas) duplas.set(l.prontuarioId, duplaDoConsentimento(l.conteudo));
    return duplas;
  };

  const textoDupla = (p: PartesDuplicidade): string =>
    [p.alunoOperador, p.alunoAuxiliar].filter(Boolean).join(" e ") || p.alunoNome;

  const nomeDuplaDe = async (ex: Executor, prontuarioId: string, alunoNome: string): Promise<string> => {
    const { alunoOperador, alunoAuxiliar } = await lerDupla(ex, prontuarioId);
    return [alunoOperador, alunoAuxiliar].filter(Boolean).join(" e ") || alunoNome;
  };

  const nomeDuplaDestino = async (ex: Executor, prontuarioId: string | null): Promise<string | null> => {
    if (!prontuarioId) return null;
    const partes = await uma<{ alunoNome: string }>(ex, buscarPartes, [prontuarioId]);
    return partes ? nomeDuplaDe(ex, prontuarioId, partes.alunoNome) : null;
  };

  const lerSecoes = async (
    prontuarioId: string,
    log: { warn: (obj: object, msg: string) => void },
  ): Promise<Record<string, unknown>> => {
    const secoes: Record<string, unknown> = {};
    for (const s of await todas<SecaoRow>(db, buscarSecoes, [prontuarioId])) {
      try {
        secoes[s.secaoId] = JSON.parse(s.conteudo);
      } catch {
        log.warn({ prontuarioId, secaoId: s.secaoId }, "seção com JSON inválido ignorada");
      }
    }
    return secoes;
  };

  const montarHistorico = async (
    origemId: string,
    log: { warn: (obj: object, msg: string) => void },
  ): Promise<HistoricoProntuario | null> => {
    const origem = await uma<{ prontuarioId: string; alunoNome: string; professorNome: string | null; criadoEm: string }>(
      db,
      buscarPartes,
      [origemId],
    );
    if (!origem) return null;
    return {
      prontuarioId: origem.prontuarioId,
      alunoNome: await nomeDuplaDe(db, origem.prontuarioId, origem.alunoNome),
      professorNome: origem.professorNome,
      criadoEm: origem.criadoEm,
      secoes: await lerSecoes(origem.prontuarioId, log),
    };
  };

  const comDestino = async <T extends { transferidoPara: string | null }>(
    linha: T,
  ): Promise<T & { transferidoParaNome: string | null }> => ({
    ...linha,
    transferidoParaNome: await nomeDuplaDestino(db, linha.transferidoPara),
  });

  app.get("/prontuarios", protegida, async (req) => {
    const userId = req.user.sub;
    const linhas = ehAluno(req.user.perfil)
      ? await todas<ProntuarioListaRow>(db, listarDoAluno, [userId])
      : await todas<ProntuarioListaRow>(db, listarTodos);
    return Promise.all(linhas.map(comDestino));
  });

  app.get<{ Querystring: { filtro?: string } }>("/fila-revisao", protegida, async (req, reply) => {
    if (ehAluno(req.user.perfil)) {
      return reply.status(403).send({ message: "Apenas professores podem consultar a fila de revisão." });
    }

    const { filtro } = req.query;
    const statusAlvo = filtro === "assinados" ? "ASSINADO" : filtro === "devolvidos" ? "DEVOLVIDO" : null;

    const [contagem, visiveis] = await Promise.all([
      uma<{ todos: number; meus: number }>(db, contarEnviados, [req.user.sub]),
      statusAlvo
        ? todas<FilaRow>(db, listarDoProfessorPorStatus, [statusAlvo, req.user.sub])
        : filtro === "todos"
          ? todas<FilaRow>(db, listarEnviados)
          : todas<FilaRow>(db, listarEnviadosDoProfessor, [req.user.sub]),
    ]);
    const duplas = await lerDuplasEmLote(
      db,
      visiveis.map((r) => r.id),
    );

    const prontuarios: ItemFilaRevisao[] = await Promise.all(
      visiveis.map(async (r): Promise<ItemFilaRevisao> => {
        const sinalizado = !statusAlvo && r.sinalizadoDuplicidade;
        const duplicado = sinalizado ? await buscarDuplicado(db, r, r.alunoTitularId) : undefined;
        return {
          id: r.id,
          pacienteNome: r.pacienteNome,
          pacienteDataNascimento: r.pacienteDataNascimento?.slice(0, 10) ?? null,
          atualizadoEm: r.atualizadoEm,
          sinalizadoDuplicidade: sinalizado,
          professorSupervisorId: r.professorSupervisorId,
          professorSupervisorNome: r.professorSupervisorNome,
          alunoNome: r.alunoNome,
          ...(duplas.get(r.id) ?? { alunoOperador: "", alunoAuxiliar: "" }),
          duplaAnteriorNome: duplicado ? await nomeDuplaDestino(db, duplicado.id) : null,
          tipoDesfecho: TIPOS_DESFECHO.find((t) => t === r.tipoDesfecho) ?? null,
        };
      }),
    );

    const resposta: FilaRevisaoResponse = {
      contadores: { meus: contagem?.meus ?? 0, todos: contagem?.todos ?? 0 },
      prontuarios,
    };
    return resposta;
  });

  app.get("/encaminhamentos", protegida, async (req, reply) => {
    if (ehAluno(req.user.perfil)) {
      return reply.status(403).send({ message: "Apenas professores podem consultar encaminhamentos." });
    }

    const linhas = await todas<{
      id: string;
      pacienteNome: string;
      alunoNome: string;
      conteudo: string;
      consentimento: string | null;
    }>(db, listarEncaminhamentosDoProfessor, [req.user.sub]);

    const encaminhamentos: Encaminhamento[] = [];
    for (const linha of linhas) {
      try {
        const c = JSON.parse(linha.conteudo) as {
          tipoDesfecho?: unknown;
          encaminhamentoEm?: unknown;
          encaminhamentoPara?: unknown;
        };
        if (c.tipoDesfecho !== "encaminhado") continue;
        const dupla = duplaDoConsentimento(linha.consentimento);
        encaminhamentos.push({
          prontuarioId: linha.id,
          pacienteNome: linha.pacienteNome,
          duplaNome: [dupla.alunoOperador, dupla.alunoAuxiliar].filter(Boolean).join(" e ") || linha.alunoNome,
          encaminhamentoEm: typeof c.encaminhamentoEm === "string" ? c.encaminhamentoEm : "",
          encaminhamentoPara: typeof c.encaminhamentoPara === "string" ? c.encaminhamentoPara.trim() : "",
        });
      } catch {
        req.log.warn({ prontuarioId: linha.id }, "seção de conclusão com JSON inválido ignorada");
      }
    }
    return encaminhamentos;
  });

  app.get<{ Params: { id: string } }>("/prontuarios/:id", protegida, async (req, reply) => {
    const detalhe = await uma<ProntuarioListaRow & RevisaoDetalheRow>(db, buscarDetalhe, [req.params.id]);
    if (!detalhe) return reply.status(404).send({ message: "Prontuário não encontrado." });

    const alunoUser = ehAluno(req.user.perfil);
    if (alunoUser && detalhe.alunoTitularId !== req.user.sub) {
      return reply.status(403).send({ message: "Você não tem acesso a este prontuário." });
    }

    const linha = detalhe;
    const revisao = detalhe;
    const estado = estadoAcesso(revisao);
    const professorSupervisorNome = detalhe.professorSupervisorNome ?? null;

    const podeVerConteudo = !alunoUser || estado.acessoVigente;

    const ehSupervisor = !alunoUser && linha.professorSupervisorId === req.user.sub;
    const podeAgir = ehSupervisor && linha.status.toUpperCase() === "ENVIADO";

    const [secoes, historico, envio, transferidoParaNome] = await Promise.all([
      lerSecoes(linha.id, req.log),
      linha.transferidoDe ? montarHistorico(linha.transferidoDe, req.log) : Promise.resolve(null),
      uma<{ ts: number | null }>(db, buscarEnvio, [linha.id]),
      nomeDuplaDestino(db, linha.transferidoPara),
      auditar(
        db,
        req.user.sub,
        podeVerConteudo ? "prontuario-lido" : "prontuario-baixado-sem-acesso",
        { prontuarioId: linha.id, status: linha.status, perfil: req.user.perfil },
        linha.id,
      ),
    ]);
    const enviadoEm = envio?.ts ? new Date(envio.ts).toISOString() : null;

    return {
      ...linha,
      ...revisao,
      ...estado,
      bloqueado: !podeVerConteudo,
      professorSupervisorNome,
      transferidoParaNome,
      secoes,
      historico,
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
    const resultado = await transacao(db, async (tx) => {
      const r = await enviarProntuario(tx, id, req.user.sub);
      if (r.ok) await executar(tx, registrarLog, [randomUUID(), id, id, "enviar", Date.now()]);
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
    const resultado = await transacao(db, async (tx) => {
      const r = await reabrirProntuario(tx, id, req.user.sub);
      if (r === "ok") await executar(tx, registrarLog, [randomUUID(), id, id, "reabrir", Date.now()]);
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
    return s === "EM_ANDAMENTO" || s === "ASSINADO" || s === "TRANSFERIDO";
  };

  app.post<{ Params: { id: string }; Body: SolicitarAcessoBody }>(
    "/prontuarios/:id/solicitar-acesso",
    protegida,
    async (req, reply) => {
      const { id } = req.params;
      const body = (req.body ?? {}) as SolicitarAcessoBody;

      const resultado = await transacao(db, async (tx) => {
        const pront = await uma<ProntuarioAcessoRow>(tx, buscarAcesso, [id]);
        if (!pront || pront.alunoTitularId !== req.user.sub) return NAO_ENCONTRADO;

        if (!statusPermiteSolicitar(pront.status)) return STATUS_NAO_PERMITE_SOLICITAR;

        const estado = estadoAcesso(pront);
        if (estado.acessoVigente) return { ok: true as const, jaTemAcesso: true };
        if (estado.pedidoPendente) return { ok: true as const, jaSolicitado: true };

        const professorDoBody = body.professorSupervisorId ?? null;

        if (professorDoBody) {
          const prof = await uma<{ id: string; nome: string }>(tx, buscarProfessor, [professorDoBody]);
          if (!prof) return PROFESSOR_INVALIDO;
        }

        const professorEfetivo = professorDoBody ?? pront.professorSupervisorId;
        if (!professorEfetivo) return { ok: false as const, erro: "professor_obrigatorio" as const };

        const agora = new Date().toISOString();
        await executar(tx, gravarSolicitacao, [agora, professorDoBody, agora, id]);
        await executar(tx, registrarLog, [randomUUID(), id, id, "solicitar-acesso", Date.now()]);
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
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioAcessoRow>(tx, buscarAcesso, [id]);
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;
      if (!pedidoPendente(pront)) return SEM_PEDIDO;

      const agora = Date.now();
      const acessoExpiraEm = new Date(agora + ACESSO_DURACAO_MS).toISOString();
      await executar(tx, gravarAprovacao, [acessoExpiraEm, new Date(agora).toISOString(), id]);
      await executar(tx, registrarLog, [randomUUID(), id, id, "aprovar-acesso", agora]);
      return { ok: true as const, acessoExpiraEm };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "acesso temporário aprovado");
    return resultado;
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/revogar-acesso", protegida, async (req, reply) => {
    const { id } = req.params;
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioAcessoRow>(tx, buscarAcesso, [id]);
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;

      const estado = estadoAcesso(pront);
      if (!estado.acessoVigente) return SEM_ACESSO_VIGENTE;

      const agora = new Date().toISOString();
      await executar(tx, gravarRevogacao, [agora, agora, id]);
      await executar(tx, registrarLog, [randomUUID(), id, id, "revogar-acesso", Date.now()]);
      return { ok: true as const };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "acesso temporário revogado");
    return resultado;
  });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/recusar-acesso", protegida, async (req, reply) => {
    const { id } = req.params;
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioAcessoRow>(tx, buscarAcesso, [id]);
      if (!pront) return NAO_ENCONTRADO;
      if (pront.professorSupervisorId !== req.user.sub) return NAO_SUPERVISOR;
      if (!pedidoPendente(pront)) return SEM_PEDIDO;

      const agora = new Date().toISOString();
      await executar(tx, gravarRecusa, [agora, agora, agora, id]);
      await executar(tx, registrarLog, [randomUUID(), id, id, "recusar-acesso", Date.now()]);
      return { ok: true as const };
    });

    if ("falha" in resultado) return responderFalha(reply, resultado);
    req.log.info({ prontuarioId: id, professorId: req.user.sub }, "pedido de acesso recusado");
    return resultado;
  });

  type PartesRow = PartesDuplicidade & {
    pacienteNome: string;
    pacienteDataNascimento: string | null;
    sinalizadoDuplicidade: boolean;
  };

  const resumirPartes = async (ex: Executor, r: PartesRow): Promise<PartesDuplicidade> => ({
    prontuarioId: r.prontuarioId,
    alunoId: r.alunoId,
    alunoNome: r.alunoNome,
    ...(await lerDupla(ex, r.prontuarioId)),
    professorId: r.professorId,
    professorNome: r.professorNome,
    criadoEm: r.criadoEm,
    status: r.status,
  });

  const notificar = (ex: Executor, usuarioId: string, prontuarioId: string, tipo: string, mensagem: string): Promise<number> =>
    executar(ex, inserirNotificacao, [randomUUID(), usuarioId, prontuarioId, tipo, mensagem]);

  const SEM_DUPLICIDADE: FalhaAcesso = { falha: 409, error: "Este prontuário não está sinalizado como duplicado." };

  const montarDuplicidade = async (
    ex: Executor,
    id: string,
  ): Promise<{ falha: FalhaAcesso } | { partes: PartesRow; resposta: DuplicidadeResponse }> => {
    const partes = await uma<PartesRow>(ex, buscarPartes, [id]);
    if (!partes) return { falha: NAO_ENCONTRADO };
    const duplicado = await buscarDuplicado(ex, { ...partes, id: partes.prontuarioId }, partes.alunoId);
    const existente = duplicado ? await uma<PartesRow>(ex, buscarPartes, [duplicado.id]) : undefined;
    return {
      partes,
      resposta: {
        atual: await resumirPartes(ex, partes),
        existente: existente ? await resumirPartes(ex, existente) : null,
      },
    };
  };

  app.get<{ Params: { id: string } }>("/prontuarios/:id/duplicidade", protegida, async (req, reply) => {
    const r = await montarDuplicidade(db, req.params.id);
    if ("falha" in r) return responderFalha(reply, r.falha);
    if (r.partes.professorId !== req.user.sub) return responderFalha(reply, NAO_SUPERVISOR);
    return r.resposta;
  });

  app.post<{ Params: { id: string } }>(
    "/prontuarios/:id/manter-titularidade",
    protegida,
    async (req, reply) => {
      const { professorSupervisorId } = manterTitularidadeSchema.parse(req.body);
      const { id } = req.params;

      const resultado = await transacao(db, async (tx) => {
        const r = await montarDuplicidade(tx, id);
        if ("falha" in r) return r.falha;
        if (r.partes.professorId !== req.user.sub) return NAO_SUPERVISOR;
        if (!r.partes.sinalizadoDuplicidade) return SEM_DUPLICIDADE;

        const permitidos = new Set(
          [r.resposta.atual.professorId, r.resposta.existente?.professorId].filter((v): v is string => !!v),
        );
        if (!permitidos.has(professorSupervisorId) || !(await uma(tx, buscarProfessor, [professorSupervisorId]))) {
          return PROFESSOR_INVALIDO;
        }

        const agora = new Date().toISOString();
        await executar(tx, gravarManutencao, [professorSupervisorId, agora, id]);
        if (r.resposta.existente) await executar(tx, atualizarCarimbo, [agora, r.resposta.existente.prontuarioId]);
        await executar(tx, registrarAuditoria, [
          randomUUID(),
          req.user.sub,
          id,
          "manutencao-titularidade",
          JSON.stringify({
            aluno: r.partes.alunoId,
            professorAnterior: r.partes.professorId,
            professorNovo: professorSupervisorId,
          }),
        ]);
        await executar(tx, registrarLog, [randomUUID(), id, id, "manter-titularidade", Date.now()]);

        const { atual, existente } = r.resposta;
        const responsavel = (await uma<{ nome: string }>(tx, buscarNomeProfessor, [professorSupervisorId]))!.nome;
        await notificar(
          tx,
          atual.alunoId,
          id,
          "duplicidade-mantida",
          `A duplicidade do prontuário de ${r.partes.pacienteNome} foi resolvida: ele permanece com ${textoDupla(atual)}. Professor responsável: ${responsavel}.`,
        );
        if (existente) {
          await notificar(
            tx,
            existente.alunoId,
            existente.prontuarioId,
            "duplicidade-mantida-outra-dupla",
            `O prontuário de ${r.partes.pacienteNome} enviado por ${textoDupla(atual)} foi mantido com a outra dupla. O seu prontuário não foi alterado.`,
          );
        }
        return { ok: true as const };
      });

      if ("falha" in resultado) return responderFalha(reply, resultado);
      req.log.info({ prontuarioId: id, professorId: req.user.sub }, "titularidade mantida");
      return resultado;
    },
  );

  const PACIENTE_DIVERGENTE: FalhaAcesso = { falha: 409, error: "Os prontuários não são do mesmo paciente." };
  const JA_TRANSFERIDO: FalhaAcesso = { falha: 409, error: "Este prontuário já foi transferido." };
  const MESMO_PRONTUARIO: FalhaAcesso = { falha: 400, error: "Os prontuários informados são o mesmo." };

  app.post<{ Params: { id: string } }>(
    "/prontuarios/:id/transferir-titularidade",
    protegida,
    async (req, reply) => {
      const { prontuarioAntigoId, prontuarioNovoId, quemRecebe, professorEscolhidoId } = transferirTitularidadeSchema.parse(
        req.body,
      );
      if (req.params.id !== prontuarioAntigoId) {
        return reply.status(400).send({ error: "O prontuário da URL não é o prontuário anterior informado." });
      }

      const resultado = await transacao(db, async (tx) => {
        const antigo = await uma<PartesRow>(tx, buscarPartes, [prontuarioAntigoId]);
        const novo = await uma<PartesRow>(tx, buscarPartes, [prontuarioNovoId]);
        if (!antigo || !novo) return NAO_ENCONTRADO;

        if (antigo.professorId !== req.user.sub && novo.professorId !== req.user.sub) return NAO_SUPERVISOR;
        if (antigo.prontuarioId === novo.prontuarioId) return MESMO_PRONTUARIO;
        if (
          antigo.pacienteNome !== novo.pacienteNome ||
          antigo.pacienteDataNascimento !== novo.pacienteDataNascimento
        ) {
          return PACIENTE_DIVERGENTE;
        }
        if (antigo.status.toUpperCase() === "TRANSFERIDO" || novo.status.toUpperCase() === "TRANSFERIDO") {
          return JA_TRANSFERIDO;
        }

        const professorResponsavelId = professorEscolhidoId ?? req.user.sub;
        const professorResponsavel = await uma<{ nome: string }>(tx, buscarProfessor, [professorResponsavelId]);
        if (!professorResponsavel) return PROFESSOR_INVALIDO;

        const recebe = quemRecebe === "anterior" ? antigo : novo;
        const arquiva = quemRecebe === "anterior" ? novo : antigo;
        const duplaRecebe = await resumirPartes(tx, recebe);
        const duplaArquiva = await resumirPartes(tx, arquiva);
        const agora = new Date().toISOString();

        await executar(tx, gravarTransferenciaArquivado, [recebe.prontuarioId, agora, arquiva.prontuarioId]);
        await executar(tx, gravarTransferenciaAtivo, [arquiva.prontuarioId, professorResponsavelId, agora, recebe.prontuarioId]);

        await executar(tx, registrarAuditoria, [
          randomUUID(),
          req.user.sub,
          recebe.prontuarioId,
          "transferencia-titularidade",
          JSON.stringify({
            idRecebe: recebe.prontuarioId,
            idArquiva: arquiva.prontuarioId,
            quemRecebe,
            professorEscolhidoId: professorResponsavelId,
          }),
        ]);
        const agoraMs = Date.now();
        await executar(tx, registrarLog, [randomUUID(), arquiva.prontuarioId, arquiva.prontuarioId, "transferir-titularidade", agoraMs]);
        await executar(tx, registrarLog, [randomUUID(), recebe.prontuarioId, recebe.prontuarioId, "transferir-titularidade", agoraMs]);

        const sufixoProfessor = ` Professor responsável: ${professorResponsavel.nome}.`;
        await notificar(
          tx,
          arquiva.alunoId,
          arquiva.prontuarioId,
          "titularidade-transferida",
          `O prontuário de ${arquiva.pacienteNome} foi transferido para ${textoDupla(duplaRecebe)}. Ele continua disponível apenas para consulta.${sufixoProfessor}`,
        );
        await notificar(
          tx,
          recebe.alunoId,
          recebe.prontuarioId,
          "titularidade-recebida",
          `O prontuário de ${recebe.pacienteNome} ficou com ${textoDupla(duplaRecebe)}. O histórico de ${textoDupla(duplaArquiva)} está disponível em cada seção.${sufixoProfessor}`,
        );
        return { ok: true as const };
      });

      if ("falha" in resultado) return responderFalha(reply, resultado);
      req.log.info(
        { prontuarioAntigoId, prontuarioNovoId, quemRecebe, professorId: req.user.sub, professorEscolhidoId },
        "titularidade transferida",
      );
      return resultado;
    },
  );

  const recusar = (reply: FastifyReply, status: number, message: string, codigo: CodigoErroRevisao) =>
    reply.status(status).send({ message, codigo });

  app.post<{ Params: { id: string } }>("/prontuarios/:id/assinar", protegida, async (req, reply) => {
    const { matricula, senha } = assinarSchema.parse(req.body);

    const professor = await uma<ProfessorRow>(db, buscarProfessor, [req.user.sub]);
    if (!professor) return reply.status(403).send({ message: "Apenas professores podem assinar prontuários." });

    if (!professor.matricula || professor.matricula !== matricula) {
      return recusar(reply, 401, "Matrícula não confere", "MATRICULA_NAO_CONFERE");
    }
    if (!(await verificarSenha(senha, professor.senhaHash))) {
      return recusar(reply, 401, "Senha incorreta", "SENHA_INCORRETA");
    }

    const { id } = req.params;
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioRevisaoRow>(tx, buscarParaAcao, [id]);
      if (!pront) return { erro: 404 as const };
      if (pront.status.toUpperCase() !== "ENVIADO") return { erro: 409 as const };
      if (pront.professorSupervisorId !== professor.id) return { erro: 403 as const };

      const agora = new Date().toISOString();
      await executar(tx, gravarAssinatura, [agora, professor.id, professor.nome, agora, id]);
      await executar(tx, registrarLog, [randomUUID(), id, id, "assinar", Date.now()]);

      const secao = await uma<{ conteudo: string }>(tx, buscarSecaoProcedimentos, [id]);
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

    const professor = await uma<ProfessorRow>(db, buscarProfessor, [req.user.sub]);
    if (!professor) return reply.status(403).send({ message: "Apenas professores podem devolver prontuários." });

    const { id } = req.params;
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioRevisaoRow>(tx, buscarParaAcao, [id]);
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

      await executar(tx, gravarDevolucao, [
        agora,
        professor.id,
        professor.nome,
        motivo,
        comentario,
        novoAcessoExpiraEm,
        agora,
        id,
      ]);
      await executar(tx, registrarLog, [randomUUID(), id, id, "devolver", agoraMs]);
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

  app.post<{ Params: { id: string } }>("/prontuarios/:id/comentario", protegida, async (req, reply) => {
    const { comentario } = comentarioProfessorSchema.parse(req.body);

    const professor = await uma<ProfessorRow>(db, buscarProfessor, [req.user.sub]);
    if (!professor) return reply.status(403).send({ message: "Apenas professores podem comentar prontuários." });

    const { id } = req.params;
    const resultado = await transacao(db, async (tx) => {
      const pront = await uma<ProntuarioRevisaoRow>(tx, buscarParaAcao, [id]);
      if (!pront) return { erro: 404 as const };
      if (pront.status.toUpperCase() !== "ENVIADO") return { erro: 409 as const };
      if (pront.professorSupervisorId !== professor.id) return { erro: 403 as const };

      const partes = await uma<PartesRow>(tx, buscarPartes, [id]);
      const agora = new Date().toISOString();
      await executar(tx, registrarAuditoria, [
        randomUUID(),
        professor.id,
        id,
        "comentario-professor",
        JSON.stringify({ comentario }),
      ]);
      if (partes) {
        await notificar(
          tx,
          partes.alunoId,
          id,
          "comentario-professor",
          `${professor.nome} comentou o prontuário de ${partes.pacienteNome}: ${comentario}`,
        );
      }
      return { agora };
    });

    if ("erro" in resultado) {
      if (resultado.erro === 404) return reply.status(404).send({ message: "Prontuário não encontrado." });
      if (resultado.erro === 409) {
        return recusar(reply, 409, "Prontuário não está aguardando revisão", "NAO_AGUARDANDO");
      }
      return recusar(reply, 403, "Apenas o professor supervisor pode comentar", "NAO_SUPERVISOR");
    }

    req.log.info({ prontuarioId: id, professorId: professor.id }, "comentário do professor registrado");
    const resposta: ComentarioProfessorResponse = { ok: true, comentadoEm: resultado.agora };
    return resposta;
  });

};