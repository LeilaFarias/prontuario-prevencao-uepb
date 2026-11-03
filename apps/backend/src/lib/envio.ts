import type { DatabaseSync } from "node:sqlite";
import type { ResultadoEnvio } from "@prontuario/shared";

interface ProntuarioEnvioRow {
  id: string;
  status: string;
  pacienteNome: string;
  pacienteDataNascimento: string | null;
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
  db: DatabaseSync,
  pront: Pick<ProntuarioEnvioRow, "id" | "pacienteNome" | "pacienteDataNascimento">,
  alunoId: string,
): DuplicadoRow | undefined {
  if (!pront.pacienteDataNascimento) return undefined;
  return db
    .prepare(
      `SELECT id, alunoTitularId, criadoEm, status FROM Prontuario
       WHERE pacienteNome = ? AND pacienteDataNascimento = ?
         AND id != ? AND alunoTitularId != ? AND status NOT IN ('EM_ANDAMENTO', 'TRANSFERIDO')
       ORDER BY criadoEm ASC LIMIT 1`,
    )
    .get(pront.pacienteNome, pront.pacienteDataNascimento, pront.id, alunoId) as unknown as DuplicadoRow | undefined;
}

export function enviarProntuario(db: DatabaseSync, prontuarioId: string, alunoId: string): ResultadoEnvio {
  const pront = db
    .prepare(
      `SELECT id, status, pacienteNome, pacienteDataNascimento
       FROM Prontuario WHERE id = ? AND alunoTitularId = ?`,
    )
    .get(prontuarioId, alunoId) as unknown as ProntuarioEnvioRow | undefined;
  if (!pront) return { ok: false, erro: "nao_encontrado" };
  if (pront.status !== "EM_ANDAMENTO" && pront.status !== "DEVOLVIDO") return { ok: false, erro: "ja_enviado" };

  const secao = db
    .prepare("SELECT conteudo FROM Secao WHERE prontuarioId = ? AND secaoId = 'consentimento'")
    .get(prontuarioId) as unknown as { conteudo: string } | undefined;

  let nomeProfessor = "";
  if (secao) {
    try {
      const conteudo = JSON.parse(secao.conteudo) as { professorSupervisor?: unknown };
      if (typeof conteudo.professorSupervisor === "string") nomeProfessor = conteudo.professorSupervisor.trim();
    } catch {
    }
  }
  if (!nomeProfessor) return { ok: false, erro: "professor_nao_encontrado" };

  const professor = db
    .prepare("SELECT id, nome FROM Usuario WHERE nome = ? AND UPPER(perfil) = 'PROFESSOR' AND ativo = 1 LIMIT 1")
    .get(nomeProfessor) as unknown as ProfessorRow | undefined;
  if (!professor) return { ok: false, erro: "professor_nao_encontrado" };

  const duplicado = buscarDuplicado(db, pront, alunoId);
  const agora = new Date().toISOString();

  db.prepare(
    `UPDATE Prontuario
     SET status = 'ENVIADO', professorSupervisorId = ?, sinalizadoDuplicidade = ?, atualizadoEm = ?
     WHERE id = ?`,
  ).run(professor.id, duplicado ? 1 : 0, agora, pront.id);

  if (duplicado) db.prepare("UPDATE Prontuario SET atualizadoEm = ? WHERE id = ?").run(agora, duplicado.id);

  return {
    ok: true,
    duplicado: Boolean(duplicado),
    prontuarioDuplicadoId: duplicado?.id ?? null,
    prontuarioDuplicadoCriadoEm: duplicado?.criadoEm ?? null,
    prontuarioDuplicadoStatus: duplicado?.status.toLowerCase() ?? null,
    professorNome: professor.nome,
  };
}