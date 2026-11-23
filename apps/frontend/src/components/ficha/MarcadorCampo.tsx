import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X } from "lucide-react";

const OPCOES = [
  "Não informado",
  "NDN",
  "Não se aplica",
] as const;

interface Props {
  onSelecionar: (valor: string) => void;
}

export default function MarcadorCampo({ onSelecionar }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !raiz.current?.contains(evento.target) && !menu.current?.contains(evento.target)) setAberto(false);
    };
    const fecharEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="absolute inset-y-0 right-1 z-20 w-8">
      <button
        type="button"
        aria-label="Preencher com uma opção"
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        className="absolute inset-0 flex items-center justify-center rounded-full text-ink-faint transition hover:bg-paper hover:text-ink-soft"
      >
        <MoreHorizontal size={19} aria-hidden="true" />
      </button>
      {aberto && typeof document !== "undefined" && createPortal(
        <>
          <button
            type="button"
            aria-label="Fechar opções"
            className="fixed inset-0 z-[999] cursor-default bg-black/20"
            onClick={() => setAberto(false)}
          />
          <div
            ref={menu}
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[1000] mx-auto max-w-md rounded-2xl border border-line bg-raised p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Preencher campo</p>
              <button
                type="button"
                aria-label="Fechar menu de opções"
                onClick={() => setAberto(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition hover:bg-paper hover:text-ink"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            {OPCOES.map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => {
                  onSelecionar(opcao);
                  setAberto(false);
                }}
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[13px] text-ink transition hover:bg-paper active:bg-paper"
              >
                {opcao}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
