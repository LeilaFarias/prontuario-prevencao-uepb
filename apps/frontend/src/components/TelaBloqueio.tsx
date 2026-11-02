import type { LocalProntuario, LocalStatus } from "../db/dexie";
import { pedidoPendente, pedidoRecusado } from "../lib/acesso";
import StatusBar from "./StatusBar";
import Topbar from "./Topbar";
import { Check, CircleAlert, Lock, RotateCcw, Send, WifiOff, type LucideIcon } from "lucide-react";

interface Props {
  prontuario: LocalProntuario;
  professorNome: string | null;
  onSolicitarAcesso: () => void;
  onSolicitarManual: () => void;
  onVoltar: () => void;
}

const PILL = "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold";

const STATUS_META: Record<LocalStatus, { label: string; className: string; Icone: LucideIcon }> = {
  em_andamento: { label: "Em andamento", className: "bg-sync-tint text-sync", Icone: Send },
  enviado: { label: "Enviado", className: "bg-sync-tint text-sync", Icone: Send },
  assinado: { label: "Assinado", className: "bg-primary-tint text-primary", Icone: Check },
  devolvido: { label: "Devolvido", className: "bg-alt-tint text-alt", Icone: RotateCcw },
};

export default function TelaBloqueio({
  prontuario,
  professorNome,
  onSolicitarAcesso,
  onSolicitarManual,
  onVoltar,
}: Props) {
  const nome = prontuario.pacienteNome.trim() || "Prontuário";
  const pendente = pedidoPendente(prontuario);
  const recusado = pedidoRecusado(prontuario);
  const meta = STATUS_META[prontuario.status];
  const podeSolicitar = prontuario.status !== "enviado";

  const mensagem = recusado
    ? "O professor recusou o pedido de acesso. Você pode solicitar novamente."
    : prontuario.status === "enviado"
      ? "Aguardando revisão do professor. Você receberá acesso quando ele devolver ou assinar."
      : prontuario.status === "assinado"
        ? "Este prontuário foi assinado. Para consultar ou editar, solicite acesso."
        : "O acesso a este prontuário expirou. Peça a liberação para continuar editando.";

  const titulo = recusado ? "Acesso recusado" : "Prontuário bloqueado para edição";
  const estiloIcone = recusado ? "bg-alt-tint text-alt" : "bg-primary-tint text-primary";

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo={nome}
        subtitulo="Prontuário bloqueado"
        tituloClassName="text-[18px]"
        onVoltar={onVoltar}
      />
      <StatusBar className="mx-5 mb-2" />

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-2">
        <section className="rounded-card border border-line-soft bg-raised p-6 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${estiloIcone}`}>
            {recusado ? <CircleAlert size={28} aria-hidden="true" /> : <Lock size={28} aria-hidden="true" />}
          </div>
          <h2 className="mt-4 font-display text-[17px] font-semibold text-ink">{titulo}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{mensagem}</p>
          <div className="mt-3 flex justify-center">
            <span className={`${PILL} ${meta.className}`}>
              <meta.Icone size={11} aria-hidden="true" />
              {meta.label}
            </span>
          </div>
        </section>

        <section className="rounded-card border border-line-soft bg-raised p-4">
          <h3 className="font-display text-[14px] font-medium text-ink">Detalhes do prontuário</h3>
          <dl className="mt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Paciente</dt>
              <dd className="text-right text-[13px] font-medium text-ink">{nome}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Professor supervisor</dt>
              <dd className="text-right text-[13px] font-medium text-ink">{professorNome ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12.5px] text-ink-soft">Status</dt>
              <dd>
                <span className={`${PILL} ${meta.className}`}>
                  <meta.Icone size={11} aria-hidden="true" />
                  {meta.label}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-card border border-line-soft bg-raised p-4">
          <h3 className="font-display text-[14px] font-medium text-ink">Solicitar acesso temporário</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            O professor responsável precisa aprovar. A liberação vale por 4 horas.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-alt-tint p-3">
            <WifiOff size={16} className="mt-0.5 shrink-0 text-alt" aria-hidden="true" />
            <p className="text-[12px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">Sem internet?</strong>{" "}
              Peça ao professor para liberar manualmente no seu aparelho.
            </p>
          </div>
        </section>
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-paper px-5 py-3">
        {pendente ? (
          <button type="button" disabled className="btn-primary">
            Aguardando aprovação
          </button>
        ) : recusado ? (
          <button type="button" className="btn-primary" onClick={onSolicitarAcesso}>
            Solicitar novamente
          </button>
        ) : podeSolicitar ? (
          <button type="button" className="btn-primary" onClick={onSolicitarAcesso}>
            Solicitar acesso ao professor
          </button>
        ) : (
          <button type="button" disabled className="btn-primary">
            Aguardando revisão do professor
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onSolicitarManual}>
          Solicitar acesso manual
        </button>
      </footer>
    </div>
  );
}