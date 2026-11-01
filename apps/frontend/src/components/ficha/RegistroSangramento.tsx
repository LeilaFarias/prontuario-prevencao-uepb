import { useMemo } from "react";
import type { RegistroSangramentoDados } from "@prontuario/shared";
import { calcularSG, denteVazio, gerarDentesVazios, type DentesSangramento, type Face } from "../../lib/odontograma";
import CampoData from "./CampoData";
import GridSangramento from "./GridSangramento";

interface Props {
  registro: RegistroSangramentoDados;
  indice: number;
  onChange: (parcial: Partial<Pick<RegistroSangramentoDados, "data" | "dentes">>) => void;
  onRemover?: () => void;
  disabled?: boolean;
}

function Swatch({ valor, sangrando }: { valor: string; sangrando: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold ${
        sangrando ? "border-alt bg-alt-tint text-alt" : "border-line-soft bg-raised text-ink-faint"
      }`}
    >
      {valor}
    </span>
  );
}

function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "Sem data";
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default function RegistroSangramento({ registro, indice, onChange, onRemover, disabled = false }: Props) {
  const dentes: DentesSangramento = useMemo(
    () => ({ ...gerarDentesVazios(), ...registro.dentes }),
    [registro.dentes],
  );
  const resultado = useMemo(() => calcularSG(dentes), [dentes]);
  const comSangramento = resultado.facesSangrantes > 0;

  const alternarDente = (numero: number) => {
    const chave = String(numero);
    const atual = dentes[chave] ?? denteVazio();
    onChange({ dentes: { ...dentes, [chave]: atual.presente ? denteVazio() : { ...atual, presente: true } } });
  };

  const alternarFace = (numero: number, face: Face) => {
    const chave = String(numero);
    const atual = dentes[chave] ?? denteVazio();
    if (!atual.presente) return;
    onChange({
      dentes: { ...dentes, [chave]: { ...atual, faces: { ...atual.faces, [face]: atual.faces[face] === 1 ? 0 : 1 } } },
    });
  };

  return (
    <section className="rounded-card border border-line bg-raised p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{formatarData(registro.data)}</p>
        </div>
        {onRemover && !disabled && (
          <button
            type="button"
            onClick={onRemover}
            className="text-[11px] font-semibold text-ink-faint hover:text-alt"
          >
            Remover
          </button>
        )}
      </div>

      <CampoData
        label="Data do exame"
        value={registro.data}
        onChange={(v) => onChange({ data: v })}
        disabled={disabled}
      />

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-ink-soft">
        <span className="flex items-center gap-2">
          <Swatch valor="0" sangrando={false} />
          Sem sangramento
        </span>
        <span className="flex items-center gap-2">
          <Swatch valor="1" sangrando />
          Com sangramento
        </span>
        <p className="basis-full">Dente circulado = presente na boca</p>
        <p className="basis-full">V = vestibular · P = palatina (sup.) · L = lingual (inf.)</p>
      </div>

      <GridSangramento
        dentes={dentes}
        onToggleDente={alternarDente}
        onToggleFace={alternarFace}
        disabled={disabled}
      />

      <div
        className={`mt-4 rounded-field border p-4 text-center ${
          comSangramento ? "border-alt bg-alt-tint" : "border-primary bg-primary-tint"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Sangramento gengival (SG)</p>
        <p className={`font-display text-[36px] font-medium leading-tight ${comSangramento ? "text-alt" : "text-primary"}`}>
          {formatarPercentual(resultado.percentual)}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          {resultado.dentesPresentes} {resultado.dentesPresentes === 1 ? "dente presente" : "dentes presentes"} ·{" "}
          {resultado.facesSangrantes} {resultado.facesSangrantes === 1 ? "face com sangramento" : "faces com sangramento"}
        </p>
        <p className="mt-1 text-[11px] text-ink-faint">SG = (faces sangrantes × 100) ÷ (dentes presentes × 2)</p>
      </div>
    </section>
  );
}
