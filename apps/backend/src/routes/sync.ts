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
import { acessoCobreOperacao, type AcessoRow } from "../lib/acesso";
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

interface ProntRow extends AcessoRow {
  id: string;
  status: string;
}

const editaFicha = (op: SyncOperation): boolean =>
  op.entity === "secao" || (op.entity === "prontuario" && (op.op === "create" || op.op === "update"));

export const syncRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarPront = db.prepare(
    "SELECT id, status, acessoSolicitadoEm, acessoExpiraEm, acessoRevogadoEm FROM Prontuario WHERE id = ?",
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

        const assinado = pront?.status.toUpperCase() === "ASSINADO";
        let descartar = false;

        if (pront && assinado && editaFicha(op)) {
          if (acessoCobreOperacao(pront, op.ts)) {
            const agora = new Date().toISOString();
            invalidarAssinatura.run(agora, pront.id);
            registrar.run(randomUUID(), pront.id, "prontuario", pront.id, "invalidar-assinatura", Date.now(), 0);
            pront.status = "EM_ANDAMENTO";
          } else {
            descartar = true;
            acessoExpirado.add(op.prontuarioId);
          }
        } else if (pront?.acessoRevogadoEm && op.ts > new Date(pront.acessoRevogadoEm).getTime()) {
          descartar = true;
        }

        if (!descartar) {
          try {
            if (op.entity === "prontuario" && op.op === "enviar") {
              const r = enviarProntuario(db, op.prontuarioId, req.user.sub);
              envios.push({ prontuarioId: op.prontuarioId, ...r });
              if (!r.ok) descartar = true;
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
