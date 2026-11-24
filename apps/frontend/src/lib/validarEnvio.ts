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
import { DENTES_IHOS } from "./ihos";

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

const normalizarTexto = (v: string): string =>
  v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const preenchido = (v: unknown): boolean => typeof v === "string" && normalizarTexto(v) !== "";

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
    if (!preenchido(v.semestreLetivo)) faltas.push("semestre letivo");
    if (!preenchido(v.professorSupervisor)) faltas.push("professor supervisor");
    if (!preenchido(v.alunoOperador)) faltas.push("aluno operador");
    if (v.termoAceito !== true) faltas.push("aceite do termo");
    if (!preenchido(v.dataAssinatura)) faltas.push("data da assinatura");
    if (v.assinaturaAnexada !== true) faltas.push("assinatura anexada");
    return falta(faltas);
  },

  "dados-pessoais": (c) => {
    const v = ler<DadosPessoais>(c);
    const faltas: string[] = [];
    if (!preenchido(v.nomeCompleto)) faltas.push("nome completo");
    if (!preenchido(v.dataNascimento)) faltas.push("data de nascimento");
    if (v.sexo !== "feminino" && v.sexo !== "masculino") faltas.push("sexo");
    if (v.estudante == null) faltas.push("se é estudante");
    if (v.estudante === true) {
      if (!preenchido(v.escola)) faltas.push("escola");
      if (!preenchido(v.serie)) faltas.push("série");
    }
    if (!preenchido(v.responsavelNome)) faltas.push("nome do responsável legal");
    if (!preenchido(v.responsavelParentesco)) faltas.push("parentesco do responsável legal");
    if (!preenchido(v.telefone)) faltas.push("telefone do responsável legal");
    if (!preenchido(v.responsavelOcupacao)) faltas.push("ocupação do responsável legal");
    if (!preenchido(v.responsavelEscolaridade)) faltas.push("escolaridade do responsável legal");
    if (!preenchido(v.paiNome)) faltas.push("nome do pai");
    if (!preenchido(v.paiOcupacao)) faltas.push("ocupação do pai");
    if (!preenchido(v.paiEscolaridade)) faltas.push("escolaridade do pai");
    if (!preenchido(v.maeNome)) faltas.push("nome da mãe");
    if (!preenchido(v.maeOcupacao)) faltas.push("ocupação da mãe");
    if (!preenchido(v.maeEscolaridade)) faltas.push("escolaridade da mãe");
    return falta(faltas);
  },

  "historia-medica": (c) => {
    const v = ler<HistoriaMedica>(c);
    const faltas: string[] = [];
    if (v.temDoenca == null) faltas.push("se tem doença");
    else if (v.temDoenca && !preenchido(v.qualDoenca)) faltas.push("qual doença");
    if (v.emTratamento == null) faltas.push("se está em tratamento");
    else if (v.emTratamento && !preenchido(v.qualTratamento)) faltas.push("qual tratamento");
    if (v.usaMedicamento == null) faltas.push("se usa medicamento");
    else if (v.usaMedicamento) {
      if (!preenchido(v.qualMedicamento)) faltas.push("qual medicamento");
      if (!preenchido(v.tempoMedicamento)) faltas.push("tempo de uso do medicamento");
    }
    return faltas.length > 0 ? `Responda ou detalhe: ${faltas.join(", ")}` : null;
  },

  "historia-odontologica": (c) => {
    const v = ler<HistoriaOdontologica>(c);
    const faltas: string[] = [];
    if (v.primeiraConsulta == null) faltas.push("primeira consulta");
    if (v.primeiraConsulta === false) {
      if (!preenchido(v.tempoUltimaConsulta)) faltas.push("tempo da última consulta");
      if (!preenchido(v.comportamentoAnterior)) faltas.push("comportamento no atendimento anterior");
    }
    if (!preenchido(v.queixaPrincipal)) faltas.push("queixa principal");
    if (v.dorDente == null) faltas.push("presença de dor de dente");
    if (!preenchido(v.motivoUEPB)) faltas.push("motivo da procura pela clínica");
    if (v.acoesPreventivasRecebidas == null) faltas.push("se já recebeu ações preventivas");
    if (v.acoesPreventivasRecebidas === true && !(v.quaisAcoesPreventivas?.length)) {
      faltas.push("quais ações preventivas recebeu");
    }
    if (v.escovaDiariamente == null) faltas.push("se escova os dentes diariamente");
    if (v.escovaDiariamente === true) {
      if (!preenchido(v.frequenciaEscovacao)) faltas.push("frequência de escovação");
      if (!(v.recursosUtilizados?.length)) faltas.push("recursos utilizados na higiene bucal");
    }
    if ((v.habitosParafuncionais?.length ?? 0) > 0 && !preenchido(v.frequenciaHabitos)) {
      faltas.push("frequência dos hábitos parafuncionais");
    }
    return falta(faltas);
  },

  exames: (c) => {
    const exame = ler<Exames>(c);
    const extra = exame.extraOral ?? {};
    const intra = exame.intraOral ?? {};
    const faltas: string[] = [];

      if (!preenchido((extra as { locomocao?: string }).locomocao)) faltas.push("locomoção");
      if (!preenchido((extra as { cicatrizesEdemas?: string }).cicatrizesEdemas)) faltas.push("cicatrizes, edemas, assimetrias e tumefações");
      if ((extra as { aberturaAnormal?: boolean | null }).aberturaAnormal == null) faltas.push("abertura anormal da boca");
      if ((extra as { aberturaAnormal?: boolean | null }).aberturaAnormal === true &&
          !preenchido((extra as { aberturaObservacao?: string }).aberturaObservacao)) {
        faltas.push("observações da abertura anormal");
      }

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
      if (semAvaliacao.length > 0) faltas.push(`exame intra oral: ${semAvaliacao.join(", ")}`);
      const semObservacao = estruturas
        .filter(([chave]) => (intra as Record<string, unknown>)[chave] === "alteracao")
        .filter(([chave]) => !preenchido(((intra as { observacoes?: Record<string, string> }).observacoes ?? {})[chave]))
        .map(([, nome]) => nome);
      if (semObservacao.length > 0) faltas.push(`observações das alterações: ${semObservacao.join(", ")}`);

    return falta(faltas);
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
      DENTES_IHOS.filter(({ chave }) => {
        if (r.ausentes?.[chave] === true) return true;
        const nota = r.dentes?.[chave];
        return nota !== null && nota !== undefined;
      }).length;
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

  if (
    v.tipoDesfecho !== "concluido" &&
    v.tipoDesfecho !== "encaminhado"
  ) {
    return "Falta: desfecho";
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

export function validarEnvio(prontuario: Pick<LocalProntuario, "secoes"> & Partial<Pick<LocalProntuario, "status">>): ResultadoValidacao {
  const conclusao = ler<Conclusao>(prontuario.secoes.conclusao);
  if (prontuario.status === "assinado" || (prontuario.status === "enviado" && (conclusao.tipoDesfecho === "concluido" || conclusao.tipoDesfecho === "encaminhado"))) {
    return { ok: true, pendencias: [] };
  }
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