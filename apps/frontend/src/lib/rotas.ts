import type { Perfil } from "@prontuario/shared";

/** Tela inicial de cada perfil: aluno vê seus prontuários; professor vê a fila de revisão. */
export function rotaInicial(perfil: Perfil | undefined): string {
  return perfil === "professor" ? "/fila" : "/prontuarios";
}
