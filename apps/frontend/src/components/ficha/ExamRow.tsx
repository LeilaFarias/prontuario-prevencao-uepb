export type ResultadoExame = "normal" | "alteracao";

interface Props {
  label: string;
  value: ResultadoExame | null;
  onChange: (valor: ResultadoExame | null) => void;
  disabled?: boolean;
}

const BASE = "rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition";
const INATIVO = "border-line bg-raised text-ink-faint";

export default function ExamRow({ label, value, onChange, disabled = false }: Props) {
  const alternar = (alvo: ResultadoExame) => {
    if (disabled) return;
    onChange(value === alvo ? null : alvo);
  };

  const estadoDesabilitado = disabled ? "cursor-not-allowed opacity-60" : "";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-b-0">
      <span className="text-[14px] font-medium text-ink">{label}</span>
      <div role="group" aria-label={label} className="flex shrink-0 gap-1.5">
        <button
          type="button"
          aria-pressed={value === "normal"}
          disabled={disabled}
          onClick={() => alternar("normal")}
          className={`${BASE} ${estadoDesabilitado} ${
            value === "normal" ? "border-primary bg-primary-tint text-primary" : INATIVO
          }`}
        >
          Normal
        </button>
        <button
          type="button"
          aria-pressed={value === "alteracao"}
          disabled={disabled}
          onClick={() => alternar("alteracao")}
          className={`${BASE} ${estadoDesabilitado} ${
            value === "alteracao" ? "border-alt bg-alt-tint text-alt" : INATIVO
          }`}
        >
          Com alteração
        </button>
      </div>
    </div>
  );
}
