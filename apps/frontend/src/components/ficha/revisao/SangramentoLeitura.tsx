import { useMemo } from "react";
import type { RegistroSangramentoDados, Sangramento } from "@prontuario/shared";
import { calcularSG, gerarDentesVazios } from "../../../lib/odontograma";
import GridSangramento from "../GridSangramento";
import { dataOuVazio } from "./rotulos";
import VazioLeitura from "./VazioLeitura";

const SEM_ACAO = () => undefined;

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function Swatch({ valor, sangrando }: { valor: string; sangrando: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold ${
        sangrando ? "border-alt bg-alt-tint text-alt" : "border-line-soft bg-raised text-ink-faint"
      }`}
    >
      {valor}
    </span>
  );
}

function RegistroLeitura({ registro, indice }: { registro: RegistroSangramentoDados; indice: number }) {
  const dentes = useMemo(() => ({ ...gerarDentesVazios(), ...registro.dentes }), [registro.dentes]);
  const resultado = useMemo(() => calcularSG(dentes), [dentes]);
  const comSangramento = resultado.facesSangrantes > 0;

  return (
    <section className="rounded-card border border-line bg-raised p-4">
      <div className="mb-4">
        <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">{dataOuVazio(registro.data) || "Sem data"}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-ink-soft">
        <span className="flex items-center gap-2">
          <Swatch valor="0" sangrando={false} />
          Sem sangramento
        </span>
        <span className="flex items-center gap-2">
          <Swatch valor="1" sangrando />
          Com sangramento
        </span>
        <p className="basis-full">Dente circulado = presente na boca</p>
      </div>

      <GridSangramento dentes={dentes} onToggleDente={SEM_ACAO} onToggleFace={SEM_ACAO} disabled />

      <div
        className={`mt-4 rounded-field border p-4 text-center ${
          comSangramento ? "border-alt bg-alt-tint" : "border-primary bg-primary-tint"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Sangramento gengival (SG)</p>
        <p className={`font-display text-[36px] font-medium leading-tight ${comSangramento ? "text-alt" : "text-primary"}`}>
          {formatarPercentual(resultado.percentual)}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          {resultado.dentesPresentes} {resultado.dentesPresentes === 1 ? "dente presente" : "dentes presentes"} ·{" "}
          {resultado.facesSangrantes} {resultado.facesSangrantes === 1 ? "face com sangramento" : "faces com sangramento"}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-ink-soft">{resultado.interpretacao}</p>
        <p className="mt-1 text-[11px] text-ink-faint">SG = (faces sangrantes × 100) ÷ (dentes presentes × 2)</p>
      </div>
    </section>
  );
}

export default function SangramentoLeitura({ dados }: { dados: Sangramento }) {
  if (dados.registros.length === 0) return <VazioLeitura texto="Nenhum registro de sangramento gengival." />;
  return (
    <div className="flex flex-col gap-3 pb-2">
      {dados.registros.map((r, i) => (
        <RegistroLeitura key={r.id} registro={r} indice={i} />
      ))}
    </div>
  );
}
