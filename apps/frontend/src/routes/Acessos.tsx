import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import type { AcessoPendente, AcessoVigente } from "@prontuario/shared";
import TabBarProfessor from "../components/TabBarProfessor";
import TimerAcesso from "../components/TimerAcesso";
import { useAcessos } from "../hooks/useAcessos";
import { ACESSOS_ATUALIZADOS_EVENT } from "../lib/acesso";
import { ApiError, api } from "../lib/api";

type Acao = "aprovar-acesso" | "recusar-acesso" | "revogar-acesso";

function Avatar({ nome }: { nome: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-prof-tint font-display text-[15px] font-semibold text-prof"
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function Secao({ titulo, total, vazio, children }: { titulo: string; total: number; vazio: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline gap-2 font-display text-[15px] font-medium text-ink">
        {titulo}
        <span className="text-[12px] font-semibold text-ink-faint">{total}</span>
      </h2>
      {total === 0 ? <p className="text-[12.5px] text-ink-soft">{vazio}</p> : <ul className="flex flex-col gap-2.5">{children}</ul>}
    </section>
  );
}

export default function Acessos() {
  const navigate = useNavigate();
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
      ? `${pendentes.length} ${pendentes.length === 1 ? "pedido" : "pedidos"} · ${vigentes.length} ${vigentes.length === 1 ? "vigente" : "vigentes"}`
      : "";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-prof">
              Clínica de Prevenção em Saúde Bucal · UEPB
            </p>
            <h1 className="font-display text-[18px] font-semibold leading-[1.15] text-ink">Acessos</h1>
            {subtitulo && <p className="mt-0.5 truncate text-[12px] text-ink-soft">{subtitulo}</p>}
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
            <Secao titulo="Pedidos pendentes" total={pendentes.length} vazio="Nenhum pedido pendente.">
              {pendentes.map((p) => (
                <li key={p.prontuarioId} className="rounded-card border border-line bg-raised p-4">
                  <div className="flex items-start gap-3">
                    <Avatar nome={p.pacienteNome} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-ink">{p.pacienteNome}</div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-soft">Aluno: {p.alunoNome}</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-faint">Enviado {p.tempoEspera}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={ocupado === p.prontuarioId}
                      onClick={() => void executar("recusar-acesso", p.prontuarioId)}
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      className="btn-prof"
                      disabled={ocupado === p.prontuarioId}
                      onClick={() => void executar("aprovar-acesso", p.prontuarioId)}
                    >
                      Aprovar
                    </button>
                  </div>
                </li>
              ))}
            </Secao>

            <Secao titulo="Acessos vigentes" total={vigentes.length} vazio="Nenhum acesso vigente.">
              {vigentes.map((v) => (
                <li key={v.prontuarioId} className="rounded-card border border-line bg-raised p-4">
                  <div className="flex items-start gap-3">
                    <Avatar nome={v.pacienteNome} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-ink">{v.pacienteNome}</div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-soft">Aluno: {v.alunoNome}</div>
                      <TimerAcesso
                        expiraEm={v.acessoExpiraEm}
                        className="mt-0.5 block text-[12px] font-semibold text-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-alt mt-3"
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
