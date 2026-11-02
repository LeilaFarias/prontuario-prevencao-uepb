import { RotateCcw } from "lucide-react";
import { ROTULO_MOTIVO_DEVOLUCAO, type MotivoDevolucao } from "@prontuario/shared";
import type { LocalProntuario } from "../db/dexie";
import BottomSheet from "./BottomSheet";
import { formatarDataHoraCompleta } from "./ficha/revisao/rotulos";
import { Detalhes, IconeModal } from "./revisao/ModalPartes";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuario: LocalProntuario;
  onCorrigir: () => void;
  onVerFicha?: () => void;
}

export default function DevolucaoAlunoModal({ open, onClose, prontuario, onCorrigir, onVerFicha }: Props) {
  const motivo = prontuario.motivoDevolucao
    ? (ROTULO_MOTIVO_DEVOLUCAO[prontuario.motivoDevolucao as MotivoDevolucao] ?? prontuario.motivoDevolucao)
    : "";
  const comentario = prontuario.comentarioDevolucao?.trim() ?? "";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      centralizado
      title="Prontuário devolvido"
      subtitle="O professor devolveu o prontuário para correção."
      icone={
        <IconeModal tom="alt">
          <RotateCcw size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes
          linhas={[
            ["Paciente", prontuario.pacienteNome.trim()],
            ["Devolvido por", prontuario.devolvidoPorNome ?? ""],
            ["Em", formatarDataHoraCompleta(prontuario.devolvidoEm)],
            ["Motivo", motivo],
          ]}
        />

        <div className="rounded-field bg-paper p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
            Comentário do professor
          </p>
          <p className="whitespace-pre-wrap break-words text-[13.5px] text-ink">
            {comentario || "Sem comentário adicional."}
          </p>
        </div>

        <button type="button" className="btn-primary" onClick={onCorrigir}>
          Corrigir e reenviar
        </button>
        {onVerFicha && (
          <button type="button" className="btn-ghost" onClick={onVerFicha}>
            Ver ficha (somente leitura)
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
