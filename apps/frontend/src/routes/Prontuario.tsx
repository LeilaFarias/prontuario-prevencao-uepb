import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams } from "react-router-dom";
import { SECOES, type SecaoId } from "@prontuario/shared";
import Consentimento from "../components/ficha/Consentimento";
import DadosPessoais from "../components/ficha/DadosPessoais";
import Exames from "../components/ficha/Exames";
import HistoriaMedica from "../components/ficha/HistoriaMedica";
import StatusBar from "../components/StatusBar";
import Topbar from "../components/Topbar";
import { db, type LocalProntuario } from "../db/dexie";
import { useProntuarioSync } from "../hooks/useProntuarioSync";
import { salvarSecaoLocal } from "../sync/queue";

const DEBOUNCE_MS = 800;

export default function Prontuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { carregando: sincronizando, versao } = useProntuarioSync(id);

  const [estado, setEstado] = useState<"carregando" | "ok" | "nao-encontrado">("carregando");
  const [pront, setPront] = useState<LocalProntuario | null>(null);
  const [indice, setIndice] = useState(0);
  const nomeAoVivo = useLiveQuery(async () => (id ? (await db.prontuarios.get(id))?.pacienteNome : undefined), [id]);
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

  // Garante que nada digitado se perde ao sair da tela ou ocultar o app
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

  function irPara(i: number) {
    void salvarPendente();
    setIndice(i);
  }

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

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo={nomeExibido || "Novo prontuário"}
        subtitulo={nomeExibido ? secao.titulo : "Preencha os dados para começar"}
        tituloClassName="text-[18px]"
        onVoltar={() => navigate("/prontuarios")}
      />
      <StatusBar className="mx-5 mb-2" />

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
            />
            <p className="hint">Autosave local ativo. As alterações entram na fila de sincronização.</p>
          </section>
        )}
      </main>

      <footer className="sticky bottom-0 mt-4 grid grid-cols-2 gap-3 border-t border-line bg-paper px-5 py-3">
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
      </footer>
    </div>
  );
}
