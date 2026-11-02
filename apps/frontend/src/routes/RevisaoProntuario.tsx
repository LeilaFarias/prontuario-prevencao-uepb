import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import {
  SECOES,
  conclusaoSchema,
  consentimentoSchema,
  cpodSchema,
  dadosPessoaisSchema,
  examesSchema,
  historiaMedicaSchema,
  historiaOdontologicaSchema,
  ihosSchema,
  planoSchema,
  procedimentosSchema,
  sangramentoSchema,
  type SecaoId,
} from "@prontuario/shared";
import BottomSheet from "../components/BottomSheet";
import ConclusaoLeitura from "../components/ficha/revisao/ConclusaoLeitura";
import ConsentimentoLeitura from "../components/ficha/revisao/ConsentimentoLeitura";
import CPODLeitura from "../components/ficha/revisao/CPODLeitura";
import DadosPessoaisLeitura from "../components/ficha/revisao/DadosPessoaisLeitura";
import ExamesLeitura from "../components/ficha/revisao/ExamesLeitura";
import HistoriaMedicaLeitura from "../components/ficha/revisao/HistoriaMedicaLeitura";
import HistoriaOdontologicaLeitura from "../components/ficha/revisao/HistoriaOdontologicaLeitura";
import IHOSLeitura from "../components/ficha/revisao/IHOSLeitura";
import PlanoLeitura from "../components/ficha/revisao/PlanoLeitura";
import ProcedimentosLeitura from "../components/ficha/revisao/ProcedimentosLeitura";
import { formatarDataHoraCompleta, lerSecao } from "../components/ficha/revisao/rotulos";
import SangramentoLeitura from "../components/ficha/revisao/SangramentoLeitura";
import Topbar from "../components/Topbar";
import { useProntuario, type ProntuarioRevisao } from "../hooks/useProntuario";
import { temDivergenciaCPOD } from "../lib/comparacaoCPOD";
import { formatarIdade } from "../lib/idade";

type AcaoPendente = "assinar" | "devolver" | null;

const PILL_STATUS: Record<string, { texto: string; classe: string; icone: typeof Check }> = {
  ASSINADO: { texto: "Já assinado", classe: "bg-primary-tint text-primary", icone: Check },
  DEVOLVIDO: { texto: "Devolvido ao aluno", classe: "bg-alt-tint text-alt", icone: RotateCcw },
};

