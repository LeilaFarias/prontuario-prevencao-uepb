import type { Pendencia } from "../../lib/validarEnvio";

interface Props {
  pendencias: Pendencia[];
  onIrParaSecao: (secaoId: Pendencia["secaoId"]) => void;
  onAplicarMarcador: (pendencia: Pendencia, valor: string) => void;
  onCancelar: () => void;
}

const MARCADORES = ["Não informado", "NDN", "Não se aplica"] as const;

export default function PendentesModal({ pendencias, onIrParaSecao, onAplicarMarcador, onCancelar }: Props) {

  return (
    <div className="flex flex-col gap-3">
      {pendencias.map((pendencia) => (
        <section key={pendencia.secaoId} className="rounded-card border border-line bg-raised p-3">
          <button type="button" onClick={() => onIrParaSecao(pendencia.secaoId)} className="text-left">
            <span className="block text-[13.5px] font-semibold text-ink">{pendencia.secao}</span>
            <span className="mt-0.5 block text-[12px] text-ink-soft">{pendencia.mensagem}</span>
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {MARCADORES.map((valor) => (
              <button key={valor} type="button" onClick={() => onAplicarMarcador(pendencia, valor)} className="rounded-pill border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-soft">
                {valor}
              </button>
            ))}
          </div>
        </section>
      ))}
      <button type="button" className="btn-ghost" onClick={onCancelar}>Cancelar envio</button>
    </div>
  );
}
