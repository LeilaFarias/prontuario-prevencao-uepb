export type NotaEscala = 0 | 1 | 2 | 3;

interface Props {
  label: string;
  descricao?: string;
  value: NotaEscala | null;
  onChange: (valor: NotaEscala | null) => void;
  disabled?: boolean;
}

const NOTAS: ReadonlyArray<NotaEscala> = [0, 1, 2, 3];

const ESTILO_SELECIONADO: Record<NotaEscala, string> = {
  0: "border-[#1F6F64] bg-[#8FC4BB] text-[#124840]",
  1: "border-[#9C7A23] bg-[#E3CB8A] text-[#5E4710]",
  2: "border-[#B1602E] bg-[#E8AE86] text-[#6B3512]",
  3: "border-[#A6543C] bg-[#DE9F8D] text-[#6A2D1D]",
};

export default function EscalaIHOS({ label, descricao, value, onChange, disabled = false }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-line-soft py-2.5 last:border-b-0">
      <span className="w-14 shrink-0 font-display text-[13px] font-semibold text-ink">{label}</span>
      <div role="group" aria-label={descricao ?? label} className="flex flex-1 gap-1.5">
        {NOTAS.map((nota) => {
          const selecionada = value === nota;
          return (
            <button
              key={nota}
              type="button"
              disabled={disabled}
              aria-pressed={selecionada}
              aria-label={`${descricao ?? label}: nota ${nota}`}
              onClick={() => onChange(selecionada ? null : nota)}
              className={`flex h-9 flex-1 items-center justify-center rounded-md border-[1.5px] text-[12px] font-bold transition-colors duration-150 ${
                selecionada ? ESTILO_SELECIONADO[nota] : "border-line bg-raised text-ink-faint"
              } ${disabled ? "cursor-default" : ""}`}
            >
              {nota}
            </button>
          );
        })}
      </div>
    </div>
  );
}
