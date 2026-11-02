import { useEffect } from "react";
import { X } from "lucide-react";

interface VisualizadorProps {
  src: string;
  nome: string;
  onFechar: () => void;
}

/** Visualizador em tela cheia (somente leitura: o professor não remove fotos do aluno). Fecha com X ou ESC. */
export default function VisualizadorFoto({ src, nome, onFechar }: VisualizadorProps) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onFechar]);

  return (
    <div role="dialog" aria-modal="true" aria-label={nome} className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <header className="flex items-center justify-between gap-3 px-5 py-4 text-white">
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{nome}</p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <X size={18} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={onFechar}>
        <img
          src={src}
          alt={nome}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
}

/** Miniatura clicável que abre o visualizador. */
export function MiniaturaFoto({
  src,
  nome,
  onAbrir,
  className = "",
}: {
  src: string;
  nome: string;
  onAbrir: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ampliar foto ${nome}`}
      className={`overflow-hidden rounded-field border border-line bg-paper ${className}`}
    >
      <img src={src} alt={nome} className="h-full w-full object-cover" />
    </button>
  );
}
