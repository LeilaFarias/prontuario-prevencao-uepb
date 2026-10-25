import { useId } from "react";

interface Opcao<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  /** null = nenhuma opção marcada. */
  value: T | null;
  onChange: (valor: T) => void;
  options: ReadonlyArray<Opcao<T>>;
  disabled?: boolean;
}

export default function SegmentedToggle<T extends string>({ label, value, onChange, options, disabled }: Props<T>) {
  const rotuloId = useId();
  return (
    <div>
      <span id={rotuloId} className="field-label">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={rotuloId}
        className="flex gap-2 rounded-field border border-line-soft bg-paper p-1"
      >
        {options.map((o) => {
          const ativo = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`h-10 flex-1 rounded-[8px] text-[14px] font-medium transition disabled:cursor-not-allowed ${
                ativo ? "bg-raised text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
