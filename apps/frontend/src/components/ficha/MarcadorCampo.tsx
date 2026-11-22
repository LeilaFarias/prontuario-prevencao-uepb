import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

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

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !raiz.current?.contains(evento.target)) setAberto(false);
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
      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar opções"
            className="fixed inset-0 z-40 cursor-default bg-black/20 md:bg-transparent"
            onClick={() => setAberto(false)}
          />
          <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-line bg-raised p-2 shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-1 md:w-64 md:rounded-xl">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint md:hidden">Preencher campo</p>
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
        </>
      )}
    </div>
  );
}
