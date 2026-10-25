import CampoTexto from "./CampoTexto";

export type ResultadoExame = "normal" | "alteracao";

interface Props {
  label: string;
  value: ResultadoExame | null;
  onChange: (valor: ResultadoExame | null) => void;
  disabled?: boolean;
  observacao?: string;
  onObservacaoChange?: (texto: string) => void;
}

const BASE = "rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition";
const INATIVO = "border-line bg-raised text-ink-faint";

export default function ExamRow({ label, value, onChange, disabled = false, observacao, onObservacaoChange }: Props) {
  const alternar = (alvo: ResultadoExame) => {
    if (disabled) return;
    onChange(value === alvo ? null : alvo);
  };

  const estadoDesabilitado = disabled ? "cursor-not-allowed opacity-60" : "";

  return (
    <div className="border-b border-line-soft py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
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
      {value === "alteracao" && onObservacaoChange && (
        <div className="mt-2.5">
          <CampoTexto
            label="Descreva a alteração"
            value={observacao ?? ""}
            onChange={onObservacaoChange}
            placeholder="Registre a alteração observada"
            multiline
            rows={2}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
