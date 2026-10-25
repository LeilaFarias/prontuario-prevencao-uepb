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
  multiline?: boolean;
  rows?: number;
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
  multiline = false,
  rows = 3,
}: CampoTextoProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="input !h-auto min-h-[80px] resize-none py-3 leading-snug disabled:bg-paper disabled:text-ink-soft"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
        />
      ) : (
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
      )}
    </div>
  );
}
