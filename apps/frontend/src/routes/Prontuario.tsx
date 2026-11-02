import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Clock, RotateCcw, Send } from "lucide-react";
import { SECOES, type SecaoId } from "@prontuario/shared";
import Consentimento from "../components/ficha/Consentimento";
import Conclusao from "../components/ficha/Conclusao";
import CPOD from "../components/ficha/CPOD";
import DadosPessoais from "../components/ficha/DadosPessoais";
import Exames from "../components/ficha/Exames";
import HistoriaMedica from "../components/ficha/HistoriaMedica";
import HistoriaOdontologica from "../components/ficha/HistoriaOdontologica";
import IHOS from "../components/ficha/IHOS";
import Plano from "../components/ficha/Plano";
import Sangramento from "../components/ficha/Sangramento";
import Procedimentos from "../components/ficha/Procedimentos";
import DevolucaoAlunoModal from "../components/DevolucaoAlunoModal";
import EnviarProntuarioModal from "../components/EnviarProntuarioModal";
import StatusBar from "../components/StatusBar";
import Topbar from "../components/Topbar";
import { db, type LocalProntuario } from "../db/dexie";
import { useProntuarioSync } from "../hooks/useProntuarioSync";
import { salvarSecoesPendentes } from "../hooks/useSecao";
import { formatarDataHoraCompleta } from "../components/ficha/revisao/rotulos";
import { marcarComoVisto, reabrirParaCorrecao, salvarSecaoLocal } from "../sync/queue";

const DEBOUNCE_MS = 800;

