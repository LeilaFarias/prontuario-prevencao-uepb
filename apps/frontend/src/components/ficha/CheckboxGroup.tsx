import { useId } from "react";
import { Check } from "lucide-react";

export interface OpcaoCheckbox {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  options: ReadonlyArray<OpcaoCheckbox>;
  values: string[];
  onChange: (novosValores: string[]) => void;
  disabled?: boolean;
}

export default function CheckboxGroup({ label, options, values, onChange, disabled = false }: Props) {
  const rotuloId = useId();

  const alternar = (valor: string) => {
    if (disabled) return;
    onChange(values.includes(valor) ? values.filter((v) => v !== valor) : [...values, valor]);
  };

  return (
    <div>
      {label && (
        <span id={rotuloId} className="field-label">
          {label}
        </span>
      )}
      <div
        role="group"
        aria-labelledby={label ? rotuloId : undefined}
        className="mt-1.5 flex flex-wrap gap-2"
      >
        {options.map((o) => {
          const marcado = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={marcado}
              disabled={disabled}
              onClick={() => alternar(o.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              } ${
                marcado ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line bg-raised text-ink-soft"
              }`}
            >
              {marcado && <Check size={12} aria-hidden="true" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
