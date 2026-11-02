import { AlertTriangle, Check } from "lucide-react";
import type { CPOD, RegistroCPODDados } from "@prontuario/shared";
import { compararRegistroCPOD } from "../../../lib/comparacaoCPOD";
import OdontogramaCPOD from "../OdontogramaCPOD";
import ComparacaoCPOD from "./ComparacaoCPOD";
import { dataOuVazio } from "./rotulos";
import VazioLeitura from "./VazioLeitura";

const SEM_ACAO = () => undefined;

function RegistroLeitura({ registro, indice }: { registro: RegistroCPODDados; indice: number }) {
  const comparacao = compararRegistroCPOD(registro);

  return (
    <section className="rounded-card border border-line bg-raised p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{dataOuVazio(registro.data) || "Sem data"}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
            comparacao.confere ? "bg-primary-tint text-primary" : "bg-alt-tint text-alt"
          }`}
        >
          {comparacao.confere ? <Check size={11} aria-hidden="true" /> : <AlertTriangle size={11} aria-hidden="true" />}
          {comparacao.confere ? "Confere" : "Divergente"}
        </span>
      </div>

      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Odontograma do aluno</h4>
      <OdontogramaCPOD dentes={registro.dentes} onChange={SEM_ACAO} disabled />

      <div className="mt-5 border-t border-line-soft pt-4">
        <h4 className="mb-3 font-display text-[15px] font-semibold text-ink">Conferência do cálculo</h4>
        <ComparacaoCPOD comparacao={comparacao} />
      </div>
    </section>
  );
}

export default function CPODLeitura({ dados }: { dados: CPOD }) {
  if (dados.registros.length === 0) return <VazioLeitura texto="Nenhum registro de CPO-D / ceo-d." />;
  return (
    <div className="flex flex-col gap-3 pb-2">
      {dados.registros.map((r, i) => (
        <RegistroLeitura key={r.id} registro={r} indice={i} />
      ))}
    </div>
  );
}
