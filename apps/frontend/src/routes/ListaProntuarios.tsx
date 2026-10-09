import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, UserRound } from "lucide-react";
import Topbar from "../components/Topbar";
import { db, type LocalStatus } from "../db/dexie";
import { getSession } from "../lib/session";
import { criarProntuarioLocal } from "../sync/queue";

const ROTULO_STATUS: Record<LocalStatus, string> = {
  em_andamento: "Em andamento",
  enviado: "Enviado",
  assinado: "Assinado",
  devolvido: "Devolvido",
};

const pad = (n: number) => String(n).padStart(2, "0");

function formatarQuando(ts: number): string {
  const d = new Date(ts);
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const inicioDoDia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicioDoDia(new Date()) - inicioDoDia(d)) / 86_400_000);
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${hora}`;
}

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

  async function novo() {
    if (!usuario) return;
    const nome = window.prompt("Nome do paciente:")?.trim();
    if (!nome || nome.length < 2) return;
    const id = await criarProntuarioLocal(nome, usuario.id);
    navigate(`/prontuario/${id}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo="Meus prontuários"
        subtitulo={usuario ? `${usuario.nome} · ${usuario.perfil === "aluno" ? "Aluno" : "Professor"}` : undefined}
        acao={
          <button
            type="button"
            onClick={() => navigate("/perfil")}
            aria-label="Perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-ink-soft"
          >
            <UserRound size={18} />
          </button>
        }
      />

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
                <button
                  type="button"
                  onClick={() => navigate(`/prontuario/${p.id}`)}
                  className="flex w-full items-center gap-3 rounded-card border border-line-soft bg-raised p-3.5 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary">
                    {p.pacienteNome.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{p.pacienteNome}</span>
                    <span className="block text-[12.5px] text-ink-soft">
                      {ROTULO_STATUS[p.status]} · {formatarQuando(p.atualizadoEm)}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-faint" />
                </button>
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
