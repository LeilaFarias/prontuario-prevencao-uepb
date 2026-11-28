import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  secoesVazias,
  syncBatchSchema,
  type EnvioSincronizado,
  type SyncOperation,
  type SyncResponse,
} from "@prontuario/shared";
import { comSavepoint, executar, todas, transacao, uma, type Executor } from "../db";
import {
  ACESSO_DURACAO_MS,
  acessoCobreOperacaoOuLiberacao,
  alunoPodeEditar,
  professorPodeEditar,
  type AcessoRow,
} from "../lib/acesso";
import { enviarProntuario } from "../lib/envio";
import { reabrirProntuario } from "../lib/reabertura";

const TS_TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const prontuarioPayload = z.object({
  pacienteNome: z.string().optional(),
  pacienteDataNascimento: z.string().optional(),
  alunoTitularId: z.string().optional(),
});

const secaoPayload = z.object({
  secaoId: z.string().min(1),
  conteudo: z.unknown(),
});

const liberacaoOfflinePayload = z.object({
  professorId: z.string().min(1),
  prontuarioId: z.string().min(1),
  liberadoEm: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

interface ProntRow extends AcessoRow {
  id: string;
  status: string;
  alunoTitularId: string;
  professorSupervisorId: string | null;
  descartadoEm: string | null;
  desfechoEnvio: string | null;
}

interface RascunhoRow {
  id: string;
  status: string;
  alunoTitularId: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
}

interface ProfessorLiberacaoRow {
  professorId: string;
  nome: string;
  pinHashClient: string;
  saltClient: string;
}

interface UsuarioSync {
  id: string;
  perfil: "aluno" | "professor";
}

const editaFicha = (op: SyncOperation): boolean =>
  op.entity === "secao" || (op.entity === "prontuario" && (op.op === "create" || op.op === "update"));

export const syncRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarPront = `SELECT "id", "status", "alunoTitularId", "professorSupervisorId", "descartadoEm", "desfechoEnvio",
            "acessoSolicitadoEm", "acessoExpiraEm", "acessoRevogadoEm", "acessoRecusadoEm"
      FROM "Prontuario" WHERE "id" = $1 FOR UPDATE`;
  const invalidarAssinatura = `UPDATE "Prontuario"
     SET "status" = 'EM_ANDAMENTO',
         "assinadoEm" = NULL, "assinadoPorId" = NULL, "assinadoPorNome" = NULL,
         "assinaturaInvalidada" = TRUE,
         "acessoSolicitadoEm" = NULL,
         "atualizadoEm" = $1
     WHERE "id" = $2`;
  const inserirPront = `INSERT INTO "Prontuario" ("id", "pacienteNome", "pacienteDataNascimento", "alunoTitularId", "status", "acessoExpiraEm")
     VALUES ($1, $2, $3, $4, COALESCE($5::text, 'EM_ANDAMENTO'), $6)`;
  const atualizarPront = `UPDATE "Prontuario" SET
       "pacienteNome" = COALESCE($1, "pacienteNome"),
       "pacienteDataNascimento" = COALESCE($2::timestamptz, "pacienteDataNascimento"),
       "status" = COALESCE($3::text, "status"),
       "atualizadoEm" = $4
     WHERE "id" = $5`;
  const buscarParaDescarte = `SELECT "id", "status", "alunoTitularId", "pacienteNome", "pacienteDataNascimento" FROM "Prontuario" WHERE "id" = $1`;
  const buscarSecoesParaDescarte = `SELECT "conteudo" FROM "Secao" WHERE "prontuarioId" = $1`;
  const gravarDescarte = `UPDATE "Prontuario" SET "descartadoEm" = $1, "descartadoPorId" = $2, "atualizadoEm" = $3 WHERE "id" = $4`;
  const gravarLiberacaoManual = `UPDATE "Prontuario"
     SET "acessoExpiraEm" = $1, "acessoRevogadoEm" = NULL, "acessoSolicitadoEm" = NULL,
         "acessoRecusadoEm" = NULL, "atualizadoEm" = $2
     WHERE "id" = $3`;
  const registrarAuditoria = `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`;
  const upsertSecao = `INSERT INTO "Secao" ("id", "prontuarioId", "secaoId", "conteudo", "atualizadoEm") VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("prontuarioId", "secaoId")
     DO UPDATE SET "conteudo" = EXCLUDED."conteudo", "atualizadoEm" = EXCLUDED."atualizadoEm"`;
  const apagarSecao = `DELETE FROM "Secao" WHERE "prontuarioId" = $1 AND "secaoId" = $2`;
  const registrar = `INSERT INTO "SyncOperationLog" ("id", "prontuarioId", "entity", "entityId", "op", "ts", "descartada")
     VALUES ($1, (SELECT "id" FROM "Prontuario" WHERE "id" = $2), $3, $4, $5, $6, $7)`;

  const buscarProfessorAtivo = `SELECT "id" FROM "Usuario" WHERE "id" = $1 AND UPPER("perfil") = 'PROFESSOR' AND "ativo"`;
  const buscarLiberacaoOffline = `SELECT "id", "alunoId" FROM "LiberacaoOffline" WHERE "id" = $1`;
  const inserirLiberacaoOffline = `INSERT INTO "LiberacaoOffline" ("id", "alunoId", "professorId", "prontuarioId", "liberadoEm", "expiresAt", "sincronizado")
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)`;

  async function registrarLiberacaoOffline(
    tx: Executor,
    op: SyncOperation,
    usuario: UsuarioSync,
    pront: ProntRow,
  ): Promise<boolean> {
    if (usuario.perfil !== "aluno") return false;
    const p = liberacaoOfflinePayload.safeParse(op.payload);
    if (!p.success) return false;

    const { professorId, liberadoEm, expiresAt } = p.data;
    if (p.data.prontuarioId !== op.prontuarioId) return false;
    if (liberadoEm > Date.now() + TS_TOLERANCIA_FUTURO_MS) return false;
    if (expiresAt <= liberadoEm || expiresAt > liberadoEm + ACESSO_DURACAO_MS) return false;
    const professor = await uma<{ id: string }>(tx, buscarProfessorAtivo, [professorId]);
    if (!professor) return false;

    const existente = await uma<{ id: string; alunoId: string }>(tx, buscarLiberacaoOffline, [op.entityId]);
    if (existente) return existente.alunoId === usuario.id;

    const liberadoIso = new Date(liberadoEm).toISOString();
    const expiraIso = new Date(expiresAt).toISOString();
    await executar(tx, inserirLiberacaoOffline, [
      op.entityId, usuario.id, professorId, op.prontuarioId, liberadoIso, expiraIso,
    ]);

    const revogadoEm = pront.acessoRevogadoEm ? new Date(pront.acessoRevogadoEm).getTime() : null;
    if (revogadoEm === null || liberadoEm > revogadoEm) {
      await executar(tx, gravarLiberacaoManual, [expiraIso, new Date().toISOString(), op.prontuarioId]);
    }

    await executar(tx, registrarAuditoria, [
      randomUUID(),
      usuario.id,
      op.prontuarioId,
      "acesso-liberado-offline",
      JSON.stringify({ professorId, liberadoEm, expiresAt }),
    ]);
    return true;
  }

  async function secoesSemConteudo(tx: Executor, prontuarioId: string): Promise<boolean> {
    const linhas = await todas<{ conteudo: string }>(tx, buscarSecoesParaDescarte, [prontuarioId]);
    const conteudos: unknown[] = [];
    for (const linha of linhas) {
      try {
        conteudos.push(JSON.parse(linha.conteudo));
      } catch {
        return false;
      }
    }
    return secoesVazias(conteudos);
  }

  async function descartarRascunho(tx: Executor, op: SyncOperation, usuario: UsuarioSync): Promise<boolean> {
    const pront = await uma<RascunhoRow>(tx, buscarParaDescarte, [op.prontuarioId]);
    if (!pront) return false;
    if (pront.alunoTitularId !== usuario.id) return false;
    if (pront.status.toUpperCase() !== "EM_ANDAMENTO") return false;
    if (pront.pacienteNome.trim() !== "" || pront.pacienteDataNascimento) return false;
    if (!(await secoesSemConteudo(tx, pront.id))) return false;

    const agora = new Date().toISOString();
    await executar(tx, gravarDescarte, [agora, usuario.id, agora, pront.id]);
    await executar(tx, registrarAuditoria, [
      randomUUID(),
      usuario.id,
      pront.id,
      "rascunho-descartado",
      JSON.stringify({ motivo: "aluno descartou rascunho vazio" }),
    ]);
    return true;
  }

  async function aplicar(tx: Executor, op: SyncOperation, existe: boolean, usuario: UsuarioSync): Promise<void> {
    const agora = new Date().toISOString();

    if (op.entity === "prontuario") {
      if (op.op === "delete") throw new Error("Exclusão de prontuário não é permitida");
      const p = prontuarioPayload.parse(op.payload);
      let nascimento: string | null = null;
      if (p.pacienteDataNascimento) {
        const d = new Date(p.pacienteDataNascimento);
        if (Number.isNaN(d.getTime())) throw new Error("Data de nascimento inválida");
        nascimento = d.toISOString();
      }

      if (!existe) {
        if (!p.alunoTitularId || p.pacienteNome === undefined) throw new Error("Payload incompleto para criar prontuário");
        if (usuario.perfil !== "aluno" || p.alunoTitularId !== usuario.id) {
          throw new Error("Prontuário não pode ser criado em nome de outro usuário");
        }
        const acessoExpiraEm = new Date(op.ts + ACESSO_DURACAO_MS).toISOString();
        await executar(tx, inserirPront, [op.entityId, p.pacienteNome, nascimento, p.alunoTitularId, "EM_ANDAMENTO", acessoExpiraEm]);
      } else {
        await executar(tx, atualizarPront, [p.pacienteNome || null, nascimento, null, agora, op.entityId]);
      }
      return;
    }

    if (op.entity === "secao") {
      if (!existe) throw new Error("Prontuário não existe no servidor");
      const p = secaoPayload.parse(op.payload);
      if (op.op === "delete") {
        await executar(tx, apagarSecao, [op.prontuarioId, p.secaoId]);
        return;
      }
      await executar(tx, upsertSecao, [randomUUID(), op.prontuarioId, p.secaoId, JSON.stringify(p.conteudo ?? {}), agora]);
      return;
    }

    throw new Error(`Entidade "${op.entity}" ainda não suportada na Sprint 1`);
  }

  const buscarProfessoresLiberacao = `SELECT u."id" AS "professorId", u."nome", u."pinHashClient", u."saltClient"
     FROM "Usuario" u
     WHERE UPPER(u."perfil") = 'PROFESSOR'
       AND u."ativo"
       AND u."pinHashClient" IS NOT NULL
       AND u."saltClient" IS NOT NULL
     ORDER BY u."nome"`;

  app.get("/sync/professores-liberacao", { preHandler: app.autenticar }, async (req, reply) => {
    if (req.user.perfil !== "aluno") {
      return reply.status(403).send({ message: "Apenas alunos podem baixar dados de liberação." });
    }
    return todas<ProfessorLiberacaoRow>(db, buscarProfessoresLiberacao);
  });

  app.post("/sync", { preHandler: app.autenticar }, async (req) => {
    const { operations } = syncBatchSchema.parse(req.body);
    let aplicadas = 0;
    let descartadas = 0;
    const envios: EnvioSincronizado[] = [];
    const acessoExpirado = new Set<string>();
    const usuario: UsuarioSync = { id: req.user.sub, perfil: req.user.perfil };

    const temPermissao = (pront: ProntRow): boolean =>
      usuario.perfil === "aluno"
        ? pront.alunoTitularId === usuario.id
        : pront.professorSupervisorId === usuario.id;

    // sort é estável: operações com o mesmo ts mantêm a ordem de chegada
    for (const op of [...operations].sort((a, b) => a.ts - b.ts)) {
      const descartada = await transacao(db, async (tx) => {
        const pront = await uma<ProntRow>(tx, buscarPront, [op.prontuarioId]);

        const status = pront?.status.toUpperCase();
        const assinado = status === "ASSINADO";
        const enviado = status === "ENVIADO";
        const transferido = status === "TRANSFERIDO";
        const negado = !!pront && (pront.descartadoEm !== null || !temPermissao(pront));
        const tsFuturo = op.ts > Date.now() + TS_TOLERANCIA_FUTURO_MS;
        const professorEditaSecao =
          !!pront &&
          op.entity === "secao" &&
          (op.op === "update" || op.op === "create") &&
          professorPodeEditar(pront, usuario);
        let descartar = negado || tsFuturo;
        if (negado) {
          req.log.warn(
            { usuarioId: usuario.id, prontuarioId: op.prontuarioId, op: op.op, entity: op.entity },
            "sync: operação em prontuário sem permissão descartada",
          );
        }

        if (pront && !descartar && editaFicha(op)) {
          if (transferido) {
            descartar = true;
          } else if (assinado) {
            if (await acessoCobreOperacaoOuLiberacao(tx, pront, op.ts)) {
              const agora = new Date().toISOString();
              await executar(tx, invalidarAssinatura, [agora, pront.id]);
              await executar(tx, registrar, [
                randomUUID(), pront.id, "prontuario", pront.id, "invalidar-assinatura", Date.now(), false,
              ]);
              pront.status = "EM_ANDAMENTO";
            } else {
              descartar = true;
              acessoExpirado.add(op.prontuarioId);
            }
          } else if (
            enviado &&
            !(usuario.perfil === "aluno" && alunoPodeEditar(pront.status, pront.desfechoEnvio)) &&
            !professorEditaSecao
          ) {
            descartar = true;
            if (!(await acessoCobreOperacaoOuLiberacao(tx, pront, op.ts))) acessoExpirado.add(op.prontuarioId);
          }
        }

        const liberacaoOffline = op.entity === "prontuario" && op.op === "liberacao-offline";

        if (
          !descartar &&
          !liberacaoOffline &&
          !professorEditaSecao &&
          pront?.acessoRevogadoEm &&
          op.ts > new Date(pront.acessoRevogadoEm).getTime()
        ) {
          descartar = true;
        }

        if (!descartar) {
          try {
            await comSavepoint(tx, async () => {
              if (op.entity === "prontuario" && op.op === "descartar") {
                if (!(await descartarRascunho(tx, op, usuario))) descartar = true;
              } else if (op.entity === "prontuario" && op.op === "enviar") {
                const r = await enviarProntuario(tx, op.prontuarioId, req.user.sub);
                envios.push({ prontuarioId: op.prontuarioId, ...r });
                if (!r.ok) descartar = true;
              } else if (liberacaoOffline) {
                if (!pront || !(await registrarLiberacaoOffline(tx, op, usuario, pront))) descartar = true;
              } else if (op.entity === "prontuario" && op.op === "reabrir") {
                if ((await reabrirProntuario(tx, op.prontuarioId, req.user.sub)) !== "ok") descartar = true;
              } else {
                await aplicar(tx, op, !!pront, usuario);
                if (professorEditaSecao) {
                  const secao = secaoPayload.safeParse(op.payload);
                  await executar(tx, registrarAuditoria, [
                    randomUUID(),
                    usuario.id,
                    op.prontuarioId,
                    "secao-editada-professor",
                    JSON.stringify({ secaoId: secao.success ? secao.data.secaoId : null, status: "ENVIADO" }),
                  ]);
                }
              }
            });
          } catch (err) {
            req.log.warn({ err, entityId: op.entityId }, "operação de sync descartada");
            descartar = true;
          }
        }

        await executar(tx, registrar, [
          randomUUID(), op.prontuarioId, op.entity, op.entityId, op.op, op.ts, descartar,
        ]);
        return descartar;
      });

      req.log.info({ op: op.op, entity: op.entity, entityId: op.entityId, descartada }, "sync: operação recebida");
      if (descartada) descartadas++;
      else aplicadas++;
    }

    const resposta: SyncResponse = {
      aplicadas,
      descartadas,
      serverTime: Date.now(),
      envios,
      acessoExpirado: [...acessoExpirado],
    };
    return resposta;
  });
};