export default function Prontuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const modoLeitura = params.get("modo") === "leitura";
  const { carregando: sincronizando, versao } = useProntuarioSync(id);
  const [verDevolucao, setVerDevolucao] = useState(false);

  const [estado, setEstado] = useState<"carregando" | "ok" | "nao-encontrado">("carregando");
  const [pront, setPront] = useState<LocalProntuario | null>(null);
  const [indice, setIndice] = useState(0);
  const vivo = useLiveQuery(async () => (id ? await db.prontuarios.get(id) : undefined), [id]);
  const nomeAoVivo = vivo?.pacienteNome;
  const [paraEnvio, setParaEnvio] = useState<LocalProntuario | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});

  const timer = useRef<number | undefined>(undefined);
  const pendente = useRef<{ secaoId: SecaoId; texto: string } | null>(null);
  const chipAtivo = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!id) return;
    void db.prontuarios.get(id).then((p) => {
      if (!ativo) return;
      if (!p) return setEstado("nao-encontrado");
      setPront(p);
      const doBanco = Object.fromEntries(
        Object.entries(p.secoes).map(([secao, c]) => [secao, String(c?.texto ?? "")]),
      );
      const digitando = pendente.current;
      setValores(digitando ? { ...doBanco, [digitando.secaoId]: digitando.texto } : doBanco);
      setEstado("ok");
    });
    return () => {
      ativo = false;
    };
  }, [id, versao]);

  const salvarPendente = useCallback(async () => {
    window.clearTimeout(timer.current);
    const p = pendente.current;
    if (!p || !id) return;
    pendente.current = null;
    await salvarSecaoLocal(id, p.secaoId, { texto: p.texto });
  }, [id]);

  useEffect(() => {
    const aoOcultar = () => document.visibilityState === "hidden" && void salvarPendente();
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      document.removeEventListener("visibilitychange", aoOcultar);
      void salvarPendente();
    };
  }, [salvarPendente]);

  useEffect(() => {
    chipAtivo.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [indice]);

  const jaVisto = vivo?.vistoPeloAluno;
  const statusAoVivo = vivo?.status;
  useEffect(() => {
    if (id && statusAoVivo === "assinado" && !jaVisto) void marcarComoVisto(id);
  }, [id, statusAoVivo, jaVisto]);

  function irPara(i: number) {
    void salvarPendente();
    setIndice(i);
  }

  function irParaSecao(secaoId: SecaoId) {
    const i = SECOES.findIndex((s) => s.id === secaoId);
    if (i >= 0) irPara(i);
  }

  const abrirEnvio = useCallback(async () => {
    if (!id) return;
    await salvarPendente();
    await salvarSecoesPendentes();
    const fresco = await db.prontuarios.get(id);
    if (fresco) setParaEnvio(fresco);
  }, [id, salvarPendente]);

  function aoDigitar(texto: string) {
    const secao = SECOES[indice]!;
    setValores((v) => ({ ...v, [secao.id]: texto }));
    pendente.current = { secaoId: secao.id, texto };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvarPendente(), DEBOUNCE_MS);
  }

  if (estado === "carregando" || (estado === "nao-encontrado" && sincronizando)) {
    return <div className="flex-1" />;
  }

  if (estado === "nao-encontrado" || !pront) {
    return (
      <div className="flex flex-1 flex-col">
        <Topbar titulo="Prontuário" onVoltar={() => navigate("/prontuarios")} />
        <p className="px-6 pt-4 text-[14px] text-ink-soft">Prontuário não encontrado neste aparelho.</p>
      </div>
    );
  }

  const secao = SECOES[indice]!;
  const nomeExibido = (nomeAoVivo ?? pront.pacienteNome).trim();
  const atual = vivo ?? pront;
  const status = atual.status;
  const somenteLeitura = status !== "em_andamento" || modoLeitura;
  const professorDigitado = String(
    (atual.secoes["consentimento"] as { professorSupervisor?: unknown } | undefined)?.professorSupervisor ?? "",
  ).trim();
  const nomeAssinatura = atual.assinadoPorNome || professorDigitado;
  const quandoAssinado = formatarDataHoraCompleta(atual.assinadoEm);

  async function corrigir() {
    await reabrirParaCorrecao(atual.id);
    setVerDevolucao(false);
  }

  const PILL = "inline-flex w-fit items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold";
  const bannerStatus =
    status === "enviado" ? (
      <div className="flex flex-col gap-1.5">
        <span className={`${PILL} bg-sync-tint text-sync`}>
          <Clock size={12} aria-hidden="true" />
          Aguardando revisão
        </span>
        <p className="text-[12px] text-ink-soft">Se precisar alterar, peça ao professor devolver.</p>
      </div>
    ) : status === "assinado" ? (
      <span className={`${PILL} bg-primary-tint text-primary`}>
        <Check size={12} aria-hidden="true" />
        {nomeAssinatura
          ? `Assinado por ${nomeAssinatura}${quandoAssinado ? ` em ${quandoAssinado}` : ""}`
          : "Assinado"}
      </span>
    ) : status === "devolvido" ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILL} bg-alt-tint text-alt`}>
          <RotateCcw size={12} aria-hidden="true" />
          {atual.devolvidoPorNome ? `Devolvido por ${atual.devolvidoPorNome}` : "Devolvido"}
        </span>
        <button type="button" className="text-[12.5px] font-semibold text-alt underline" onClick={() => setVerDevolucao(true)}>
          Ver comentário
        </button>
        <button type="button" className="text-[12.5px] font-semibold text-primary underline" onClick={() => void corrigir()}>
          Corrigir
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo={nomeExibido || "Novo prontuário"}
        subtitulo={nomeExibido ? secao.titulo : "Preencha os dados para começar"}
        tituloClassName="text-[18px]"
        onVoltar={() => navigate("/prontuarios")}
      />
      <StatusBar className="mx-5 mb-2" />

      {bannerStatus && <div className="mx-5 mb-2">{bannerStatus}</div>}

      {status === "em_andamento" && atual.erroEnvio && (
        <div role="alert" className="banner-erro mx-5 mb-2">
          {atual.erroEnvio === "professor_nao_encontrado"
            ? "O envio feito sem conexão foi recusado: não encontramos o professor supervisor. Corrija o nome no Consentimento e envie de novo."
            : "O envio feito sem conexão não foi concluído. Confira a ficha e envie novamente."}
          {atual.erroEnvio === "professor_nao_encontrado" && (
            <button
              type="button"
              onClick={() => irParaSecao("consentimento")}
              className="mt-1.5 block font-semibold underline"
            >
              Ir para o Consentimento
            </button>
          )}
        </div>
      )}

      <nav aria-label="Seções" className="flex gap-2 overflow-x-auto px-5 pb-3 pt-1 [scrollbar-width:none]">
        {SECOES.map((s, i) => (
          <button
            key={s.id}
            ref={i === indice ? chipAtivo : undefined}
            type="button"
            onClick={() => irPara(i)}
            aria-current={i === indice}
            className={`shrink-0 rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition ${
              i === indice ? "border-primary bg-primary text-white" : "border-line bg-raised text-ink-soft"
            }`}
          >
            {s.titulo}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-5 pb-4 pt-2">
        {secao.id === "consentimento" ? (
          <Consentimento
            key={pront.id}
            prontuarioId={pront.id}
            onIrParaDadosPessoais={() => irPara(SECOES.findIndex((x) => x.id === "dados-pessoais"))}
          />
        ) : secao.id === "historia-odontologica" ? (
          <HistoriaOdontologica key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "cpod-ceod" ? (
          <CPOD key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "ihos" ? (
          <IHOS key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "sangramento" ? (
          <Sangramento key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "plano-preventivo" ? (
          <Plano key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "procedimentos" ? (
          <Procedimentos key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "conclusao" ? (
          <Conclusao key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "exames" ? (
          <Exames key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "historia-medica" ? (
          <HistoriaMedica key={pront.id} prontuarioId={pront.id} />
        ) : secao.id === "dados-pessoais" ? (
          <DadosPessoais key={pront.id} prontuarioId={pront.id} />
        ) : (
          <section className="rounded-card border border-line-soft bg-raised p-4">
            <h2 className="font-display text-[18px] font-medium text-ink">{secao.titulo}</h2>
            <label htmlFor="campo-secao" className="label mt-4">Anotações da seção</label>
            <input
              id="campo-secao"
              type="text"
              className="input"
              value={valores[secao.id] ?? ""}
              onChange={(e) => aoDigitar(e.target.value)}
              placeholder="Digite aqui…"
              disabled={somenteLeitura}
            />
            <p className="hint">Autosave local ativo. As alterações entram na fila de sincronização.</p>
          </section>
        )}
      </main>

      <footer className="sticky bottom-0 mt-4 flex flex-col gap-2.5 border-t border-line bg-paper px-5 py-3">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost" disabled={indice === 0} onClick={() => irPara(indice - 1)}>
            Anterior
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={indice === SECOES.length - 1}
            onClick={() => irPara(indice + 1)}
          >
            Próxima
          </button>
        </div>
        {!somenteLeitura && (
          <button type="button" className="btn-primary" onClick={() => void abrirEnvio()}>
            <Send size={16} aria-hidden="true" />
            Enviar ao professor
          </button>
        )}
      </footer>

      {status === "devolvido" && (
        <DevolucaoAlunoModal
          open={verDevolucao}
          onClose={() => setVerDevolucao(false)}
          prontuario={atual}
          onCorrigir={() => void corrigir()}
          onVerFicha={() => setVerDevolucao(false)}
        />
      )}

      {paraEnvio && (
        <EnviarProntuarioModal
          prontuario={paraEnvio}
          onClose={() => setParaEnvio(null)}
          onIrParaSecao={irParaSecao}
          onVoltarParaLista={() => navigate("/prontuarios")}
          onAbrirProntuario={(outroId) => navigate(`/prontuario/${outroId}`)}
        />
      )}
    </div>
  );
}
