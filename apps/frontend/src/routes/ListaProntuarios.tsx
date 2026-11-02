import { useEffect, useReducer, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Plus, RefreshCw, RotateCcw, WifiOff, X } from "lucide-react";
import DevolucaoAlunoModal from "../components/DevolucaoAlunoModal";
import ProntuarioCard from "../components/ProntuarioCard";
import { db, type LocalProntuario } from "../db/dexie";
import { useNotificacoes } from "../hooks/useNotificacoes";
import { useSyncDown } from "../hooks/useSyncDown";
import { ACESSO_EXPIRADO_EVENT, acessoVigente, prontuarioBloqueado } from "../lib/acesso";
import { getSession } from "../lib/session";
import { criarProntuarioLocal, marcarComoVisto, reabrirParaCorrecao } from "../sync/queue";

function Aviso({
  tom,
  icone,
  texto,
  onVer,
  onDispensar,
}: {
  tom: string;
  icone: ReactNode;
  texto: string;
  onVer?: () => void;
  onDispensar: () => void;
}) {
  return (
    <div role="status" className={`mb-1 flex items-center gap-2.5 rounded-field px-3.5 py-2.5 text-[13px] ${tom}`}>
      <span aria-hidden="true" className="shrink-0">
        {icone}
      </span>
      <span className="min-w-0 flex-1">{texto}</span>
      {onVer && (
        <button type="button" onClick={onVer} className="shrink-0 font-semibold underline">
          Ver
        </button>
      )}
      <button type="button" onClick={onDispensar} aria-label="Dispensar aviso" className="shrink-0 opacity-70">
        <X size={16} />
      </button>
    </div>
  );
}

function textoAviso(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? `1 prontuário ${singular}` : `${quantidade} prontuários ${plural}`;
}

type Filtro = "todos" | "rascunho" | "revisao" | "bloqueados";

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "rascunho", label: "Rascunho" },
  { id: "revisao", label: "Aguardando revisão" },
  { id: "bloqueados", label: "Bloqueados" },
];

function passaNoFiltro(p: LocalProntuario, filtro: Filtro): boolean {
  switch (filtro) {
    case "rascunho":
      return acessoVigente(p);
    case "revisao":
      return p.status === "enviado";
    case "bloqueados":
      return prontuarioBloqueado(p);
    default:
      return true;
  }
}

