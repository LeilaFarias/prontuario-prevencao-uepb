import { useId } from "react";

export interface OpcaoCampo {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  options: ReadonlyArray<OpcaoCampo>;
  disabled?: boolean;
  placeholder?: string;
}

export default function CampoSelect({ label, value, onChange, options, disabled, placeholder = "Selecione" }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        className="input disabled:bg-paper disabled:text-ink-soft"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
