import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  titulo: string;
  subtitulo?: string;
  onVoltar?: () => void;
  acao?: ReactNode;
  tituloClassName?: string;
}

export default function Topbar({ titulo, subtitulo, onVoltar, acao, tituloClassName = "text-[22px]" }: Props) {
  return (
    <header className="flex items-center gap-3 px-5 pb-3 pt-5">
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-ink"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className={`truncate font-display font-medium leading-tight text-ink ${tituloClassName}`}>{titulo}</h1>
        {subtitulo && <p className="truncate text-[12.5px] text-ink-soft">{subtitulo}</p>}
      </div>
      {acao}
    </header>
  );
}
