import { RefreshCw } from "lucide-react";

interface Props {
  falhou: boolean;
  onRecarregar: () => void;
}

export default function CarregandoSecao({ falhou, onRecarregar }: Props) {
  if (falhou) {
    return (
      <section role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line-soft bg-raised p-4">
        <p className="text-[14px] text-ink-soft">Não foi possível carregar esta seção. Seus dados continuam salvos no aparelho.</p>
        <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={onRecarregar}>
          <RefreshCw size={14} aria-hidden="true" />
          Recarregar seção
        </button>
      </section>
    );
  }
  return (
    <div role="status" aria-busy="true" aria-label="Carregando seção" className="flex flex-col gap-3">
      <div className="h-24 animate-pulse rounded-card bg-line-soft" />
      <div className="h-24 animate-pulse rounded-card bg-line-soft" />
      <div className="h-24 animate-pulse rounded-card bg-line-soft" />
    </div>
  );
}
