import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  const tituloId = useId();
  const botaoFechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botaoFechar.current?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(18,22,18,0.45)] backdrop-blur-[3px] animate-overlay-in motion-reduce:animate-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-raised p-6 pb-8 animate-sheet-up motion-reduce:animate-none"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-[38px] rounded-full bg-line" />
        <button
          ref={botaoFechar}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-paper text-ink-soft"
        >
          <X size={16} />
        </button>
        <h2 id={tituloId} className="pr-10 font-display text-[18px] font-medium text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-soft">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
