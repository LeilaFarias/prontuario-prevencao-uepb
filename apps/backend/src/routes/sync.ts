import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { syncBatchSchema, type SyncOperation, type SyncResponse } from "@prontuario/shared";
import { transacao } from "../db";

const prontuarioPayload = z.object({
  pacienteNome: z.string().min(1).optional(),
  pacienteDataNascimento: z.string().optional(),
  status: z.string().optional(),
  alunoTitularId: z.string().optional(),
});

const secaoPayload = z.object({
  secaoId: z.string().min(1),
  conteudo: z.unknown(),
});

interface ProntRow {
  id: string;
  acessoRevogadoEm: string | null;
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  const buscarPront = db.prepare("SELECT id, acessoRevogadoEm FROM Prontuario WHERE id = ?");
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
        if (!p.alunoTitularId || !p.pacienteNome) throw new Error("Payload incompleto para criar prontuário");
        inserirPront.run(op.entityId, p.pacienteNome, nascimento, p.alunoTitularId, status);
      } else {
        atualizarPront.run(p.pacienteNome ?? null, nascimento, status, agora, op.entityId);
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

  app.post("/sync", async (req) => {
    const { operations } = syncBatchSchema.parse(req.body);
    let aplicadas = 0;
    let descartadas = 0;

    // sort é estável: operações com o mesmo ts mantêm a ordem de chegada
    for (const op of [...operations].sort((a, b) => a.ts - b.ts)) {
      const descartada = transacao(db, () => {
        const pront = buscarPront.get(op.prontuarioId) as unknown as ProntRow | undefined;

        // RN-12: operação posterior à revogação do acesso é descartada
        let descartar =
          !!pront?.acessoRevogadoEm && op.ts > new Date(pront.acessoRevogadoEm).getTime();

        if (!descartar) {
          try {
            aplicar(op, !!pront);
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

    const resposta: SyncResponse = { aplicadas, descartadas, serverTime: Date.now() };
    return resposta;
  });
};
