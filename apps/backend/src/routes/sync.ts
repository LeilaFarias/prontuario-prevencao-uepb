import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  syncBatchSchema,
  type EnvioSincronizado,
  type SyncOperation,
  type SyncResponse,
} from "@prontuario/shared";
import { transacao } from "../db";
import { ACESSO_DURACAO_MS, acessoCobreOperacao, type AcessoRow } from "../lib/acesso";
import { enviarProntuario } from "../lib/envio";
import { reabrirProntuario } from "../lib/reabertura";

const prontuarioPayload = z.object({
  pacienteNome: z.string().optional(),
  pacienteDataNascimento: z.string().optional(),
  status: z.string().optional(),
  alunoTitularId: z.string().optional(),
});

const secaoPayload = z.object({
  secaoId: z.string().min(1),
  conteudo: z.unknown(),
});

const liberacaoManualPayload = z.object({
  matricula: z.string().trim().min(1),
  acessoExpiraEm: z.string().refine((v) => !Number.isNaN(new Date(v).getTime())),
});

interface ProntRow extends AcessoRow {
  id: string;
  status: string;
}

const editaFicha = (op: SyncOperation): boolean =>
  op.entity === "secao" || (op.entity === "prontuario" && (op.op === "create" || op.op === "update"));

export const syncRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarPront = db.prepare(
    `SELECT id, status, acessoSolicitadoEm, acessoExpiraEm, acessoRevogadoEm, acessoRecusadoEm
      FROM Prontuario WHERE id = ?`,
  );
  const invalidarAssinatura = db.prepare(
    `UPDATE Prontuario
     SET status = 'EM_ANDAMENTO',
         assinadoEm = NULL, assinadoPorId = NULL, assinadoPorNome = NULL,
         assinaturaInvalidada = 1,
         acessoSolicitadoEm = NULL, acessoExpiraEm = NULL, acessoRevogadoEm = NULL,
         atualizadoEm = ?
     WHERE id = ?`,
  );
  const inserirPront = db.prepare(
    `INSERT INTO Prontuario (id, pacienteNome, pacienteDataNascimento, alunoTitularId, status)
     VALUES (?, ?, ?, ?, COALESCE(?, 'EM_ANDAMENTO'))`,
  );
  const atualizarPront = db.prepare(
    `UPDATE Prontuario SET
       pacienteNome = COALESCE(?, pacienteNome),
       pacienteDataNascimento = COALESCE(?, pacienteDataNascimento),
       status = COALESCE(?, status),
       atualizadoEm = ?
     WHERE id = ?`,
  );
  const apagarPront = db.prepare("DELETE FROM Prontuario WHERE id = ?");
  const buscarProfessorPorMatricula = db.prepare(
    "SELECT id FROM Usuario WHERE matricula = ? AND UPPER(perfil) = 'PROFESSOR' AND ativo = 1",
  );
  const gravarLiberacaoManual = db.prepare(
    `UPDATE Prontuario
     SET acessoExpiraEm = ?, acessoRevogadoEm = NULL, acessoSolicitadoEm = NULL,
         acessoRecusadoEm = NULL, atualizadoEm = ?
     WHERE id = ?`,
  );
  const registrarAuditoria = db.prepare(
    `INSERT INTO AuditLog (id, usuarioId, prontuarioId, acao, detalhe) VALUES (?, ?, ?, ?, ?)`,
  );
  const upsertSecao = db.prepare(
    `INSERT INTO Secao (id, prontuarioId, secaoId, conteudo, atualizadoEm) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (prontuarioId, secaoId)
     DO UPDATE SET conteudo = excluded.conteudo, atualizadoEm = excluded.atualizadoEm`,
  );
  const apagarSecao = db.prepare("DELETE FROM Secao WHERE prontuarioId = ? AND secaoId = ?");
  const registrar = db.prepare(
    `INSERT INTO SyncOperationLog (id, prontuarioId, entity, entityId, op, ts, descartada)
     VALUES (?, (SELECT id FROM Prontuario WHERE id = ?), ?, ?, ?, ?, ?)`,
  );

  function liberarManualmente(op: SyncOperation): boolean {
    const p = liberacaoManualPayload.safeParse(op.payload);
    if (!p.success) return false;

    const professor = buscarProfessorPorMatricula.get(p.data.matricula) as unknown as { id: string } | undefined;
    if (!professor) return false;

    const expiraMs = new Date(p.data.acessoExpiraEm).getTime();
    if (expiraMs > op.ts + ACESSO_DURACAO_MS) return false;

    const agora = new Date().toISOString();
    gravarLiberacaoManual.run(new Date(expiraMs).toISOString(), agora, op.prontuarioId);
    registrarAuditoria.run(
      randomUUID(),
      professor.id,
      op.prontuarioId,
      "liberacao-manual-offline",
      JSON.stringify({ matricula: p.data.matricula, acessoExpiraEm: p.data.acessoExpiraEm, ts: op.ts }),
    );
    return true;
  }

  function aplicar(op: SyncOperation, existe: boolean): void {
    const agora = new Date().toISOString();

    if (op.entity === "prontuario") {
      if (op.op === "delete") {
        apagarPront.run(op.entityId);
        return;
      }
      const p = prontuarioPayload.parse(op.payload);
      let nascimento: string | null = null;
      if (p.pacienteDataNascimento) {
        const d = new Date(p.pacienteDataNascimento);
        if (Number.isNaN(d.getTime())) throw new Error("Data de nascimento inválida");
        nascimento = d.toISOString();
      }
      const status = p.status?.toUpperCase() ?? null;

      if (!existe) {
        if (!p.alunoTitularId || p.pacienteNome === undefined) throw new Error("Payload incompleto para criar prontuário");
        inserirPront.run(op.entityId, p.pacienteNome, nascimento, p.alunoTitularId, status);
      } else {
        atualizarPront.run(p.pacienteNome || null, nascimento, null, agora, op.entityId);
      }
      return;
    }

    if (op.entity === "secao") {
      if (!existe) throw new Error("Prontuário não existe no servidor");
      const p = secaoPayload.parse(op.payload);
      if (op.op === "delete") {
        apagarSecao.run(op.prontuarioId, p.secaoId);
        return;
      }
      upsertSecao.run(randomUUID(), op.prontuarioId, p.secaoId, JSON.stringify(p.conteudo ?? {}), agora);
      return;
    }

    throw new Error(`Entidade "${op.entity}" ainda não suportada na Sprint 1`);
  }

  app.post("/sync", { preHandler: app.autenticar }, async (req) => {
    const { operations } = syncBatchSchema.parse(req.body);
    let aplicadas = 0;
    let descartadas = 0;
    const envios: EnvioSincronizado[] = [];
    const acessoExpirado = new Set<string>();

    // sort é estável: operações com o mesmo ts mantêm a ordem de chegada
    for (const op of [...operations].sort((a, b) => a.ts - b.ts)) {
      const descartada = transacao(db, () => {
        const pront = buscarPront.get(op.prontuarioId) as unknown as ProntRow | undefined;

        const status = pront?.status.toUpperCase();
        const assinado = status === "ASSINADO";
        const enviado = status === "ENVIADO";
        let descartar = false;

        if (pront && editaFicha(op)) {
          if (assinado) {
            if (acessoCobreOperacao(pront, op.ts)) {
              const agora = new Date().toISOString();
              invalidarAssinatura.run(agora, pront.id);
              registrar.run(randomUUID(), pront.id, "prontuario", pront.id, "invalidar-assinatura", Date.now(), 0);
              pront.status = "EM_ANDAMENTO";
            } else {
              descartar = true;
              acessoExpirado.add(op.prontuarioId);
            }
          } else if (enviado && !acessoCobreOperacao(pront, op.ts)) {
            descartar = true;
            acessoExpirado.add(op.prontuarioId);
          }
        }

        const liberacaoManual = op.entity === "prontuario" && op.op === "liberacao-manual";

        if (
          !descartar &&
          !liberacaoManual &&
          pront?.acessoRevogadoEm &&
          op.ts > new Date(pront.acessoRevogadoEm).getTime()
        ) {
          descartar = true;
        }

        if (!descartar) {
          try {
            if (op.entity === "prontuario" && op.op === "enviar") {
              const r = enviarProntuario(db, op.prontuarioId, req.user.sub);
              envios.push({ prontuarioId: op.prontuarioId, ...r });
              if (!r.ok) descartar = true;
            } else if (liberacaoManual) {
              if (!pront || !liberarManualmente(op)) descartar = true;
            } else if (op.entity === "prontuario" && op.op === "reabrir") {
              if (reabrirProntuario(db, op.prontuarioId, req.user.sub) !== "ok") descartar = true;
            } else {
              aplicar(op, !!pront);
            }
          } catch (err) {
            req.log.warn({ err, entityId: op.entityId }, "operação de sync descartada");
            descartar = true;
          }
        }

        registrar.run(
          randomUUID(), op.prontuarioId, op.entity, op.entityId, op.op, op.ts, descartar ? 1 : 0,
        );
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