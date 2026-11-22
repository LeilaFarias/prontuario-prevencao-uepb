import { randomUUID } from "node:crypto";
import { TIPOS_DESFECHO, type ResultadoEnvio } from "@prontuario/shared";
import { executar, uma, type Executor } from "../db";
import { aguardandoConclusao } from "./acesso";

interface ProntuarioEnvioRow {
  id: string;
  status: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
  desfechoEnvio: string | null;
}

interface ProfessorRow {
  id: string;
  nome: string;
}

interface DuplicadoRow {
  id: string;
  alunoTitularId: string;
  criadoEm: string;
  status: string;
}

export function buscarDuplicado(
  db: Executor,
  pront: Pick<ProntuarioEnvioRow, "id" | "pacienteNome" | "pacienteDataNascimento">,
  alunoId: string,
): Promise<DuplicadoRow | undefined> {
  if (!pront.pacienteDataNascimento) return Promise.resolve(undefined);
  return uma<DuplicadoRow>(
    db,
    `SELECT "id", "alunoTitularId", "criadoEm", "status" FROM "Prontuario"
     WHERE "pacienteNome" = $1 AND "pacienteDataNascimento" = $2
       AND "id" != $3 AND "alunoTitularId" != $4 AND "status" NOT IN ('EM_ANDAMENTO', 'TRANSFERIDO')
     ORDER BY "criadoEm" ASC LIMIT 1`,
    [pront.pacienteNome, pront.pacienteDataNascimento, pront.id, alunoId],
  );
}

export async function enviarProntuario(db: Executor, prontuarioId: string, alunoId: string): Promise<ResultadoEnvio> {
  const pront = await uma<ProntuarioEnvioRow>(
    db,
    `SELECT "id", "status", "pacienteNome", "pacienteDataNascimento", "desfechoEnvio"
     FROM "Prontuario" WHERE "id" = $1 AND "alunoTitularId" = $2 AND "descartadoEm" IS NULL
     FOR UPDATE`,
    [prontuarioId, alunoId],
  );
  if (!pront) return { ok: false, erro: "nao_encontrado" };
  const reenvio = aguardandoConclusao(pront.status, pront.desfechoEnvio);
  if (pront.status !== "EM_ANDAMENTO" && pront.status !== "DEVOLVIDO" && !reenvio) {
    return { ok: false, erro: "ja_enviado" };
  }

  const conclusao = await uma<{ conteudo: string }>(
    db,
    `SELECT "conteudo" FROM "Secao" WHERE "prontuarioId" = $1 AND "secaoId" = 'conclusao'`,
    [prontuarioId],
  );
  let desfecho: string | null = null;
  if (conclusao) {
    try {
      const c = JSON.parse(conclusao.conteudo) as { tipoDesfecho?: unknown };
      desfecho = TIPOS_DESFECHO.find((t) => t === c.tipoDesfecho) ?? null;
    } catch {
    }
  }

  const secao = await uma<{ conteudo: string }>(
    db,
    `SELECT "conteudo" FROM "Secao" WHERE "prontuarioId" = $1 AND "secaoId" = 'consentimento'`,
    [prontuarioId],
  );

  let nomeProfessor = "";
  if (secao) {
    try {
      const conteudo = JSON.parse(secao.conteudo) as { professorSupervisor?: unknown };
      if (typeof conteudo.professorSupervisor === "string") nomeProfessor = conteudo.professorSupervisor.trim();
    } catch {
    }
  }
  if (!nomeProfessor) return { ok: false, erro: "professor_nao_encontrado" };

  const professor = await uma<ProfessorRow>(
    db,
    `SELECT "id", "nome" FROM "Usuario" WHERE "nome" = $1 AND UPPER("perfil") = 'PROFESSOR' AND "ativo" LIMIT 1`,
    [nomeProfessor],
  );
  if (!professor) return { ok: false, erro: "professor_nao_encontrado" };

  const duplicado = await buscarDuplicado(db, pront, alunoId);
  const agora = new Date().toISOString();

  await executar(
    db,
    `UPDATE "Prontuario"
     SET "status" = 'ENVIADO', "professorSupervisorId" = $1, "sinalizadoDuplicidade" = $2, "atualizadoEm" = $3,
         "desfechoEnvio" = $4
     WHERE "id" = $5`,
    [professor.id, Boolean(duplicado), agora, desfecho, pront.id],
  );

  await executar(
    db,
    `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), alunoId, pront.id, reenvio ? "prontuario-reenviado" : "prontuario-enviado", JSON.stringify({ desfecho })],
  );

  if (duplicado) await executar(db, `UPDATE "Prontuario" SET "atualizadoEm" = $1 WHERE "id" = $2`, [agora, duplicado.id]);

  return {
    ok: true,
    duplicado: Boolean(duplicado),
    prontuarioDuplicadoId: duplicado?.id ?? null,
    prontuarioDuplicadoCriadoEm: duplicado?.criadoEm ?? null,
    prontuarioDuplicadoStatus: duplicado?.status.toLowerCase() ?? null,
    professorNome: professor.nome,
  };
}