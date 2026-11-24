import { useState } from "react";
import { Check, Clock, RotateCcw } from "lucide-react";
import { ROTULO_MOTIVO_DEVOLUCAO, type MotivoDevolucao } from "@prontuario/shared";
import type { ProntuarioRevisao } from "../../hooks/useProntuario";
import BottomSheet from "../BottomSheet";
import { formatarDataHoraCompleta } from "../ficha/revisao/rotulos";

const PILL = "inline-flex w-fit items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold";

export default function StatusBanner({ prontuario }: { prontuario: ProntuarioRevisao }) {
  const [verComentario, setVerComentario] = useState(false);
  const status = prontuario.status.toUpperCase();

  if (status === "ASSINADO") {
    const quando = formatarDataHoraCompleta(prontuario.assinadoEm);
    return (
      <div className="flex">
        <span className={`${PILL} bg-primary-tint text-primary`}>
          <Check size={12} aria-hidden="true" />
          {`Assinado por ${prontuario.assinadoPorNome ?? "professor"}${quando ? ` em ${quando}` : ""}`}
        </span>
      </div>
    );
  }

  if (status === "DEVOLVIDO") {
    const quando = formatarDataHoraCompleta(prontuario.devolvidoEm);
    const motivo = prontuario.motivoDevolucao
      ? (ROTULO_MOTIVO_DEVOLUCAO[prontuario.motivoDevolucao as MotivoDevolucao] ?? prontuario.motivoDevolucao)
      : "";
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILL} bg-alt-tint text-alt`}>
          <RotateCcw size={12} aria-hidden="true" />
          {quando ? `Devolvido em ${quando}` : "Devolvido ao aluno"}
        </span>
        <button
          type="button"
          onClick={() => setVerComentario(true)}
          className="text-[12.5px] font-semibold text-prof underline"
        >
          Ver comentário
        </button>
        <BottomSheet
          open={verComentario}
          onClose={() => setVerComentario(false)}
          title="Comentário do professor"
          subtitle={prontuario.devolvidoPorNome ?? undefined}
        >
          <div className="flex flex-col gap-3">
            {motivo && (
              <p className="text-[13px] text-ink-soft">
                <span className="font-semibold text-ink">Motivo:</span> {motivo}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words rounded-card border border-line-soft bg-paper p-4 text-[14px] text-ink">
              {prontuario.comentarioDevolucao || "Sem comentário registrado."}
            </p>
            <button type="button" className="btn-ghost" onClick={() => setVerComentario(false)}>
              Fechar
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="flex">
      <span className={`${PILL} bg-sync-tint text-sync`}>
        <Clock size={12} aria-hidden="true" />
        Aguardando revisão
      </span>
    </div>
  );
}
