import { useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Check, Plus, RotateCcw, UserRound, X } from "lucide-react";
import DevolucaoAlunoModal from "../components/DevolucaoAlunoModal";
import ProntuarioCard from "../components/ProntuarioCard";
import StatusBar from "../components/StatusBar";
import { db, type LocalProntuario } from "../db/dexie";
import { useSyncDown } from "../hooks/useSyncDown";
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
  onVer: () => void;
  onDispensar: () => void;
}) {
  return (
    <div role="status" className={`mb-1 flex items-center gap-2.5 rounded-field px-3.5 py-2.5 text-[13px] ${tom}`}>
      <span aria-hidden="true" className="shrink-0">
        {icone}
      </span>
      <span className="min-w-0 flex-1">{texto}</span>
      <button type="button" onClick={onVer} className="shrink-0 font-semibold underline">
        Ver
      </button>
      <button type="button" onClick={onDispensar} aria-label="Dispensar aviso" className="shrink-0 opacity-70">
        <X size={16} />
      </button>
    </div>
  );
}

function textoAviso(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? `1 prontuário ${singular}` : `${quantidade} prontuários ${plural}`;
}

export default function ListaProntuarios() {
  const navigate = useNavigate();
  const sessao = getSession();
  const usuario = sessao?.user;

  useSyncDown();

  const [devolvidoId, setDevolvidoId] = useState<string | null>(null);

  const prontuarios = useLiveQuery(
    async () => {
      const todos = await db.prontuarios.orderBy("atualizadoEm").reverse().toArray();
      return todos.filter((p) => !p.alunoTitularId || p.alunoTitularId === usuario?.id);
    },
    [usuario?.id],
  );

  const rotuloContagem = !prontuarios
    ? ""
    : prontuarios.length === 0
      ? "nenhum prontuário"
      : prontuarios.length === 1
        ? "1 prontuário"
        : `${prontuarios.length} prontuários`;

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

  async function novo() {
    if (!usuario) return;
    const id = await criarProntuarioLocal(usuario.id);
    navigate(`/prontuario/${id}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-primary">
              Clínica de Prevenção em Saúde Bucal · UEPB
            </p>
            <h1 className="font-display text-[18px] font-semibold leading-[1.15] text-ink">Meus prontuários</h1>
            <p className="mt-0.5 truncate text-[12px] text-ink-soft">
              {[usuario?.nome, rotuloContagem].filter(Boolean).join(" · ")}
            </p>
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
        <StatusBar className="mt-2.5" />
      </header>

      <main className="flex flex-1 flex-col px-5 pb-4 pt-2">
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
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Toque em 'Novo prontuário' para começar a preencher a ficha.
            </p>
          </div>
        )}

        {prontuarios && prontuarios.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {prontuarios.map((p) => (
              <li key={p.id}>
                <ProntuarioCard prontuario={p} onAbrir={() => abrirProntuario(p)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-paper px-5 py-3">
        <button type="button" onClick={novo} className="btn-primary">
          <Plus size={18} /> Novo prontuário
        </button>
      </footer>

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
