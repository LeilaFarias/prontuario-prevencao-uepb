import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel max-h-[92dvh] w-full max-w-[390px] overflow-y-auto rounded-t-[22px] bg-raised px-5 pt-2.5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto h-1 w-[38px] rounded-pill bg-line" />
        <h2 className="mt-4 font-display text-[18px] font-medium text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[12.5px] text-ink-soft">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
