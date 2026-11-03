import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, WifiOff } from "lucide-react";
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
import AssinarModal from "../components/revisao/AssinarModal";
import DevolverModal from "../components/revisao/DevolverModal";
import StatusBanner from "../components/revisao/StatusBanner";
import Topbar from "../components/Topbar";
import { useProntuario, type ProntuarioRevisao } from "../hooks/useProntuario";
import { temDivergenciaCPOD } from "../lib/comparacaoCPOD";
import { formatarIdade } from "../lib/idade";
import { getSession } from "../lib/session";

interface ConteudoProps {
  prontuario: ProntuarioRevisao;
  onAtualizar: () => Promise<void>;
}

function ConteudoRevisao({ prontuario, onAtualizar }: ConteudoProps) {
  const navigate = useNavigate();
  const [indice, setIndice] = useState(0);
  const [modalAssinar, setModalAssinar] = useState(false);
  const [modalDevolver, setModalDevolver] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const chipAtivo = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const aoFicarOnline = () => setOffline(false);
    const aoFicarOffline = () => setOffline(true);
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    return () => {
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, []);

  useEffect(() => {
    chipAtivo.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [indice]);

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
  const aguardando = prontuario.status.toUpperCase() === "ENVIADO";
  const bloqueado = !podeAgir || offline;
  const nomeProfessor = getSession()?.user.nome ?? "";
  const procedimentosPendentes = secoes.procedimentos.itens.length;
  const voltarParaFila = () => navigate("/fila");

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
        onVoltar={voltarParaFila}
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
        <StatusBanner prontuario={prontuario} />

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
        </section>

        {aguardando && !ehSupervisor && (
          <div role="note" className="banner-erro flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Apenas o professor supervisor pode agir sobre este prontuário.</span>
          </div>
        )}

        {renderSecao(secao.id)}
      </main>

      <footer className="sticky bottom-0 mt-2 border-t border-line bg-paper px-5 py-3">
        {aguardando ? (
          <>
            {offline && podeAgir && (
              <p role="status" className="mb-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
                <WifiOff size={13} aria-hidden="true" />
                Sem conexão — conecte-se para assinar ou devolver
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-ghost"
                disabled={bloqueado}
                title={offline ? "Sem conexão — conecte-se para devolver" : undefined}
                onClick={() => setModalDevolver(true)}
              >
                Devolver
              </button>
              <button
                type="button"
                className="btn-prof"
                disabled={bloqueado}
                title={offline ? "Sem conexão — conecte-se para assinar" : undefined}
                onClick={() => setModalAssinar(true)}
              >
                Assinar prontuário
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn-ghost" onClick={voltarParaFila}>
            Voltar para a fila
          </button>
        )}
      </footer>

      <AssinarModal
        open={modalAssinar}
        onClose={() => setModalAssinar(false)}
        prontuarioId={prontuario.id}
        pacienteNome={nomePaciente}
        professorNome={nomeProfessor}
        procedimentosPendentes={procedimentosPendentes}
        onSucesso={() => void onAtualizar()}
        onVoltarParaFila={voltarParaFila}
      />
      <DevolverModal
        open={modalDevolver}
        onClose={() => setModalDevolver(false)}
        prontuarioId={prontuario.id}
        pacienteNome={nomePaciente}
        alunoNome={prontuario.alunoNome || "—"}
        onSucesso={() => void onAtualizar()}
        onVoltarParaFila={voltarParaFila}
      />
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

  return <ConteudoRevisao key={estado.prontuario.id} prontuario={estado.prontuario} onAtualizar={estado.atualizar} />;
}
