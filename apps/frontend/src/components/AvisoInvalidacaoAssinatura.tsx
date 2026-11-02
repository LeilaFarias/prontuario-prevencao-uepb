import { AlertTriangle } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { IconeModal } from "./revisao/ModalPartes";

interface Props {
  open: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export default function AvisoInvalidacaoAssinatura({ open, onCancelar, onConfirmar }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onCancelar}
      centralizado
      title="Atenção"
      icone={
        <IconeModal tom="alt">
          <AlertTriangle size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-center text-[13.5px] text-ink-soft">
          Ao editar, a assinatura anterior será invalidada. O prontuário voltará para “em andamento” e precisará ser
          reenviado e reassinado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirmar}>
            Entendi, editar
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
