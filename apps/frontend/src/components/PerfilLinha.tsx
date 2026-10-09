interface Props {
  label: string;
  value: string;
  onAlterar: () => void;
  isPassword?: boolean;
  /** Classe de cor do botão (verde do aluno ou índigo do professor). */
  corClasse?: string;
}

export default function PerfilLinha({ label, value, onAlterar, isPassword, corClasse = "text-primary" }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
        <p className="mt-0.5 truncate text-[15px] text-ink">{isPassword ? "••••••••" : value}</p>
      </div>
      <button
        type="button"
        onClick={onAlterar}
        aria-label={`Alterar ${label.toLowerCase()}`}
        className={`shrink-0 rounded-pill border border-line bg-raised px-3.5 py-1.5 text-[13px] font-medium ${corClasse}`}
      >
        Alterar
      </button>
    </div>
  );
}
