export type NotaEscala = 0 | 1 | 2 | 3;

interface Props {
  label: string;
  descricao?: string;
  value: NotaEscala | null;
  onChange: (valor: NotaEscala | null) => void;
  ausente: boolean;
  onAusenteChange: (ausente: boolean) => void;
  disabled?: boolean;
}

const NOTAS: ReadonlyArray<NotaEscala> = [0, 1, 2, 3];

const ESTILO_SELECIONADO: Record<NotaEscala, string> = {
  0: "border-[#1F6F64] bg-[#8FC4BB] text-[#124840]",
  1: "border-[#9C7A23] bg-[#E3CB8A] text-[#5E4710]",
  2: "border-[#B1602E] bg-[#E8AE86] text-[#6B3512]",
  3: "border-[#A6543C] bg-[#DE9F8D] text-[#6A2D1D]",
};

const OPCOES_PRESENCA: ReadonlyArray<{ ausente: boolean; label: string }> = [
  { ausente: false, label: "Presente" },
  { ausente: true, label: "Ausente" },
];

export default function EscalaIHOS({
  label,
  descricao,
  value,
  onChange,
  ausente,
  onAusenteChange,
  disabled = false,
}: Props) {
  const rotulo = descricao ?? label;
  return (
    <div className="border-b border-line-soft py-2.5 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[13px] font-semibold text-ink">{label}</span>
        <div
          role="radiogroup"
          aria-label={`${rotulo}: presença do dente`}
          className="flex gap-0.5 rounded-field border border-line-soft bg-paper p-0.5"
        >
          {OPCOES_PRESENCA.map((o) => {
            const ativo = ausente === o.ausente;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={disabled}
                onClick={() => onAusenteChange(o.ausente)}
                className={`h-7 rounded-[8px] px-3 text-[11.5px] font-semibold transition disabled:cursor-default ${
                  ativo ? (o.ausente ? "bg-alt-tint text-alt shadow-sm" : "bg-raised text-ink shadow-sm") : "text-ink-soft"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        role="group"
        aria-label={rotulo}
        aria-disabled={ausente || disabled}
        className={`flex gap-1.5 ${ausente ? "opacity-40" : ""}`}
      >
        {NOTAS.map((nota) => {
          const selecionada = !ausente && value === nota;
          return (
            <button
              key={nota}
              type="button"
              disabled={disabled || ausente}
              aria-pressed={selecionada}
              aria-label={`${rotulo}: nota ${nota}`}
              onClick={() => onChange(selecionada ? null : nota)}
              className={`flex h-9 flex-1 items-center justify-center rounded-md border-[1.5px] text-[12px] font-bold transition-colors duration-150 ${
                selecionada ? ESTILO_SELECIONADO[nota] : "border-line bg-raised text-ink-faint"
              } ${disabled || ausente ? "cursor-default" : ""}`}
            >
              {nota}
            </button>
          );
        })}
      </div>
    </div>
  );
}