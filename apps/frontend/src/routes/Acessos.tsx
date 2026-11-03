import { useState, type ReactNode } from "react";
import { Check, Clock } from "lucide-react";
import { ACESSO_TEMPORARIO_HORAS, type AcessoPendente, type AcessoVigente } from "@prontuario/shared";
import TabBarProfessor from "../components/TabBarProfessor";
import TimerAcesso from "../components/TimerAcesso";
import { useAcessos } from "../hooks/useAcessos";
import { ACESSOS_ATUALIZADOS_EVENT } from "../lib/acesso";
import { ApiError, api } from "../lib/api";
import { getSession } from "../lib/session";

type Acao = "aprovar-acesso" | "recusar-acesso" | "revogar-acesso";

function Avatar({ nome }: { nome: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prof-tint font-display text-[15px] font-semibold text-prof"
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function Secao({
  titulo,
  total,
  vazio,
  classeBadge,
  children,
}: {
  titulo: string;
  total: number;
  vazio: string;
  classeBadge: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
        {titulo}
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${classeBadge}`}>{total}</span>
      </h2>
      {total === 0 ? <p className="text-[12.5px] text-ink-soft">{vazio}</p> : <ul className="flex flex-col gap-2.5">{children}</ul>}
    </section>
  );
}

export default function Acessos() {
  const { estado, recarregar } = useAcessos();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: Acao, prontuarioId: string) {
    setOcupado(prontuarioId);
    setErro(null);
    try {
      await api.post(`/prontuarios/${encodeURIComponent(prontuarioId)}/${acao}`, {});
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      await recarregar();
      window.dispatchEvent(new CustomEvent(ACESSOS_ATUALIZADOS_EVENT));
      setOcupado(null);
    }
  }

  const pendentes: AcessoPendente[] = estado.situacao === "ok" ? estado.dados.pendentes : [];
  const vigentes: AcessoVigente[] = estado.situacao === "ok" ? estado.dados.vigentes : [];
  const subtitulo =
    estado.situacao === "ok"
      ? [
          getSession()?.user.nome,
          `${pendentes.length} ${pendentes.length === 1 ? "pedido" : "pedidos"}`,
          `${vigentes.length} ${vigentes.length === 1 ? "vigente" : "vigentes"}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pb-2 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-prof">
          Clínica de Prevenção em Saúde Bucal · UEPB
        </p>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] text-ink">Acessos</h1>
        {subtitulo && <p className="mt-0.5 text-[12.5px] text-ink-soft">{subtitulo}</p>}
      </header>

      <main className="flex flex-1 flex-col gap-6 px-5 pb-4 pt-4">
        {estado.situacao === "erro" && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="banner-erro">
              {estado.mensagem}
            </p>
            <button type="button" className="btn-ghost" onClick={() => void recarregar()}>
              Tentar novamente
            </button>
          </div>
        )}

        {erro && (
          <p role="alert" className="banner-erro">
            {erro}
          </p>
        )}

        {estado.situacao === "ok" && (
          <>
            <Secao
              titulo="Pedidos pendentes"
              total={pendentes.length}
              vazio="Nenhum pedido pendente."
              classeBadge="bg-alt-tint text-alt"
            >
              {pendentes.map((p) => (
                <li key={p.prontuarioId} className="flex flex-col gap-3 rounded-card border border-line bg-raised p-4">
                  <div className="flex items-start gap-3">
                    <Avatar nome={p.alunoNome} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{p.alunoNome}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-ink-soft">Paciente: {p.pacienteNome}</div>
                    </div>
                    <span className="shrink-0 text-[11.5px] text-ink-faint">{p.tempoEspera}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
                      disabled={ocupado === p.prontuarioId}
                      onClick={() => void executar("aprovar-acesso", p.prontuarioId)}
                    >
                      <Check size={15} aria-hidden="true" />
                      Aprovar por {ACESSO_TEMPORARIO_HORAS}h
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-line bg-raised px-4 py-2.5 text-[13px] font-semibold text-ink-soft disabled:opacity-60"
                      disabled={ocupado === p.prontuarioId}
                      onClick={() => void executar("recusar-acesso", p.prontuarioId)}
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </Secao>

            <Secao
              titulo="Acessos vigentes"
              total={vigentes.length}
              vazio="Nenhum acesso vigente."
              classeBadge="bg-prof-tint text-prof"
            >
              {vigentes.map((v) => (
                <li key={v.prontuarioId} className="flex flex-col gap-3 rounded-card border border-line bg-raised p-4">
                  <div className="flex items-start gap-3">
                    <Avatar nome={v.alunoNome} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{v.alunoNome}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-ink-soft">Paciente: {v.pacienteNome}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-field bg-primary-tint px-3 py-2 text-[12px] font-semibold text-primary">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} aria-hidden="true" />
                      Expira em
                    </span>
                    <TimerAcesso
                      expiraEm={v.acessoExpiraEm}
                      rotulo=""
                      className="font-display text-[15px] font-semibold"
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-alt/20 bg-alt-tint py-2.5 text-[13px] font-semibold text-alt disabled:opacity-60"
                    disabled={ocupado === v.prontuarioId}
                    onClick={() => void executar("revogar-acesso", v.prontuarioId)}
                  >
                    Revogar acesso
                  </button>
                </li>
              ))}
            </Secao>
          </>
        )}
      </main>

      <TabBarProfessor ativa="acessos" />
    </div>
  );
}