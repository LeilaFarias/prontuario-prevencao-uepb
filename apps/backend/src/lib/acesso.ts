import { ACESSO_TEMPORARIO_HORAS } from "@prontuario/shared";

export const ACESSO_DURACAO_MS = ACESSO_TEMPORARIO_HORAS * 3600 * 1000;

export interface AcessoRow {
  acessoSolicitadoEm: string | null;
  acessoExpiraEm: string | null;
  acessoRevogadoEm: string | null;
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