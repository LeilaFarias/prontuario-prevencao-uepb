import { Clock, Loader2, Lock, X } from "lucide-react";
import type { LocalProntuario } from "../db/dexie";
import { pedidoPendente } from "../lib/acesso";
import Topbar from "./Topbar";

interface Props {
  prontuario: LocalProntuario;
  professorNome: string | null;
  avisoExpirado: boolean;
  onDispensarAviso: () => void;
  onSolicitarAcesso: () => void;
  onVoltar: () => void;
}

function textoBloqueio(status: LocalProntuario["status"]): string {
  if (status === "enviado") {
    return "Aguardando revisão do professor. Você receberá acesso quando ele devolver ou assinar.";
  }
  if (status === "assinado") {
    return "Este prontuário foi assinado. Para consultar ou editar, solicite acesso.";
  }
  return "Seu acesso expirou. Solicite liberação para continuar editando.";
}

export default function TelaBloqueio({
  prontuario,
  professorNome,
  avisoExpirado,
  onDispensarAviso,
  onSolicitarAcesso,
  onVoltar,
}: Props) {
  const nome = prontuario.pacienteNome.trim() || "Prontuário";
  const pendente = pedidoPendente(prontuario);
  const podeSolicitar = prontuario.status !== "enviado" && !pendente;

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo={nome}
        subtitulo="Acesso restrito"
        tituloClassName="text-[18px]"
        onVoltar={onVoltar}
      />

      {avisoExpirado && (
        <div role="alert" className="banner-erro mx-5 mb-2 flex items-center gap-2">
          <span className="min-w-0 flex-1">Acesso expirado.</span>
          <button
            type="button"
            onClick={onDispensarAviso}
            aria-label="Dispensar aviso"
            className="shrink-0 opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <main className="flex flex-1 items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-card border border-line-soft bg-raised p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
            <Lock size={28} aria-hidden="true" />
          </div>

          <h2 className="mt-4 font-display text-[18px] font-medium text-ink">Prontuário bloqueado</h2>
          <p className="mt-2 text-[13.5px] text-ink-soft">{textoBloqueio(prontuario.status)}</p>

          {professorNome && (
            <p className="mt-2 text-[13px] text-ink-soft">
              Professor responsável: <span className="font-medium text-ink">{professorNome}</span>
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            {pendente ? (
              <button
                type="button"
                disabled
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Aguardando aprovação
              </button>
            ) : podeSolicitar ? (
              <button type="button" onClick={onSolicitarAcesso} className="btn-primary">
                Solicitar acesso
              </button>
            ) : (
              <button type="button" disabled className="btn-primary">
                <Clock size={16} aria-hidden="true" />
                Aguardando revisão do professor
              </button>
            )}
            <button type="button" onClick={onVoltar} className="btn-ghost">
              Voltar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}