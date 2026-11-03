import type { LocalStatus } from "../db/dexie";

const prefixo = "prontuario:vistos:";

type Vistos = Record<string, string>;

export function marcadorDeAviso(status: LocalStatus, assinadoEm?: string, devolvidoEm?: string): string {
  return `${status}:${status === "assinado" ? (assinadoEm ?? "") : status === "devolvido" ? (devolvidoEm ?? "") : ""}`;
}

function ler(usuarioId: string): Vistos {
  try {
    return JSON.parse(localStorage.getItem(prefixo + usuarioId) ?? "{}") as Vistos;
  } catch {
    return {};
  }
}

export function avisoJaVisto(usuarioId: string | undefined, prontuarioId: string, marcador: string): boolean {
  return !!usuarioId && ler(usuarioId)[prontuarioId] === marcador;
}

export function registrarAvisoVisto(usuarioId: string | undefined, prontuarioId: string, marcador: string): void {
  if (!usuarioId) return;
  try {
    localStorage.setItem(prefixo + usuarioId, JSON.stringify({ ...ler(usuarioId), [prontuarioId]: marcador }));
  } catch {
    return;
  }
}