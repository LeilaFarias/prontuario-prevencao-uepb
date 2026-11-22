import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RotateCw, Smartphone, X } from "lucide-react";
import { ARCADAS, type Arcada } from "../../lib/odontograma";

interface Props {
  renderDente: (numero: number, deciduo: boolean, arcada: Arcada) => ReactNode;
}

type OrientacaoTela = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

const COLUNAS = "repeat(7, minmax(0, 1fr)) 10px repeat(7, minmax(0, 1fr))";

function colunaGrid(posicao: number): number {
  return posicao < 7 ? posicao + 1 : posicao + 2;
}

function Linha({
  numeros,
  deciduo,
  arcada,
  renderDente,
}: {
  numeros: ReadonlyArray<number>;
  deciduo: boolean;
  arcada: Arcada;
  renderDente: Props["renderDente"];
}) {
  const deslocamento = deciduo ? 2 : 0;
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: COLUNAS }}>
      {numeros.map((n, i) => (
        <div key={n} className="min-w-0" style={{ gridColumn: colunaGrid(i + deslocamento) }}>
          {renderDente(n, deciduo, arcada)}
        </div>
      ))}
    </div>
  );
}

function Arcadas({ renderDente }: Props) {
  return (
    <div className="relative flex flex-col gap-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line-soft" />

      {ARCADAS.map((a) => {
        const permanentes = (
          <Linha numeros={a.permanentes} deciduo={false} arcada={a.arcada} renderDente={renderDente} />
        );
        const deciduos = <Linha numeros={a.deciduos} deciduo arcada={a.arcada} renderDente={renderDente} />;
        return (
          <div key={a.arcada} role="group" aria-label={a.nome}>
            <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider">
              <span className="text-ink-faint">Direito</span>
              <h4 className="relative z-10 bg-raised px-2 text-ink-soft">{a.nome}</h4>
              <span className="text-right text-ink-faint">Esquerdo</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {permanentes}
              {deciduos}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TelaCheia({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;

  useEffect(() => {
    const medir = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharRef.current();
    };
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    let entrou = false;
    const orientacao = screen.orientation as OrientacaoTela | undefined;
    const aoMudarTela = () => {
      if (entrou && !document.fullscreenElement) fecharRef.current();
    };
    document.addEventListener("fullscreenchange", aoMudarTela);

    if (window.matchMedia("(pointer: coarse)").matches && document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          if (!ativo) return undefined;
          entrou = true;
          return orientacao?.lock?.("landscape");
        })
        .catch(() => undefined);
    }

    return () => {
      ativo = false;
      entrou = false;
      document.removeEventListener("fullscreenchange", aoMudarTela);
      orientacao?.unlock?.();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const retrato = vp.h > vp.w;
  const estilo: CSSProperties = retrato
    ? {
        position: "fixed",
        top: 0,
        left: vp.w,
        width: vp.h,
        height: vp.w,
        transformOrigin: "top left",
        transform: "rotate(90deg)",
      }
    : { position: "fixed", top: 0, left: 0, width: vp.w, height: vp.h };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Odontograma em tela cheia" className="z-30 flex flex-col bg-raised" style={estilo}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-soft px-4 py-2">
        <h3 className="font-display text-[15px] font-semibold text-ink">Odontograma</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink-soft"
        >
          <X size={14} aria-hidden="true" />
          Fechar
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="min-w-[620px]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default function OdontogramaHorizontal({ renderDente }: Props) {
  const [ampliado, setAmpliado] = useState(false);
  const fechar = useCallback(() => setAmpliado(false), []);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAmpliado(true)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft"
        >
          <Smartphone size={14} aria-hidden="true" />
          <RotateCw size={12} aria-hidden="true" />
          Ver em tela cheia
        </button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[540px]">
          <Arcadas renderDente={renderDente} />
        </div>
      </div>

      {ampliado && (
        <TelaCheia onClose={fechar}>
          <Arcadas renderDente={renderDente} />
        </TelaCheia>
      )}
    </div>
  );
}