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
  telefone: z.string().default(""),
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

export const consentimentoSchema = z.object({
  semestreLetivo: z.string().default(""),
  professorSupervisor: z.string().default(""),
  alunoOperador: z.string().default(""),
  alunoAuxiliar: z.string().default(""),

  termoAceito: z.boolean().default(false),
  dataAssinatura: z.string().default(""),

  assinaturaAnexada: z.boolean().default(false),
  assinaturaFoto: z.string().nullable().default(null),
  assinaturaAnexadaEm: z.string().nullable().default(null),
});

export type Consentimento = z.infer<typeof consentimentoSchema>;

export const vazioConsentimento = (): Consentimento => consentimentoSchema.parse({});

export const historiaMedicaSchema = z.object({
  temDoenca: z.boolean().nullable().default(null),
  qualDoenca: z.string().default(""),

  emTratamento: z.boolean().nullable().default(null),
  qualTratamento: z.string().default(""),

  usaMedicamento: z.boolean().nullable().default(null),
  qualMedicamento: z.string().default(""),
  tempoMedicamento: z.string().default(""),

  antecedentesFamiliares: z.string().default(""),
});

export type HistoriaMedica = z.infer<typeof historiaMedicaSchema>;

export const vazioHistoriaMedica = (): HistoriaMedica => historiaMedicaSchema.parse({});

const estruturaExameSchema = z.enum(["normal", "alteracao"]).nullable().default(null);

export const examesSchema = z.object({
  extraOral: z
    .object({
      locomocao: z.string().default(""),
      cicatrizesEdemas: z.string().default(""),
      aberturaAnormal: z.boolean().nullable().default(null),
      aberturaObservacao: z.string().default(""),
    })
    .default({}),

  intraOral: z
    .object({
      labios: estruturaExameSchema,
      freioLabial: estruturaExameSchema,
      gengiva: estruturaExameSchema,
      mucosa: estruturaExameSchema,
      palato: estruturaExameSchema,
      lingua: estruturaExameSchema,
      freioLingual: estruturaExameSchema,
      assoalho: estruturaExameSchema,
      observacoes: z
        .object({
          labios: z.string().default(""),
          freioLabial: z.string().default(""),
          gengiva: z.string().default(""),
          mucosa: z.string().default(""),
          palato: z.string().default(""),
          lingua: z.string().default(""),
          freioLingual: z.string().default(""),
          assoalho: z.string().default(""),
        })
        .default({}),
      outrasAlteracoes: z.string().default(""),
    })
    .default({}),
});

export type Exames = z.infer<typeof examesSchema>;

export const vazioExames = (): Exames => examesSchema.parse({});
