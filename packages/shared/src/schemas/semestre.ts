import { z } from "zod";

const dataISO = z
  .string({ required_error: "Informe a data" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Data inválida");

export const semestreSchema = z
  .object({ inicio: dataISO, fim: dataISO })
  .refine((d) => d.inicio < d.fim, { path: ["fim"], message: "A data final deve ser posterior à data inicial" });

export type SemestreInput = z.infer<typeof semestreSchema>;

export interface SemestreResponse {
  inicio: string | null;
  fim: string | null;
}

export interface IndicadorPacientes {
  total: number;
  periodo: { inicio: string; fim: string } | null;
}
