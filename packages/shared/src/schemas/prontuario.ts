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

export const historiaOdontologicaSchema = z.object({
  primeiraConsulta: z.boolean().nullable().default(null),
  tempoUltimaConsulta: z.enum(["menos-6", "mais-6"]).nullable().default(null),
  queixaPrincipal: z.string().default(""),
  dorDente: z.boolean().nullable().default(null),
  motivoUEPB: z.string().default(""),
  comportamentoAnterior: z.enum(["cooperou", "nao-cooperou"]).nullable().default(null),

  acoesPreventivasRecebidas: z.boolean().nullable().default(null),
  quaisAcoesPreventivas: z.array(z.string()).default([]),

  escovaDiariamente: z.boolean().nullable().default(null),
  frequenciaEscovacao: z.enum(["1x", "2x", "3x", "4x"]).nullable().default(null),
  recursosUtilizados: z.array(z.string()).default([]),

  habitosParafuncionais: z.array(z.string()).default([]),
  frequenciaHabitos: z.string().default(""),

  dietaManha: z.string().default(""),
  dietaTarde: z.string().default(""),
  dietaNoite: z.string().default(""),
});

export type HistoriaOdontologica = z.infer<typeof historiaOdontologicaSchema>;

export const vazioHistoriaOdontologica = (): HistoriaOdontologica => historiaOdontologicaSchema.parse({});

export const procedimentoItemSchema = z.object({
  id: z.string(),
  data: z.string().default(""),
  descricao: z.string().default(""),
});

export type ProcedimentoItem = z.infer<typeof procedimentoItemSchema>;

export const procedimentosSchema = z.object({
  itens: z.array(procedimentoItemSchema).default([]),
});

export type Procedimentos = z.infer<typeof procedimentosSchema>;

export const vazioProcedimentos = (): Procedimentos => procedimentosSchema.parse({});

export const fotoAnexoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  dataUrl: z.string(),
  adicionadaEm: z.string(),
});

export type FotoAnexo = z.infer<typeof fotoAnexoSchema>;

export const conclusaoSchema = z.object({
  tipoDesfecho: z.enum(["concluido", "encaminhado"]).nullable().default(null),
  concluidoEm: z.string().default(""),
  encaminhamentoEm: z.string().default(""),
  encaminhamentoPara: z.string().default(""),
  fotos: z.array(fotoAnexoSchema).default([]),
});

export type Conclusao = z.infer<typeof conclusaoSchema>;

export const vazioConclusao = (): Conclusao => conclusaoSchema.parse({});

export const sessaoPlanoSchema = z.object({
  numero: z.number(),
  descricao: z.string().default(""),
});

export type SessaoPlano = z.infer<typeof sessaoPlanoSchema>;

export const planoSchema = z.object({
  sessoes: z.array(sessaoPlanoSchema).default([
    { numero: 1, descricao: "" },
    { numero: 2, descricao: "" },
    { numero: 3, descricao: "" },
  ]),
});

export type Plano = z.infer<typeof planoSchema>;

export const vazioPlano = (): Plano => planoSchema.parse({});
