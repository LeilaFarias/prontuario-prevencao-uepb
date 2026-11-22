import { NOMES_FACE, type Arcada, type DentesSangramento, type Face } from "../../lib/odontograma";
import OdontogramaHorizontal from "./OdontogramaHorizontal";

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

export default function GridSangramento({ dentes, onToggleDente, onToggleFace, disabled }: Props) {
  const botaoFace = (numero: number, face: Face) => {
    const dente = dentes[String(numero)];
    const presente = Boolean(dente?.presente);
    const valor = dente?.faces[face] === 1 ? 1 : 0;
    return (
      <button
        type="button"
        disabled={disabled || !presente}
        aria-pressed={valor === 1}
        aria-label={`Dente ${numero}, face ${NOMES_FACE[face]}: ${valor === 1 ? "com sangramento" : "sem sangramento"}`}
        onClick={() => onToggleFace(numero, face)}
        className={`flex min-h-[24px] items-center justify-center gap-0.5 rounded-[5px] border-[1.5px] text-[10.5px] font-bold transition ${
          valor === 1 ? "border-alt bg-alt-tint text-alt" : "border-line bg-raised text-ink-faint"
        } ${presente ? "" : "pointer-events-none opacity-35"} ${disabled ? "cursor-default" : ""}`}
      >
        <span className="text-[8.5px] font-semibold opacity-60">{face}</span>
        {valor}
      </button>
    );
  };

  const renderDente = (numero: number, _deciduo: boolean, arcada: Arcada) => {
    const [faceTopo, faceBase] = FACES_LINHAS[arcada];
    const presente = Boolean(dentes[String(numero)]?.presente);
    return (
      <div className="flex flex-col gap-[3px]">
        {botaoFace(numero, faceTopo)}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={presente}
          aria-label={`Dente ${numero}: ${presente ? "presente" : "não presente"}`}
          onClick={() => onToggleDente(numero)}
          className={`h-7 w-7 self-center rounded-full border-[1.5px] text-[10.5px] transition ${
            presente ? "border-primary bg-primary-tint font-bold text-primary" : "border-line bg-raised font-semibold text-ink-faint"
          } ${disabled ? "cursor-default" : ""}`}
        >
          {numero}
        </button>
        {botaoFace(numero, faceBase)}
      </div>
    );
  };

  return <OdontogramaHorizontal renderDente={renderDente} />;
}