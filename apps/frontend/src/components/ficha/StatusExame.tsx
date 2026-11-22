
interface Props {
  naoAvaliado: boolean;
  disabled?: boolean;
  onChange?: (naoAvaliado: boolean) => void;
}

export default function StatusExame({ naoAvaliado, disabled = false, onChange }: Props) {
  if (naoAvaliado) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span className="rounded-pill bg-paper px-2.5 py-1 text-[10.5px] font-semibold text-ink-soft">
          Não avaliado nesta sessão
        </span>
        {!disabled && onChange && (
          <button
            type="button"
            onClick={() => onChange(false)}
            className="text-[11px] font-semibold text-primary"
          >
            Avaliar
          </button>
        )}
      </div>
    );
  }

  if (disabled || !onChange) return null;

  return (
    <button
      type="button"
      onClick={() => onChange(true)}
      className="shrink-0 rounded-pill border border-line-soft bg-paper px-2.5 py-1.5 text-[10.5px] font-medium text-ink-faint transition hover:border-line hover:text-ink-soft"
    >
      Não avaliado nesta sessão
    </button>
  );
}
