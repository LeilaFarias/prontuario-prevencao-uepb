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

export const dadosPessoaisSchema = z.object({
  nomeCompleto: z.string().default(""),
  dataNascimento: z.string().default(""),
  idade: z.string().default(""), 
  sexo: z.enum(["feminino", "masculino"]).nullable().default(null),
  cor: z.string().nullable().default(null),

  cep: z.string().default(""), 
  endereco: z.string().default(""),
  cidade: z.string().default(""),
  uf: z.string().max(2).default(""),
  naturalidade: z.string().default(""),

  estudante: z.boolean().nullable().default(null),
  escola: z.string().default(""),
  serie: z.string().default(""),

  responsavelNome: z.string().default(""),
  responsavelParentesco: z.string().default(""),
  responsavelOcupacao: z.string().default(""),
  responsavelEscolaridade: z.string().default(""),

  paiNome: z.string().default(""),
  paiOcupacao: z.string().default(""),
  paiEscolaridade: z.string().default(""),

  maeNome: z.string().default(""),
  maeOcupacao: z.string().default(""),
  maeEscolaridade: z.string().default(""),
});

export type DadosPessoais = z.infer<typeof dadosPessoaisSchema>;

export function vazioDadosPessoais(): DadosPessoais {
  return dadosPessoaisSchema.parse({});
}
