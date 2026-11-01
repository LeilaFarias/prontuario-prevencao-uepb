import { NOMES_FACE, QUADRANTES, type Arcada, type DentesSangramento, type Face } from "../../lib/odontograma";

interface Props {
  dentes: DentesSangramento;
  onToggleDente: (numero: number) => void;
  onToggleFace: (numero: number, face: Face) => void;
  disabled?: boolean;
}

const FACES_LINHAS: Record<Arcada, readonly [Face, Face]> = {
  superior: ["V", "P"],
  inferior: ["L", "V"],
};

interface BlocoProps extends Props {
  numeros: ReadonlyArray<number>;
  arcada: Arcada;
  estreito?: boolean;
}

function RotuloFace({ face }: { face: Face }) {
  return <span className="text-center text-[9px] font-bold text-ink-faint">{face}</span>;
}

function BlocoDentes({ numeros, arcada, estreito = false, dentes, onToggleDente, onToggleFace, disabled }: BlocoProps) {
  const [faceTopo, faceBase] = FACES_LINHAS[arcada];

  const botaoFace = (numero: number, face: Face) => {
    const dente = dentes[String(numero)];
    const presente = Boolean(dente?.presente);
    const valor = dente?.faces[face] === 1 ? 1 : 0;
    return (
      <button
        key={`${numero}-${face}`}
        type="button"
        disabled={disabled || !presente}
        aria-pressed={valor === 1}
        aria-label={`Dente ${numero}, face ${NOMES_FACE[face]}: ${valor === 1 ? "com sangramento" : "sem sangramento"}`}
        onClick={() => onToggleFace(numero, face)}
        className={`flex min-h-[22px] items-center justify-center rounded-[5px] border-[1.5px] text-[10.5px] font-bold transition ${
          valor === 1 ? "border-alt bg-alt-tint text-alt" : "border-line bg-raised text-ink-faint"
        } ${presente ? "" : "pointer-events-none opacity-35"} ${disabled ? "cursor-default" : ""}`}
      >
        {valor}
      </button>
    );
  };

  return (
    <div
      className="grid gap-[3px]"
      style={{
        gridTemplateColumns: `18px repeat(${numeros.length}, 1fr)`,
        padding: estreito ? "0 9%" : undefined,
      }}
    >
      <RotuloFace face={faceTopo} />
      {numeros.map((n) => botaoFace(n, faceTopo))}

      <span aria-hidden="true" />
      {numeros.map((n) => {
        const presente = Boolean(dentes[String(n)]?.presente);
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={presente}
            aria-label={`Dente ${n}: ${presente ? "presente" : "não presente"}`}
            onClick={() => onToggleDente(n)}
            className={`h-7 w-7 justify-self-center rounded-full border-[1.5px] text-[10.5px] transition ${
              presente ? "border-primary bg-primary-tint font-bold text-primary" : "border-line bg-raised font-semibold text-ink-faint"
            } ${disabled ? "cursor-default" : ""}`}
          >
            {n}
          </button>
        );
      })}

      <RotuloFace face={faceBase} />
      {numeros.map((n) => botaoFace(n, faceBase))}
    </div>
  );
}

export default function GridSangramento(props: Props) {
  return (
    <div className="flex flex-col gap-5">
      {QUADRANTES.map((q) => (
        <div key={q.nome}>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{q.nome}</h4>
          <BlocoDentes {...props} numeros={q.permanentes} arcada={q.arcada} />
          <div className="h-1.5" />
          <BlocoDentes {...props} numeros={q.deciduos} arcada={q.arcada} estreito />
        </div>
      ))}
    </div>
  );
}
