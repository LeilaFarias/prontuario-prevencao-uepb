import {
  SECOES,
  type Conclusao,
  type Consentimento,
  type DadosPessoais,
  type Exames,
  type HistoriaMedica,
  type HistoriaOdontologica,
  type IHOS,
  type CPOD,
  type Plano,
  type Procedimentos,
  type SecaoId,
  type Sangramento,
} from "@prontuario/shared";
import type { LocalProntuario } from "../db/dexie";

export interface Pendencia {
  secaoId: SecaoId;
  secao: string;
  mensagem: string;
  primeiraSecao: SecaoId;
}

export interface ResultadoValidacao {
  ok: boolean;
  pendencias: Pendencia[];
}

const preenchido = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";

function ler<T>(bruto: unknown): Partial<T> {
  return bruto !== null && typeof bruto === "object" ? (bruto as Partial<T>) : {};
}

function lista<T>(v: unknown): Partial<T>[] {
  return Array.isArray(v) ? v.map((x) => ler<T>(x)) : [];
}

const falta = (itens: string[]): string | null => (itens.length > 0 ? `Falta: ${itens.join(", ")}` : null);

type Verificador = (conteudo: unknown) => string | null;

const VERIFICADORES: Partial<Record<SecaoId, Verificador>> = {
  consentimento: (c) => {
    const v = ler<Consentimento>(c);
    const faltas: string[] = [];
    if (v.termoAceito !== true) faltas.push("aceite do termo");
    if (!preenchido(v.dataAssinatura)) faltas.push("data da assinatura");
    if (v.assinaturaAnexada !== true) faltas.push("assinatura anexada");
    if (!preenchido(v.professorSupervisor)) faltas.push("professor supervisor");
    return falta(faltas);
  },

  "dados-pessoais": (c) => {
    const v = ler<DadosPessoais>(c);
    const faltas: string[] = [];
    if (!preenchido(v.nomeCompleto)) faltas.push("nome completo");
    if (!preenchido(v.dataNascimento)) faltas.push("data de nascimento");
    return falta(faltas);
  },

  "historia-medica": (c) => {
    const v = ler<HistoriaMedica>(c);
    const faltas: string[] = [];
    if (v.temDoenca == null) faltas.push("se tem doença");
    if (v.emTratamento == null) faltas.push("se está em tratamento");
    if (v.usaMedicamento == null) faltas.push("se usa medicamento");
    return faltas.length > 0 ? `Responda Sim ou Não: ${faltas.join(", ")}` : null;
  },

  "historia-odontologica": (c) => {
    const v = ler<HistoriaOdontologica>(c);
    const faltas: string[] = [];
    if (v.primeiraConsulta == null) faltas.push("primeira consulta");
    if (v.escovaDiariamente == null) faltas.push("escova diariamente");
    return faltas.length > 0 ? `Responda Sim ou Não: ${faltas.join(", ")}` : null;
  },

  exames: (c) => {
    const intra = ler<Exames>(c).intraOral ?? {};
    const estruturas = [
      ["labios", "lábios"],
      ["freioLabial", "freio labial"],
      ["gengiva", "gengiva"],
      ["mucosa", "mucosa"],
      ["palato", "palato"],
      ["lingua", "língua"],
      ["freioLingual", "freio lingual"],
      ["assoalho", "assoalho"],
    ] as const;
    const semAvaliacao = estruturas
      .filter(([chave]) => (intra as Record<string, unknown>)[chave] !== "normal" && (intra as Record<string, unknown>)[chave] !== "alteracao")
      .map(([, nome]) => nome);
    return semAvaliacao.length > 0 ? `Exame intra oral sem avaliação: ${semAvaliacao.join(", ")}` : null;
  },

  sangramento: (c) => {
    const registros = lista<Sangramento["registros"][number]>(ler<Sangramento>(c).registros);
    if (registros.length === 0) return "Nenhum registro de sangramento";
    if (!registros.some((r) => preenchido(r.data))) return "Registro de sangramento sem data";
    return null;
  },

  ihos: (c) => {
    const registros = lista<IHOS["registros"][number]>(ler<IHOS>(c).registros);
    if (registros.length === 0) return "Nenhum registro de IHOS";
    const avaliados = (r: Partial<IHOS["registros"][number]>): number =>
      Object.values(r.dentes ?? {}).filter((nota) => nota !== null && nota !== undefined).length;
    const melhor = Math.max(...registros.map(avaliados));
    if (melhor >= 6) return null;
    return `Registro de IHOS incompleto: ${melhor} de 6 dentes avaliados`;
  },

  "cpod-ceod": (c) => {
    const registros = lista<CPOD["registros"][number]>(ler<CPOD>(c).registros);
    if (registros.length === 0) return "Nenhum registro de CPO-D/ceo-d";

    const faltasDe = (r: Partial<CPOD["registros"][number]>): string[] => {
      const faltas: string[] = [];
      if (!preenchido(r.data)) faltas.push("data");
      if (!Object.values(r.dentes ?? {}).some((codigo) => preenchido(codigo))) faltas.push("código em ao menos 1 dente");
      const cpod = ler<{ C: string; P: string; O: string; total: string }>(r.cpodManual);
      if (![cpod.C, cpod.P, cpod.O, cpod.total].every(preenchido)) faltas.push("cálculo manual do CPO-D (C, P, O e total)");
      const ceod = ler<{ c: string; e: string; o: string; total: string }>(r.ceodManual);
      if (![ceod.c, ceod.e, ceod.o, ceod.total].every(preenchido)) faltas.push("cálculo manual do ceo-d (c, e, o e total)");
      return faltas;
    };

    const porRegistro = registros.map(faltasDe);
    if (porRegistro.some((f) => f.length === 0)) return null;
    const maisProximo = porRegistro.reduce((a, b) => (b.length < a.length ? b : a));
    return falta(maisProximo);
  },

  "plano-preventivo": (c) => {
    const sessoes = lista<Plano["sessoes"][number]>(ler<Plano>(c).sessoes);
    return preenchido(sessoes[0]?.descricao) ? null : "Falta: descrição da 1ª sessão";
  },

  procedimentos: (c) => {
    const itens = lista<Procedimentos["itens"][number]>(ler<Procedimentos>(c).itens);
    if (itens.length === 0) return "Nenhum procedimento registrado";
    if (!itens.some((i) => preenchido(i.data) && preenchido(i.descricao))) return "Procedimento sem data ou descrição";
    return null;
  },

  conclusao: (c) => {
    const v = ler<Conclusao>(c);
    if (v.tipoDesfecho !== "concluido" && v.tipoDesfecho !== "encaminhado") {
      return "Falta: desfecho (concluído ou encaminhado)";
    }
    const faltas: string[] = [];
    if (v.tipoDesfecho === "concluido") {
      if (!preenchido(v.concluidoEm)) faltas.push("data de conclusão");
    } else {
      if (!preenchido(v.encaminhamentoEm)) faltas.push("data do encaminhamento");
      if (!preenchido(v.encaminhamentoPara)) faltas.push("destino do encaminhamento");
    }
    return falta(faltas);
  },
};

export function validarEnvio(prontuario: Pick<LocalProntuario, "secoes">): ResultadoValidacao {
  const pendentes: Array<{ secaoId: SecaoId; secao: string; mensagem: string }> = [];

  SECOES.forEach((s, i) => {
    const verificar = VERIFICADORES[s.id];
    if (!verificar) return;
    const mensagem = verificar(prontuario.secoes[s.id]);
    if (mensagem) pendentes.push({ secaoId: s.id, secao: `${i + 1}. ${s.titulo}`, mensagem });
  });

  const primeira = pendentes[0]?.secaoId;
  return {
    ok: pendentes.length === 0,
    pendencias: primeira ? pendentes.map((p) => ({ ...p, primeiraSecao: primeira })) : [],
  };
}
