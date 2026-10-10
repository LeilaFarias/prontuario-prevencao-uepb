import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Plus, UserRound } from "lucide-react";
import ProntuarioCard from "../components/ProntuarioCard";
import StatusBar from "../components/StatusBar";
import { db } from "../db/dexie";
import { getSession } from "../lib/session";
import { criarProntuarioLocal } from "../sync/queue";

export default function ListaProntuarios() {
  const navigate = useNavigate();
  const sessao = getSession();
  const usuario = sessao?.user;

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

  async function novo() {
    if (!usuario) return;
    const nome = window.prompt("Nome do paciente:")?.trim();
    if (!nome || nome.length < 2) return;
    const id = await criarProntuarioLocal(nome, usuario.id);
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
                <ProntuarioCard prontuario={p} onAbrir={() => navigate(`/prontuario/${p.id}`)} />
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
    </div>
  );
}
