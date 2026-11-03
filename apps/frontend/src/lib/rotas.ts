import type { Perfil } from "@prontuario/shared";

export function rotaInicial(perfil: Perfil | undefined): string {
  return perfil === "professor" ? "/fila" : "/prontuarios";
}
