import { useMemo } from "react";
import type { RegistroIHOSDados } from "@prontuario/shared";
import {
  calcularIHOS,
  DENTES_IHOS,
  dentesIHOSVazios,
  TEXTO_INTERPRETACAO_IHOS,
  type ChaveIHOS,
  type NotaIHOS,
} from "../../lib/ihos";
import CampoData from "./CampoData";
import EscalaIHOS from "./EscalaIHOS";

interface Props {
  registro: RegistroIHOSDados;
  indice: number;
  onChange: (parcial: Partial<Pick<RegistroIHOSDados, "data" | "dentes">>) => void;
  onRemover?: () => void;
  disabled?: boolean;
}

const ESTILO_RESULTADO = {
  nenhuma: { caixa: "border-line-soft bg-paper", valor: "text-ink-faint" },
  boa: { caixa: "border-primary bg-primary-tint", valor: "text-primary" },
  regular: { caixa: "border-amber bg-amber-tint", valor: "text-amber" },
  ruim: { caixa: "border-alt bg-alt-tint", valor: "text-alt" },
} as const;

function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "Sem data";
}

function formatarMedia(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RegistroIHOS({ registro, indice, onChange, onRemover, disabled = false }: Props) {
  const dentes = useMemo(() => ({ ...dentesIHOSVazios(), ...registro.dentes }), [registro.dentes]);
  const resultado = useMemo(() => calcularIHOS(dentes), [dentes]);
  const estilo = ESTILO_RESULTADO[resultado.interpretacao ?? "nenhuma"];

  const definirNota = (chave: ChaveIHOS, nota: NotaIHOS) => onChange({ dentes: { ...dentes, [chave]: nota } });

  return (
    <section className="rounded-card border border-line bg-raised p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{formatarData(registro.data)}</p>
        </div>
        {onRemover && !disabled && (
          <button
            type="button"
            onClick={onRemover}
            className="text-[11px] font-semibold text-ink-faint hover:text-alt"
          >
            Remover
          </button>
        )}
      </div>

      <CampoData
        label="Data do exame"
        value={registro.data}
        onChange={(v) => onChange({ data: v })}
        disabled={disabled}
      />

      <div className="mt-3">
        {DENTES_IHOS.map(({ chave, label, descricao }) => (
          <EscalaIHOS
            key={chave}
            label={label}
            descricao={descricao}
            value={dentes[chave]}
            onChange={(nota) => definirNota(chave, nota)}
            disabled={disabled}
          />
        ))}
      </div>

      <div className={`mt-4 rounded-field border p-4 text-center ${estilo.caixa}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">IHOS</p>
        <p className={`font-display text-[36px] font-medium leading-tight ${estilo.valor}`}>
          {formatarMedia(resultado.media)}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          {resultado.dentesExaminados} {resultado.dentesExaminados === 1 ? "dente examinado" : "dentes examinados"} ·{" "}
          {resultado.somaNotas} como soma
        </p>
        {resultado.interpretacao && (
          <p className={`mt-1 text-[13px] font-semibold ${estilo.valor}`}>
            {TEXTO_INTERPRETACAO_IHOS[resultado.interpretacao]}
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-faint">IHOS = soma das notas ÷ dentes examinados</p>
      </div>
    </section>
  );
}
