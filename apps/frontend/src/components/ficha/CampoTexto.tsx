import { useId, type HTMLInputTypeAttribute, type InputHTMLAttributes } from "react";
import MarcadorCampo from "./MarcadorCampo";

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
  obrigatorio?: boolean;
  permiteMarcador?: boolean;
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
  obrigatorio = false,
  permiteMarcador = true,
}: CampoTextoProps) {
  const id = useId();
  const mostrarMarcador = permiteMarcador && !disabled && value.trim() === "";
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {obrigatorio && (
          <span aria-hidden="true" className="ml-0.5 text-alt">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea
            id={id}
            className="input !h-auto min-h-[80px] resize-none py-3 pr-10 leading-snug disabled:bg-paper disabled:text-ink-soft"
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
            className="input pr-10 disabled:bg-paper disabled:text-ink-soft"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            inputMode={inputMode}
            autoComplete={autoComplete}
            maxLength={maxLength}
          />
        )}
        {mostrarMarcador && <MarcadorCampo onSelecionar={onChange} />}
      </div>
    </div>
  );
}
