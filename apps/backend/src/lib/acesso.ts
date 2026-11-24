import { randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { ACESSO_TEMPORARIO_HORAS } from "@prontuario/shared";
import { executar, uma, type Executor } from "../db";

const scryptAsync = promisify(scrypt);

export const ACESSO_DURACAO_MS = ACESSO_TEMPORARIO_HORAS * 3600 * 1000;

export interface AcessoRow {
  acessoSolicitadoEm: string | null;
  acessoExpiraEm: string | null;
  acessoRevogadoEm: string | null;
  acessoRecusadoEm: string | null;
}

const paraMs = (iso: string): number => new Date(iso).getTime();

export function pedidoPendente(r: AcessoRow): boolean {
  return r.acessoSolicitadoEm !== null && r.acessoExpiraEm === null && r.acessoRevogadoEm === null;
}

export function acessoVigente(r: AcessoRow, agora: number = Date.now()): boolean {
  return r.acessoExpiraEm !== null && paraMs(r.acessoExpiraEm) > agora && r.acessoRevogadoEm === null;
}

export function acessoCobreOperacao(r: AcessoRow, ts: number): boolean {
  if (r.acessoRevogadoEm !== null) return ts <= paraMs(r.acessoRevogadoEm);
  if (r.acessoExpiraEm !== null) return ts <= paraMs(r.acessoExpiraEm);
  return false;
}

export function estadoAcesso(r: AcessoRow, agora: number = Date.now()) {
  const vigente = acessoVigente(r, agora);
  return {
    acessoVigente: vigente,
    pedidoPendente: pedidoPendente(r),
    segundosRestantesAcesso:
      vigente && r.acessoExpiraEm ? Math.max(0, Math.floor((paraMs(r.acessoExpiraEm) - agora) / 1000)) : 0,
  };
}

export function tempoDeEspera(iso: string, agora: number = Date.now()): string {
  const minutos = Math.max(0, Math.floor((agora - paraMs(iso)) / 60_000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function alunoPodeEditar(status: string, _desfechoEnvio?: string | null): boolean {
  const s = status.toUpperCase();
  return s === "EM_ANDAMENTO" || s === "DEVOLVIDO";
}

export const liberacaoManualOnlineSchema = z.object({
  matricula: z.string().trim().min(1),
  pin: z.string().regex(/^\d{8}$/),
});

export const PIN_INVALIDO = { message: "PIN inválido", codigo: "PIN_INVALIDO" } as const;

interface ProfessorPinRow {
  id: string;
  pinHash: string | null;
  saltServer: string | null;
}

export async function verificarPinProfessor(db: Executor, matricula: string, pin: string): Promise<string | null> {
  const professor = await uma<ProfessorPinRow>(
    db,
    `SELECT "id", "pinHash", "saltServer" FROM "Usuario" WHERE "matricula" = $1 AND UPPER("perfil") = 'PROFESSOR' AND "ativo"`,
    [matricula],
  );
  if (!professor?.pinHash || !professor.saltServer) return null;

  const esperado = Buffer.from(professor.pinHash, "hex");
  const calculado = (await scryptAsync(pin, professor.saltServer, 64)) as Buffer;
  if (esperado.length !== calculado.length || !timingSafeEqual(esperado, calculado)) return null;
  return professor.id;
}

export async function registrarAcessoLiberadoOnline(
  db: Executor,
  professorId: string,
  prontuarioId: string,
  matricula: string,
): Promise<void> {
  await executar(
    db,
    `INSERT INTO "AuditLog" ("id", "usuarioId", "prontuarioId", "acao", "detalhe") VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), professorId, prontuarioId, "acesso-liberado-online", JSON.stringify({ matricula })],
  );
}

export async function acessoCobreOperacaoOuLiberacao(
  db: Executor,
  r: AcessoRow & { id: string },
  ts: number,
): Promise<boolean> {
  if (acessoCobreOperacao(r, ts)) return true;
  const quando = new Date(ts).toISOString();
  const liberacao = await uma<{ id: string }>(
    db,
    `SELECT "id" FROM "LiberacaoOffline"
     WHERE "prontuarioId" = $1
       AND "liberadoEm" <= $2::timestamptz
       AND "expiresAt" >= $2::timestamptz
       AND ($3::timestamptz IS NULL OR "liberadoEm" > $3::timestamptz)
     LIMIT 1`,
    [r.id, quando, r.acessoRevogadoEm],
  );
  return liberacao !== undefined;
}