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
import ConclusaoForm from "../components/ficha/Conclusao";
import ConsentimentoForm from "../components/ficha/Consentimento";
import CPODForm from "../components/ficha/CPOD";
import DadosPessoaisForm from "../components/ficha/DadosPessoais";
import ExamesForm from "../components/ficha/Exames";
import HistoriaMedicaForm from "../components/ficha/HistoriaMedica";
import HistoriaOdontologicaForm from "../components/ficha/HistoriaOdontologica";
import IHOSForm from "../components/ficha/IHOS";
import PlanoForm from "../components/ficha/Plano";
import ProcedimentosForm from "../components/ficha/Procedimentos";
import SangramentoForm from "../components/ficha/Sangramento";
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
import { api, ApiError } from "../lib/api";
import Skeleton from "../components/Skeleton";
import Topbar from "../components/Topbar";
import { useEdicaoSecoesProfessor } from "../hooks/useEdicaoSecoesProfessor";
import { useProntuario, type ProntuarioRevisao } from "../hooks/useProntuario";
import { salvarSecoesPendentes } from "../hooks/useSecao";
import { EdicaoProfessorContext, type EdicaoProfessor } from "../lib/edicaoProfessor";
import { temDivergenciaCPOD } from "../lib/comparacaoCPOD";
import { formatarIdade } from "../lib/idade";
import { validarEnvio } from "../lib/validarEnvio";
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
  const [editando, setEditando] = useState(false);
  const chipAtivo = useRef<HTMLButtonElement | null>(null);

  const edicao = useEdicaoSecoesProfessor({
    prontuarioId: prontuario.id,
    secoesRemotas: prontuario.secoes,
    aoDescartar: async () => {
      setEditando(false);
      await onAtualizar();
    },
  });

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
    const bruto = edicao.secoes as Record<string, unknown>;
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
  }, [edicao.secoes]);

  const pendenciasFicha = useMemo(() => validarEnvio({ secoes: edicao.secoes as Record<string, any> }).pendencias, [edicao.secoes]);

  const divergenciaCPOD = useMemo(() => temDivergenciaCPOD(secoes.cpod.registros), [secoes.cpod.registros]);

  const secao = SECOES[indice]!;
  const { podeAgir, ehSupervisor } = prontuario;
  const nomePaciente = prontuario.pacienteNome.trim() || secoes.dadosPessoais.nomeCompleto.trim() || "Prontuário";
  const nascimento = prontuario.pacienteDataNascimento ?? secoes.dadosPessoais.dataNascimento;
  const idade = nascimento ? formatarIdade(nascimento) : "";
  const aguardando = prontuario.status.toUpperCase() === "ENVIADO";
  const bloqueado = !podeAgir || offline || editando || edicao.pendentes > 0;
  const nomeProfessor = getSession()?.user.nome ?? "";
  const procedimentosPendentes = secoes.procedimentos.itens.length;
  const podeEditar = aguardando && ehSupervisor;
  const salvandoAlteracoes = edicao.pendentes > 0;

  const valorEdicao = useMemo<EdicaoProfessor>(
    () => ({
      prontuario: {
        id: prontuario.id,
        pacienteNome: prontuario.pacienteNome,
        pacienteDataNascimento: prontuario.pacienteDataNascimento ?? undefined,
        status: "enviado" as const,
        secoes: edicao.secoes as Record<string, any>,
        criadoEm: 0,
        atualizadoEm: 0,
        sincronizado: true,
        alunoTitularId: prontuario.alunoTitularId,
        professorSupervisorId: prontuario.professorSupervisorId ?? undefined,
      },
      salvarSecao: edicao.salvarSecao,
    }),
    [prontuario.id, prontuario.pacienteNome, prontuario.pacienteDataNascimento, prontuario.alunoTitularId, prontuario.professorSupervisorId, edicao.secoes, edicao.salvarSecao],
  );

  async function voltarParaFila() {
    await salvarSecoesPendentes();
    if (
      edicao.temPendentes() &&
      !window.confirm("Há alterações ainda não salvas. Se sair agora, elas serão perdidas. Sair mesmo assim?")
    ) {
      return;
    }
    navigate("/fila");
  }

  async function concluirEdicao() {
    await salvarSecoesPendentes();
    setEditando(false);
  }


  function renderEditavel(id: SecaoId) {
    const prontuarioId = prontuario.id;
    switch (id) {
      case "dados-pessoais":
        return <DadosPessoaisForm prontuarioId={prontuarioId} />;
      case "consentimento":
        return (
          <ConsentimentoForm
            prontuarioId={prontuarioId}
            onIrParaDadosPessoais={() => setIndice(SECOES.findIndex((s) => s.id === "dados-pessoais"))}
          />
        );
      case "historia-medica":
        return <HistoriaMedicaForm prontuarioId={prontuarioId} />;
      case "historia-odontologica":
        return <HistoriaOdontologicaForm prontuarioId={prontuarioId} />;
      case "exames":
        return <ExamesForm prontuarioId={prontuarioId} />;
      case "sangramento":
        return <SangramentoForm prontuarioId={prontuarioId} />;
      case "ihos":
        return <IHOSForm prontuarioId={prontuarioId} />;
      case "cpod-ceod":
        return <CPODForm prontuarioId={prontuarioId} />;
      case "plano-preventivo":
        return <PlanoForm prontuarioId={prontuarioId} />;
      case "procedimentos":
        return <ProcedimentosForm prontuarioId={prontuarioId} />;
      case "conclusao":
        return <ConclusaoForm prontuarioId={prontuarioId} />;
    }
  }

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


        {aguardando && pendenciasFicha.length > 0 && (
          <section aria-label="Pendências da ficha" className="rounded-card border border-alt/30 bg-alt-tint p-4">
            <p className="text-[13px] font-semibold text-alt">Enviado com pendências</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink">
              Para o aluno concluir, use “Devolver” e escolha o motivo “Campo incompleto”.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {pendenciasFicha.map((p) => (
                <li key={p.secaoId}>
                  <button
                    type="button"
                    onClick={() => setIndice(SECOES.findIndex((s) => s.id === p.secaoId))}
                    className="w-full text-left text-[12.5px] text-ink"
                  >
                    <span className="font-semibold">{p.secao}</span>
                    <span className="block text-ink-soft">{p.mensagem}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {podeEditar && (
          <div className="flex flex-col gap-2">
            {editando ? (
              <>
                <div role="note" className="rounded-card border border-line bg-raised px-3.5 py-3 text-[12.5px] leading-relaxed text-ink">
                  Modo de edição: as alterações são salvas no servidor e ficam registradas no histórico de auditoria.
                </div>
                <button type="button" className="btn-ghost" onClick={() => void concluirEdicao()}>
                  Concluir edição
                </button>
              </>
            ) : (
              <button type="button" className="btn-ghost" disabled={offline} onClick={() => setEditando(true)}>
                Editar ficha
              </button>
            )}
          </div>
        )}

        {edicao.erro && (
          <div role="alert" className="banner-erro flex flex-col gap-2">
            <span>{edicao.erro}</span>
            <button type="button" className="btn-ghost" onClick={edicao.limparErro}>
              Entendi
            </button>
          </div>
        )}

        {salvandoAlteracoes && (edicao.semConexao || offline) && (
          <p role="alert" className="banner-erro flex items-start gap-2">
            <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Sem conexão: {edicao.pendentes} {edicao.pendentes === 1 ? "seção" : "seções"} com alterações ainda não salvas. Elas serão
              enviadas quando a internet voltar. Não feche nem recarregue esta tela.
            </span>
          </p>
        )}
        {salvandoAlteracoes && !edicao.semConexao && !offline && (
          <p role="status" className="text-[12px] text-ink-soft">
            Salvando alterações…
          </p>
        )}

        {editando && podeEditar ? (
          <EdicaoProfessorContext.Provider value={valorEdicao}>{renderEditavel(secao.id)}</EdicaoProfessorContext.Provider>
        ) : (
          renderSecao(secao.id)
        )}
      </main>

      <footer className="sticky bottom-0 z-30 mt-2 flex flex-col gap-2.5 border-t border-line bg-paper px-5 py-3">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost" disabled={indice === 0} onClick={() => setIndice(indice - 1)}>
            Anterior
          </button>
          <button
            type="button"
            className="btn-prof"
            disabled={indice === SECOES.length - 1}
            onClick={() => setIndice(indice + 1)}
          >
            Próxima
          </button>
        </div>
        {aguardando ? (
          <>
            {podeAgir && !offline && (editando || salvandoAlteracoes) && (
              <p role="status" className="mb-2 text-[12px] text-ink-soft">
                Conclua a edição e aguarde o salvamento para assinar ou devolver.
              </p>
            )}
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
      <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Carregando prontuário">
        <Topbar titulo="Prontuário" tituloClassName="text-[18px]" onVoltar={() => navigate("/fila")} />
        <div className="flex gap-2 overflow-hidden px-5 pb-3 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-pill" />
          ))}
        </div>
        <div className="flex flex-col gap-3 px-5 pt-2">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
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
