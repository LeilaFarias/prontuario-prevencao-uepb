import { createContext } from "react";
import type { SecaoId } from "@prontuario/shared";
import type { LocalProntuario } from "../db/dexie";

export interface EdicaoProfessor {
  prontuario: LocalProntuario;
  salvarSecao: (secaoId: SecaoId, conteudo: Record<string, unknown>) => Promise<void>;
}

export const EdicaoProfessorContext = createContext<EdicaoProfessor | null>(null);
