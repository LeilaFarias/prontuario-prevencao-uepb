import { useId } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
  max?: string;
}

function hojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function CampoData({ label, value, onChange, disabled, max }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="input min-w-0 disabled:bg-paper disabled:text-ink-soft"
        value={value}
        max={max ?? hojeISO()}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
