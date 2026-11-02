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
  /** UUID da sessão. Fica com default "" só para ler dados antigos (sem id); o formulário gera o id ao carregar. */
  id: z.string().default(""),
  numero: z.number(),
  descricao: z.string().default(""),
});

export type SessaoPlano = z.infer<typeof sessaoPlanoSchema>;

// Sem UUID no default do schema (ele roda em todo parse). Os 3 slots iniciais nascem em vazioPlano().
export const planoSchema = z.object({
  sessoes: z.array(sessaoPlanoSchema).default([]),
});

export type Plano = z.infer<typeof planoSchema>;

/** `crypto` não existe nos tipos deste pacote (lib ES2022 sem DOM), por isso o acesso via globalThis. */
const gerarIdPadrao = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const vazioPlano = (gerarId: () => string = gerarIdPadrao): Plano => ({
  sessoes: [
    { id: gerarId(), numero: 1, descricao: "" },
    { id: gerarId(), numero: 2, descricao: "" },
    { id: gerarId(), numero: 3, descricao: "" },
  ],
});

export const denteSangramentoSchema = z.object({
  presente: z.boolean().default(false),
  faces: z
    .object({
      V: z.number().int().min(0).max(1).default(0),
      P: z.number().int().min(0).max(1).default(0),
      L: z.number().int().min(0).max(1).default(0),
    })
    .default({}),
});

export type DenteSangramento = z.infer<typeof denteSangramentoSchema>;

export const sangramentoDentesSchema = z.record(z.string(), denteSangramentoSchema);

export const registroSangramentoSchema = z.object({
  id: z.string(),
  data: z.string().default(""),
  dentes: sangramentoDentesSchema.default({}),
});

export type RegistroSangramentoDados = z.infer<typeof registroSangramentoSchema>;

export const sangramentoSchema = z.object({
  registros: z.array(registroSangramentoSchema).default([]),
});

export type Sangramento = z.infer<typeof sangramentoSchema>;

export const vazioSangramento = (): Sangramento => sangramentoSchema.parse({});

const notaIHOS = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]).default(null);

export const registroIHOSSchema = z.object({
  id: z.string(),
  data: z.string().default(""),
  dentes: z
    .object({
      V11: notaIHOS,
      V16: notaIHOS,
      V26: notaIHOS,
      V31: notaIHOS,
      L36: notaIHOS,
      L46: notaIHOS,
    })
    .default({}),
});

export type RegistroIHOSDados = z.infer<typeof registroIHOSSchema>;

export const ihosSchema = z.object({
  registros: z.array(registroIHOSSchema).default([]),
});

export type IHOS = z.infer<typeof ihosSchema>;

export const vazioIHOS = (): IHOS => ihosSchema.parse({});

const calculoManualCPODSchema = z.object({
  C: z.string().default(""),
  P: z.string().default(""),
  O: z.string().default(""),
  total: z.string().default(""),
});

const calculoManualCEODSchema = z.object({
  c: z.string().default(""),
  e: z.string().default(""),
  o: z.string().default(""),
  total: z.string().default(""),
});

export const registroCPODSchema = z.object({
  id: z.string(),
  data: z.string().default(""),
  dentes: z.record(z.string(), z.string()).default({}),
  cpodManual: calculoManualCPODSchema.default({}),
  ceodManual: calculoManualCEODSchema.default({}),
});

export type RegistroCPODDados = z.infer<typeof registroCPODSchema>;

export const cpodSchema = z.object({
  registros: z.array(registroCPODSchema).default([]),
});

export type CPOD = z.infer<typeof cpodSchema>;

export const vazioCPOD = (): CPOD => cpodSchema.parse({});
