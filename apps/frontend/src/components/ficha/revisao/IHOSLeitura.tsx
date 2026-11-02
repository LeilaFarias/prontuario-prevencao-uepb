import { useMemo } from "react";
import type { IHOS, RegistroIHOSDados } from "@prontuario/shared";
import { calcularIHOS, DENTES_IHOS, dentesIHOSVazios, TEXTO_INTERPRETACAO_IHOS } from "../../../lib/ihos";
import EscalaIHOS from "../EscalaIHOS";
import { dataOuVazio } from "./rotulos";
import VazioLeitura from "./VazioLeitura";

const SEM_ACAO = () => undefined;

const ESTILO_RESULTADO = {
  nenhuma: { caixa: "border-line-soft bg-paper", valor: "text-ink-faint" },
  boa: { caixa: "border-primary bg-primary-tint", valor: "text-primary" },
  regular: { caixa: "border-amber bg-amber-tint", valor: "text-amber" },
  ruim: { caixa: "border-alt bg-alt-tint", valor: "text-alt" },
} as const;

function formatarMedia(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * O schema atual não tem `ihosManual` (o aluno não digita o IHOS, só as notas dos 6 dentes),
 * então não há o que comparar: mostramos as notas e o resultado calculado pelo sistema.
 */
function RegistroLeitura({ registro, indice }: { registro: RegistroIHOSDados; indice: number }) {
  const dentes = useMemo(() => ({ ...dentesIHOSVazios(), ...registro.dentes }), [registro.dentes]);
  const resultado = useMemo(() => calcularIHOS(dentes), [dentes]);
  const estilo = ESTILO_RESULTADO[resultado.interpretacao ?? "nenhuma"];

  return (
    <section className="rounded-card border border-line bg-raised p-4">
      <div className="mb-3">
        <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">{dataOuVazio(registro.data) || "Sem data"}</p>
      </div>

      <div>
        {DENTES_IHOS.map(({ chave, label, descricao }) => (
          <EscalaIHOS key={chave} label={label} descricao={descricao} value={dentes[chave]} onChange={SEM_ACAO} disabled />
        ))}
      </div>

      <div className={`mt-4 rounded-field border p-4 text-center ${estilo.caixa}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">IHOS (calculado pelo sistema)</p>
        <p className={`font-display text-[36px] font-medium leading-tight ${estilo.valor}`}>
          {formatarMedia(resultado.media)}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          {resultado.dentesExaminados} {resultado.dentesExaminados === 1 ? "dente examinado" : "dentes examinados"} ·{" "}
          {resultado.somaNotas} como soma
        </p>
        {resultado.interpretacao && (
          <p className={`mt-1 text-[13px] font-semibold ${estilo.valor}`}>{TEXTO_INTERPRETACAO_IHOS[resultado.interpretacao]}</p>
        )}
        <p className="mt-1 text-[11px] text-ink-faint">IHOS = soma das notas ÷ dentes examinados</p>
      </div>
    </section>
  );
}

export default function IHOSLeitura({ dados }: { dados: IHOS }) {
  if (dados.registros.length === 0) return <VazioLeitura texto="Nenhum registro de IHOS." />;
  return (
    <div className="flex flex-col gap-3 pb-2">
      {dados.registros.map((r, i) => (
        <RegistroLeitura key={r.id} registro={r} indice={i} />
      ))}
    </div>
  );
}
