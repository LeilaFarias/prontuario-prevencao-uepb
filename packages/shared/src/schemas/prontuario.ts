import { z } from "zod";
import { SECAO_IDS } from "../types";

export const pacienteSchema = z.object({
  pacienteNome: z.string().trim().min(2, "Informe o nome do paciente"),
  pacienteDataNascimento: z.string().optional(),
});

export const criarProntuarioSchema = pacienteSchema.extend({
  id: z.string().min(1),
});

export const salvarSecaoSchema = z.object({
  prontuarioId: z.string().min(1),
  secaoId: z.enum(SECAO_IDS),
  conteudo: z.record(z.string(), z.unknown()),
});

export type CriarProntuarioInput = z.infer<typeof criarProntuarioSchema>;
export type SalvarSecaoInput = z.infer<typeof salvarSecaoSchema>;