function iniciais(nome: string | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

export default function ListaProntuarios() {
  const navigate = useNavigate();
  const sessao = getSession();
  const usuario = sessao?.user;

  useSyncDown();
  const { notificacoes, dispensar: dispensarNotificacao } = useNotificacoes();

  const [devolvidoId, setDevolvidoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [, renderizar] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    window.addEventListener(ACESSO_EXPIRADO_EVENT, renderizar);
    return () => window.removeEventListener(ACESSO_EXPIRADO_EVENT, renderizar);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pendentesSync = useLiveQuery(async () => {
    const fila = await db.syncQueue.toArray();
    return { operacoes: fila.length, prontuarios: new Set(fila.map((o) => o.prontuarioId)).size };
  }, []);

  const prontuarios = useLiveQuery(
    async () => {
      const todos = await db.prontuarios.orderBy("atualizadoEm").reverse().toArray();
      return todos.filter((p) => !p.alunoTitularId || p.alunoTitularId === usuario?.id);
    },
    [usuario?.id],
  );

  const visiveis = prontuarios?.filter((p) => passaNoFiltro(p, filtro)) ?? [];
  const rotuloContagem = `${visiveis.length} ${visiveis.length === 1 ? "prontuário" : "prontuários"}`;

  const devolvido = prontuarios?.find((p) => p.id === devolvidoId);
  const devolvidosNovos = prontuarios?.filter((p) => p.status === "devolvido" && !p.vistoPeloAluno) ?? [];
  const assinadosNovos = prontuarios?.filter((p) => p.status === "assinado" && !p.vistoPeloAluno) ?? [];

  const dispensar = (itens: LocalProntuario[]) => void Promise.all(itens.map((p) => marcarComoVisto(p.id)));

  function abrirDevolucao(p: LocalProntuario) {
    void marcarComoVisto(p.id);
    setDevolvidoId(p.id);
  }

  function abrirProntuario(p: LocalProntuario) {
    if (p.status === "devolvido") return abrirDevolucao(p);
    if (p.status === "assinado") void marcarComoVisto(p.id);
    navigate(`/prontuario/${p.id}`);
  }

  async function corrigir(p: LocalProntuario) {
    await reabrirParaCorrecao(p.id);
    setDevolvidoId(null);
    navigate(`/prontuario/${p.id}`);
  }

  function verFicha(p: LocalProntuario) {
    setDevolvidoId(null);
    navigate(`/prontuario/${p.id}?modo=leitura`);
  }

  function solicitarAcesso(p: LocalProntuario) {
    void marcarComoVisto(p.id);
    navigate(`/prontuario/${p.id}?solicitar=1`);
  }

  async function novo() {
    if (!usuario) return;
    const id = await criarProntuarioLocal(usuario.id);
    navigate(`/prontuario/${id}`);
  }

  const temPendentes = (pendentesSync?.operacoes ?? 0) > 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pb-3 pt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-primary">
          Clínica de Prevenção em Saúde Bucal · UEPB
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">Prontuários</h1>
          <button
            type="button"
            onClick={() => navigate("/perfil")}
            aria-label="Perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[14px] font-semibold text-primary"
          >
            {iniciais(usuario?.nome)}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pb-4 pt-1">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="group" aria-label="Filtrar prontuários">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-[12.5px] ${
                filtro === f.id
                  ? "bg-primary font-semibold text-white"
                  : "border border-line bg-raised font-medium text-ink-soft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!online && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-alt/20 bg-alt-tint p-3 text-[12.5px] text-alt"
          >
            <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className="block font-semibold text-alt">Você está sem internet</strong>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-soft">
                {temPendentes
                  ? `${pendentesSync!.prontuarios} ${pendentesSync!.prontuarios === 1 ? "prontuário será sincronizado" : "prontuários serão sincronizados"} quando a conexão voltar.`
                  : "Você pode continuar editando. As alterações serão sincronizadas quando a conexão voltar."}
              </span>
            </span>
          </div>
        )}

        {online && temPendentes && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-sync-tint p-3 text-[12.5px] text-sync">
            <RefreshCw size={16} className="shrink-0 animate-spin" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {pendentesSync!.prontuarios === 1
                ? "1 prontuário salvo apenas neste aparelho — sincronizando…"
                : `${pendentesSync!.prontuarios} prontuários salvos apenas neste aparelho — sincronizando…`}
            </span>
          </div>
        )}

        {notificacoes.map((n) => (
          <Aviso
            key={n.id}
            tom="bg-alt-tint text-alt"
            icone={<Bell size={16} />}
            texto={n.mensagem}
            onDispensar={() => dispensarNotificacao(n.id)}
          />
        ))}
        {devolvidosNovos.length > 0 && (
          <Aviso
            tom="bg-alt-tint text-alt"
            icone={<RotateCcw size={16} />}
            texto={textoAviso(devolvidosNovos.length, "foi devolvido para correção", "foram devolvidos para correção")}
            onVer={() => abrirDevolucao(devolvidosNovos[0]!)}
            onDispensar={() => dispensar(devolvidosNovos)}
          />
        )}
        {assinadosNovos.length > 0 && (
          <Aviso
            tom="bg-primary-tint text-primary"
            icone={<Check size={16} />}
            texto={textoAviso(
              assinadosNovos.length,
              `foi assinado${assinadosNovos[0]!.assinadoPorNome ? ` por ${assinadosNovos[0]!.assinadoPorNome}` : ""}`,
              "foram assinados",
            )}
            onVer={() => {
              const alvo = assinadosNovos[0]!;
              void marcarComoVisto(alvo.id);
              navigate(`/prontuario/${alvo.id}?modo=leitura`);
            }}
            onDispensar={() => dispensar(assinadosNovos)}
          />
        )}

        {prontuarios && prontuarios.length === 0 && (
          <div className="my-auto flex flex-col items-center rounded-card border border-line-soft bg-raised px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Plus size={26} />
            </div>
            <p className="mt-4 font-display text-[18px] font-medium text-ink">Nenhum prontuário ainda</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">Comece preenchendo a ficha de um novo paciente.</p>
            <button type="button" onClick={novo} className="btn-primary mt-5">
              <Plus size={18} /> Novo prontuário
            </button>
          </div>
        )}

        {prontuarios && prontuarios.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">{rotuloContagem}</p>
            {visiveis.length === 0 ? (
              <p className="rounded-card border border-line-soft bg-raised px-4 py-6 text-center text-[13px] text-ink-soft">
                Nenhum prontuário neste filtro.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visiveis.map((p) => (
                  <li key={p.id}>
                    <ProntuarioCard
                      prontuario={p}
                      onAbrir={() => abrirProntuario(p)}
                      onSolicitarAcesso={() => solicitarAcesso(p)}
                      onCorrigir={() => void corrigir(p)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {prontuarios && prontuarios.length > 0 && (
        <footer className="sticky bottom-0 border-t border-line bg-paper px-5 py-3">
          <button type="button" onClick={novo} className="btn-primary">
            <Plus size={18} /> Novo prontuário
          </button>
        </footer>
      )}

      {devolvido && (
        <DevolucaoAlunoModal
          open
          onClose={() => setDevolvidoId(null)}
          prontuario={devolvido}
          onCorrigir={() => void corrigir(devolvido)}
          onVerFicha={() => verFicha(devolvido)}
        />
      )}
    </div>
  );
}