function ConteudoRevisao({ prontuario }: { prontuario: ProntuarioRevisao }) {
  const navigate = useNavigate();
  const [indice, setIndice] = useState(0);
  const [acao, setAcao] = useState<AcaoPendente>(null);
  const chipAtivo = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    chipAtivo.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [indice]);

  // Seções lidas e normalizadas uma única vez; o professor nunca altera nada disto.
  const secoes = useMemo(() => {
    const bruto = prontuario.secoes;
    return {
      dadosPessoais: lerSecao(dadosPessoaisSchema, bruto["dados-pessoais"]),
      consentimento: lerSecao(consentimentoSchema, bruto["consentimento"]),
      historiaMedica: lerSecao(historiaMedicaSchema, bruto["historia-medica"]),
      historiaOdontologica: lerSecao(historiaOdontologicaSchema, bruto["historia-odontologica"]),
      exames: lerSecao(examesSchema, bruto["exames"]),
      sangramento: lerSecao(sangramentoSchema, bruto["sangramento"]),
      ihos: lerSecao(ihosSchema, bruto["ihos"]),
      cpod: lerSecao(cpodSchema, bruto["cpod-ceod"]),
      plano: lerSecao(planoSchema, bruto["plano-preventivo"]),
      procedimentos: lerSecao(procedimentosSchema, bruto["procedimentos"]),
      conclusao: lerSecao(conclusaoSchema, bruto["conclusao"]),
    };
  }, [prontuario.secoes]);

  const divergenciaCPOD = useMemo(() => temDivergenciaCPOD(secoes.cpod.registros), [secoes.cpod.registros]);

  const secao = SECOES[indice]!;
  const { podeAgir, ehSupervisor } = prontuario;
  const nomePaciente = prontuario.pacienteNome.trim() || secoes.dadosPessoais.nomeCompleto.trim() || "Prontuário";
  const nascimento = prontuario.pacienteDataNascimento ?? secoes.dadosPessoais.dataNascimento;
  const idade = nascimento ? formatarIdade(nascimento) : "";
  const pillStatus = PILL_STATUS[prontuario.status.toUpperCase()];

  function renderSecao(id: SecaoId) {
    switch (id) {
      case "dados-pessoais":
        return <DadosPessoaisLeitura dados={secoes.dadosPessoais} />;
      case "consentimento":
        return <ConsentimentoLeitura dados={secoes.consentimento} paciente={secoes.dadosPessoais} />;
      case "historia-medica":
        return <HistoriaMedicaLeitura dados={secoes.historiaMedica} />;
      case "historia-odontologica":
        return <HistoriaOdontologicaLeitura dados={secoes.historiaOdontologica} />;
      case "exames":
        return <ExamesLeitura dados={secoes.exames} />;
      case "sangramento":
        return <SangramentoLeitura dados={secoes.sangramento} />;
      case "ihos":
        return <IHOSLeitura dados={secoes.ihos} />;
      case "cpod-ceod":
        return <CPODLeitura dados={secoes.cpod} />;
      case "plano-preventivo":
        return <PlanoLeitura dados={secoes.plano} />;
      case "procedimentos":
        return <ProcedimentosLeitura dados={secoes.procedimentos} />;
      case "conclusao":
        return <ConclusaoLeitura dados={secoes.conclusao} />;
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo={nomePaciente}
        subtitulo={secao.titulo}
        tituloClassName="text-[18px]"
        onVoltar={() => navigate("/fila")}
      />

      <nav aria-label="Seções" className="flex gap-2 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none]">
        {SECOES.map((s, i) => {
          const ativo = i === indice;
          const alerta = s.id === "cpod-ceod" && divergenciaCPOD;
          return (
            <button
              key={s.id}
              ref={ativo ? chipAtivo : undefined}
              type="button"
              onClick={() => setIndice(i)}
              aria-current={ativo}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition ${
                ativo ? "border-prof bg-prof text-white" : "border-line bg-raised text-ink-soft"
              }`}
            >
              {s.titulo}
              {alerta && (
                <span
                  role="img"
                  aria-label="Divergência detectada"
                  className={`h-2 w-2 rounded-full ${ativo ? "bg-white" : "bg-alt"}`}
                />
              )}
            </button>
          );
        })}
      </nav>

      <main className="flex flex-1 flex-col gap-3 px-5 pb-4 pt-2">
        <section aria-label="Resumo do envio" className="rounded-card border border-line bg-raised p-4">
          <div className="flex flex-col gap-1.5 text-[13px]">
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">Paciente:</span> {nomePaciente}
              {idade && ` · ${idade}`}
            </p>
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">Enviado por:</span> {prontuario.alunoNome || "—"}
            </p>
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">Em:</span> {formatarDataHoraCompleta(prontuario.enviadoEm) || "—"}
            </p>
          </div>
          {pillStatus && (
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold ${pillStatus.classe}`}
            >
              <pillStatus.icone size={12} aria-hidden="true" />
              {pillStatus.texto}
            </span>
          )}
        </section>

        {!ehSupervisor && (
          <div role="note" className="banner-erro flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Você pode consultar, mas apenas o professor supervisor pode assinar ou devolver.</span>
          </div>
        )}

        {renderSecao(secao.id)}
      </main>

      <footer className="sticky bottom-0 mt-2 border-t border-line bg-paper px-5 py-3">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost" disabled={!podeAgir} onClick={() => setAcao("devolver")}>
            Devolver
          </button>
          <button type="button" className="btn-prof" disabled={!podeAgir} onClick={() => setAcao("assinar")}>
            Assinar prontuário
          </button>
        </div>
      </footer>

      {/* Placeholder: os modais completos de assinatura e devolução ficam para a próxima etapa. */}
      <BottomSheet
        open={acao !== null}
        onClose={() => setAcao(null)}
        title={acao === "assinar" ? "Assinar prontuário" : "Devolver ao aluno"}
        subtitle={nomePaciente}
      >
        <p className="text-[14px] text-ink-soft">Em breve.</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => setAcao(null)}>
          Fechar
        </button>
      </BottomSheet>
    </div>
  );
}

export default function RevisaoProntuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const estado = useProntuario(id);

  if (estado.situacao === "carregando") {
    return (
      <div className="flex flex-1 flex-col">
        <Topbar titulo="Carregando…" tituloClassName="text-[18px]" onVoltar={() => navigate("/fila")} />
      </div>
    );
  }

  if (estado.situacao === "erro") {
    const semAcesso = estado.status === 403 || estado.status === 404;
    return (
      <div className="flex flex-1 flex-col">
        <Topbar titulo="Prontuário" tituloClassName="text-[18px]" onVoltar={() => navigate("/fila")} />
        <div className="flex flex-col gap-3 px-5 pt-2">
          <p role="alert" className="banner-erro">
            {semAcesso ? estado.mensagem : `${estado.mensagem} A revisão precisa de conexão com o servidor.`}
          </p>
          {!semAcesso && (
            <button type="button" className="btn-ghost" onClick={estado.recarregar}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // key: ao trocar de prontuário, a aba e o plano do professor recomeçam do zero.
  return <ConteudoRevisao key={estado.prontuario.id} prontuario={estado.prontuario} />;
}
