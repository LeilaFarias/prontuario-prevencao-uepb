import type { LocalProntuario } from "../db/dexie";

export const ACESSO_EXPIRADO_EVENT = "acesso:expirado";
export const ACESSOS_ATUALIZADOS_EVENT = "acessos:atualizados";

type CamposAcesso = Pick<
  LocalProntuario,
  "acessoSolicitadoEm" | "acessoExpiraEm" | "acessoRevogadoEm" | "acessoRecusadoEm"
>;

export function acessoVigente(p: CamposAcesso, agora: number = Date.now()): boolean {
  if (!p.acessoExpiraEm) return false;
  if (p.acessoRevogadoEm) return false;
  return new Date(p.acessoExpiraEm).getTime() > agora;
}

export function pedidoPendente(p: CamposAcesso): boolean {
  if (p.acessoRecusadoEm) return false;
  return Boolean(p.acessoSolicitadoEm) && !acessoVigente(p);
}

export function formatarContagem(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pedidoRecusado(p: CamposAcesso): boolean {
  return !!p.acessoRecusadoEm && !acessoVigente(p);
}
