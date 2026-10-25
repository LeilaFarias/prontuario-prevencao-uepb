import { useId, type HTMLInputTypeAttribute, type InputHTMLAttributes } from "react";

export interface CampoTextoProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: HTMLInputTypeAttribute;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
}

export default function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
  inputMode,
  autoComplete = "off",
  maxLength,
}: CampoTextoProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="input disabled:bg-paper disabled:text-ink-soft"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
  );
}
