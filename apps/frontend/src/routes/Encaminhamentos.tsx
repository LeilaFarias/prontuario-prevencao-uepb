import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Send } from "lucide-react";
import type { Encaminhamento } from "@prontuario/shared";
import TabBarProfessor from "../components/TabBarProfessor";
import { useEncaminhamentos, type FiltroEncaminhamentos } from "../hooks/useEncaminhamentos";
import { formatarDataBR } from "../lib/data";

const FILTROS: Array<{ id: FiltroEncaminhamentos; label: string }> = [
  { id: "semestre", label: "Semestre atual" },
  { id: "todos", label: "Todos" },
];

function CardEncaminhamento({ item, onAbrir }: { item: Encaminhamento; onAbrir: () => void }) {
  const inicial = item.pacienteNome.trim().charAt(0).toUpperCase() || "?";
  const data = formatarDataBR(item.encaminhamentoEm);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full flex-col gap-3 rounded-card border border-line bg-raised p-4 text-left transition active:bg-paper"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prof-tint font-display text-[15px] font-semibold text-prof">
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{item.pacienteNome}</div>
          {data && <div className="mt-0.5 text-[11.5px] text-ink-faint">Encaminhado em {data}</div>}
        </div>
        <ChevronRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-ink-faint" />
      </div>

      <div className="flex items-center gap-2.5 rounded-field bg-paper p-3">
        <Send size={16} aria-hidden="true" className="shrink-0 text-prof" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Encaminhado para</div>
          {item.encaminhamentoPara ? (
            <div className="break-words text-[12.5px] font-medium text-ink">{item.encaminhamentoPara}</div>
          ) : (
            <div className="text-[12.5px] italic text-ink-soft">Destino não informado</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="truncate text-[11.5px] text-ink-faint">Dupla: {item.duplaNome}</span>
        <span className="shrink-0 text-[12.5px] font-semibold text-prof">Ver prontuário →</span>
      </div>
    </button>
  );
}

export default function Encaminhamentos() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<FiltroEncaminhamentos>("semestre");
  const { encaminhamentos, carregando, erro, recarregar } = useEncaminhamentos(filtro);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-5 pb-4 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-prof">
          Clínica de Prevenção em Saúde Bucal · UEPB
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[22px] font-semibold leading-[1.15] text-ink">Encaminhamentos</h1>
          {!carregando && !erro && (
            <span className="rounded-pill bg-prof-tint px-2.5 py-1 text-[12px] font-semibold text-prof">
              {encaminhamentos.length}
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pb-4 pt-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Filtrar encaminhamentos">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-[12.5px] ${
                filtro === f.id
                  ? "bg-prof font-semibold text-white"
                  : "border border-line bg-raised font-medium text-ink-soft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {carregando && <p className="my-auto text-center text-[13px] text-ink-soft">Carregando…</p>}

        {!carregando && erro && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="banner-erro">
              {erro}
            </p>
            <button type="button" className="btn-ghost" onClick={recarregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !erro && encaminhamentos.length === 0 && (
          <div className="my-auto flex flex-col items-center rounded-card border border-line-soft bg-raised px-6 py-10 text-center">
            <Send size={32} aria-hidden="true" className="text-prof" />
            <p className="mt-3 font-display text-[18px] font-medium text-ink">Nenhum encaminhamento registrado</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Quando um aluno registrar um encaminhamento na ficha, ele aparece aqui.
            </p>
          </div>
        )}

        {!carregando && !erro && encaminhamentos.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {encaminhamentos.map((item) => (
              <li key={item.prontuarioId}>
                <CardEncaminhamento item={item} onAbrir={() => navigate(`/fila/${item.prontuarioId}`)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <TabBarProfessor ativa="encaminhar" />
    </div>
  );
}
