import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, AlertTriangle, Clock, UserRound } from "lucide-react";
import type { FilaRevisaoResponse, FiltroFila, ItemFilaRevisao } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";
import { getSession } from "../lib/session";
import TabBarProfessor from "../components/TabBarProfessor";
import TransferirTitularidadeModal from "../components/TransferirTitularidadeModal";
import { useIndicadorPacientes } from "../hooks/useIndicadorPacientes";
import { formatarDataBR } from "../lib/data";
import { calcularIdade, tempoRelativo } from "../lib/tempo";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "ok"; itens: ItemFilaRevisao[] };

function CardFila({
  item,
  meu,
  onAbrir,
  onAvaliarTransferencia,
}: {
  item: ItemFilaRevisao;
  meu: boolean;
  onAbrir: () => void;
  onAvaliarTransferencia: () => void;
}) {
  const duplicado = item.sinalizadoDuplicidade;
  const acaoBloqueada = duplicado && !meu;
  const idade = calcularIdade(item.pacienteDataNascimento ?? undefined);
  const tempo = tempoRelativo(new Date(item.atualizadoEm).getTime());
  const inicial = item.pacienteNome.trim().charAt(0).toUpperCase() || "?";
  const dupla = [item.alunoOperador, item.alunoAuxiliar].filter(Boolean).join(" · ") || item.alunoNome;

  function aoClicar() {
    if (!duplicado) return onAbrir();
    if (!acaoBloqueada) onAvaliarTransferencia();
  }

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    aoClicar();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={acaoBloqueada}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      className={`w-full cursor-pointer rounded-card border border-line bg-raised p-4 text-left transition active:bg-paper ${
        acaoBloqueada ? "cursor-not-allowed" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-prof-tint font-display text-[16px] font-semibold text-prof">
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-ink">{item.pacienteNome}</div>
          <div className="mt-0.5 truncate text-[12px] text-ink-soft">
            {[idade !== null ? `${idade} anos` : null, `Dupla: ${dupla}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {duplicado ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-alt-tint px-2.5 py-1 text-[11px] font-semibold text-alt">
            <AlertTriangle size={10} aria-hidden="true" />
            Possível duplicidade
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-prof-tint px-2.5 py-1 text-[11px] font-semibold text-prof">
            <Clock size={10} aria-hidden="true" />
            Pendente
          </span>
        )}
      </div>

      {duplicado && (
        <div className="mt-3 flex items-start gap-2.5 rounded-field bg-alt-tint p-3">
          <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-alt" />
          <p className="text-[11.5px] text-ink-soft">
            Já existe outro prontuário para este paciente com a dupla{" "}
            <span className="font-semibold text-ink">{item.duplaAnteriorNome ?? "outra dupla"}</span>. Avalie a
            transferência de titularidade.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2.5 border-t border-line-soft pt-2.5">
        <span className="text-[11.5px] text-ink-faint">
          Enviado {tempo}
          {meu && <span className="ml-2 font-semibold text-prof">· Sob sua supervisão</span>}
        </span>
        <span
          className={`shrink-0 text-[12.5px] font-semibold ${duplicado ? "text-alt" : "text-prof"} ${
            acaoBloqueada ? "opacity-50" : ""
          }`}
        >
          {duplicado ? "Avaliar transferência →" : "Revisar →"}
        </span>
      </div>
    </div>
  );
}

function Chip({
  ativo,
  rotulo,
  total,
  onClick,
}: {
  ativo: boolean;
  rotulo: string;
  total: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-4 py-2 text-[12.5px] ${
        ativo ? "bg-prof font-semibold text-white" : "border border-line bg-raised font-medium text-ink-soft"
      }`}
    >
      {rotulo}
      {total !== null && (
        <span
          className={`ml-1 rounded-full px-1.5 text-[11px] font-bold ${
            ativo ? "bg-white/25 text-white" : "bg-paper text-ink-soft"
          }`}
        >
          {total}
        </span>
      )}
    </button>
  );
}

export default function Fila() {
  const navigate = useNavigate();
  const usuario = getSession()?.user;
  const { data: indicador } = useIndicadorPacientes();
  const [filtro, setFiltro] = useState<FiltroFila>("meus");
  const [contadores, setContadores] = useState<FilaRevisaoResponse["contadores"] | null>(null);
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });
  const [transferindo, setTransferindo] = useState<ItemFilaRevisao | null>(null);

  const carregar = useCallback(() => {
    setEstado({ situacao: "carregando" });
    api
      .get<FilaRevisaoResponse>(`/fila-revisao?filtro=${filtro}`)
      .then((r) => {
        setContadores(r.contadores);
        setEstado({ situacao: "ok", itens: r.prontuarios });
      })
      .catch((err: unknown) =>
        setEstado({
          situacao: "erro",
          mensagem: err instanceof ApiError ? err.message : "Não foi possível carregar a fila.",
        }),
      );
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pendentes = contadores?.meus ?? 0;
  const subtitulo = [usuario?.nome, contadores ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pb-2 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-prof">
              Clínica de Prevenção em Saúde Bucal · UEPB
            </p>
            <h1 className="font-display text-[26px] font-semibold leading-[1.15] text-ink">Fila de revisão</h1>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/perfil")}
            aria-label="Perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-ink-soft"
          >
            <UserRound size={18} />
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-5 py-3 scrollbar-hide" role="group" aria-label="Filtrar fila">
        <Chip ativo={filtro === "meus"} rotulo="Meus alunos" total={contadores?.meus ?? null} onClick={() => setFiltro("meus")} />
        <Chip ativo={filtro === "todos"} rotulo="Todos" total={contadores?.todos ?? null} onClick={() => setFiltro("todos")} />
      </div>

      {indicador && (
        <div className="mx-5 mb-3 flex items-center gap-4 rounded-card border border-line bg-raised p-4">
          <div className="font-display text-[38px] font-semibold leading-none text-prof">{indicador.total}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Pacientes atendidos</div>
            {indicador.periodo ? (
              <>
                <div className="mt-0.5 text-[12px] font-medium text-ink-soft">
                  no semestre {indicador.periodo.inicio.slice(0, 4)}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-faint">
                  Período de {formatarDataBR(indicador.periodo.inicio)} a {formatarDataBR(indicador.periodo.fim)}
                </div>
              </>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-alt">
                Configure o semestre para calcular
                <button type="button" onClick={() => navigate("/perfil")} className="font-semibold text-prof">
                  Configurar →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col px-5 pb-4 pt-1">
        {estado.situacao === "erro" && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="banner-erro">
              {estado.mensagem}
            </p>
            <button type="button" className="btn-ghost" onClick={carregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {estado.situacao === "ok" && estado.itens.length === 0 && (
          <div className="my-auto rounded-card border border-line-soft bg-raised px-6 py-10 text-center">
            <p className="font-display text-[18px] font-medium text-ink">Fila vazia</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">Os prontuários enviados pelos alunos aparecem aqui.</p>
          </div>
        )}

        {estado.situacao === "ok" && estado.itens.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {estado.itens.map((item) => (
              <li key={item.id}>
                <CardFila
                  item={item}
                  meu={item.professorSupervisorId === usuario?.id}
                  onAbrir={() => navigate(`/fila/${item.id}`)}
                  onAvaliarTransferencia={() => setTransferindo(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {transferindo && (
        <TransferirTitularidadeModal
          open
          onClose={() => setTransferindo(null)}
          prontuarioId={transferindo.id}
          pacienteNome={transferindo.pacienteNome}
          onSucesso={carregar}
        />
      )}

      <TabBarProfessor ativa="fila" />
    </div>
  );
}
