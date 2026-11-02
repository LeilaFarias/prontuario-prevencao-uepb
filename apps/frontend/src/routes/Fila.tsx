import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, UserRound } from "lucide-react";
import { ApiError } from "../lib/api";
import { getSession } from "../lib/session";
import TabBarProfessor from "../components/TabBarProfessor";
import { calcularIdade, tempoRelativo } from "../lib/tempo";
import { buscarResumos, normalizarStatus, type ProntuarioRemotoResumo } from "../sync/down";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "ok"; itens: ProntuarioRemotoResumo[] };

function CardFila({
  item,
  meu,
  onAbrir,
}: {
  item: ProntuarioRemotoResumo;
  meu: boolean;
  onAbrir: () => void;
}) {
  const idade = calcularIdade(item.pacienteDataNascimento ?? undefined);
  const tempo = tempoRelativo(new Date(item.atualizadoEm).getTime());
  const inicial = item.pacienteNome.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full rounded-card border border-line bg-raised p-4 text-left transition active:bg-paper"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-prof-tint font-display text-[15px] font-semibold text-prof">
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-ink">{item.pacienteNome}</div>
          <div className="mt-0.5 truncate text-[12px] text-ink-soft">
            {[idade !== null ? `${idade} anos` : null, item.alunoNome].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-sync-tint px-2.5 py-1 text-[11px] font-semibold text-sync">
          <Clock size={10} aria-hidden="true" />
          Aguardando revisão
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-line-soft pt-2.5">
        <span className="text-[11.5px] text-ink-faint">
          Enviado {tempo}
          {meu && <span className="ml-2 font-semibold text-prof">· Sob sua supervisão</span>}
        </span>
        <span className="text-[12.5px] font-semibold text-prof">Revisar →</span>
      </div>
    </button>
  );
}

export default function Fila() {
  const navigate = useNavigate();
  const usuario = getSession()?.user;
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });

  const carregar = useCallback(() => {
    setEstado({ situacao: "carregando" });
    buscarResumos()
      .then((todos) =>
        setEstado({ situacao: "ok", itens: todos.filter((r) => normalizarStatus(r.status) === "enviado") }),
      )
      .catch((err: unknown) =>
        setEstado({
          situacao: "erro",
          mensagem: err instanceof ApiError ? err.message : "Não foi possível carregar a fila.",
        }),
      );
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const rotuloContagem =
    estado.situacao !== "ok"
      ? ""
      : estado.itens.length === 0
        ? "nada para revisar"
        : estado.itens.length === 1
          ? "1 prontuário para revisar"
          : `${estado.itens.length} prontuários para revisar`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-prof">
              Clínica de Prevenção em Saúde Bucal · UEPB
            </p>
            <h1 className="font-display text-[18px] font-semibold leading-[1.15] text-ink">Fila de revisão</h1>
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
      </header>

      <main className="flex flex-1 flex-col px-5 pb-4 pt-3">
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
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <TabBarProfessor ativa="fila" />
    </div>
  );
}
