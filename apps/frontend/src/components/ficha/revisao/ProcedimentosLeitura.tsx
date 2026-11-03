import type { Procedimentos } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import { dataOuVazio } from "./rotulos";
import VazioLeitura from "./VazioLeitura";

export default function ProcedimentosLeitura({ dados }: { dados: Procedimentos }) {
  if (dados.itens.length === 0) return <VazioLeitura texto="Nenhum procedimento registrado." />;
  return (
    <div className="flex flex-col gap-3 pb-2">
      {dados.itens.map((item, i) => (
        <section key={item.id} className="rounded-card border border-line bg-raised p-4">
          <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">Procedimento {i + 1}</h3>
          <CampoLeitura label="Data" valor={dataOuVazio(item.data)} />
          <CampoLeitura label="Descrição" valor={item.descricao} multiline />
        </section>
      ))}
    </div>
  );
}
