import { useId } from "react";
import { ChevronRight } from "lucide-react";
import type { RegistroCPODDados } from "@prontuario/shared";
import { formatarDataBR } from "../../lib/data";
import CampoData from "./CampoData";
import OdontogramaCPOD from "./OdontogramaCPOD";

interface Props {
  registro: RegistroCPODDados;
  indice: number;
  colapsavel: boolean;
  aberto: boolean;
  onAlternar: () => void;
  onChange: (parcial: Partial<Omit<RegistroCPODDados, "id">>) => void;
  onRemover?: () => void;
  disabled?: boolean;
}

function InputNumerico({
  rotulo,
  descricao,
  value,
  onChange,
  disabled,
}: {
  rotulo: string;
  descricao: string;
  value: string;
  onChange: (valor: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="rounded-field border border-line bg-raised focus-within:border-primary">
      <label
        htmlFor={id}
        className="block pt-2 text-center text-[10px] font-bold uppercase tracking-wider text-ink-faint"
      >
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        placeholder="0"
        value={value}
        disabled={disabled}
        aria-label={descricao}
        onChange={(e) => {
          if (/^\d*$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="w-full bg-transparent py-2.5 text-center text-[16px] font-semibold text-ink outline-none disabled:text-ink-soft"
      />
    </div>
  );
}

function resumoCalculo(registro: RegistroCPODDados): string {
  const partes: string[] = [];
  if (registro.cpodManual.total !== "") partes.push(`CPO-D: ${registro.cpodManual.total}`);
  if (registro.ceodManual.total !== "") partes.push(`ceo-d: ${registro.ceodManual.total}`);
  return partes.length > 0 ? partes.join(" · ") : "Cálculo não preenchido";
}

export default function RegistroCPOD({
  registro,
  indice,
  colapsavel,
  aberto,
  onAlternar,
  onChange,
  onRemover,
  disabled = false,
}: Props) {
  const corpoId = useId();
  const expandido = !colapsavel || aberto;

  const alterarCPOD = (chave: keyof RegistroCPODDados["cpodManual"], valor: string) =>
    onChange({ cpodManual: { ...registro.cpodManual, [chave]: valor } });

  const alterarCEOD = (chave: keyof RegistroCPODDados["ceodManual"], valor: string) =>
    onChange({ ceodManual: { ...registro.ceodManual, [chave]: valor } });

  const titulo = (
    <div className="min-w-0 flex-1 text-left">
      <h3 className="font-display text-[15px] font-semibold text-ink">Registro {indice + 1}</h3>
      <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
        {formatarDataBR(registro.data) || "Sem data"} · {resumoCalculo(registro)}
      </p>
    </div>
  );

  return (
    <section
      className={`overflow-hidden rounded-card border border-line bg-raised ${expandido ? "shadow-sm" : ""}`}
    >
      <div className="flex items-center gap-3 p-4">
        {colapsavel ? (
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={aberto}
            aria-controls={corpoId}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ChevronRight
              size={18}
              aria-hidden="true"
              className={`shrink-0 text-ink-faint transition-transform duration-150 ${aberto ? "rotate-90" : ""}`}
            />
            {titulo}
          </button>
        ) : (
          titulo
        )}

        {onRemover && !disabled && (
          <button
            type="button"
            onClick={onRemover}
            className="shrink-0 text-[11px] font-semibold text-ink-faint hover:text-alt"
          >
            Remover
          </button>
        )}
      </div>

      {expandido && (
        <div id={corpoId} className="flex flex-col gap-4 border-t border-line-soft px-4 pb-4 pt-4">
          <CampoData
            label="Data do exame"
            value={registro.data}
            onChange={(v) => onChange({ data: v })}
            disabled={disabled}
          />

          <OdontogramaCPOD
            dentes={registro.dentes}
            onChange={(numero, codigo) => {
              const { [String(numero)]: _removido, ...restantes } = registro.dentes;
              onChange({ dentes: codigo === null ? restantes : { ...restantes, [String(numero)]: codigo } });
            }}
            disabled={disabled}
          />

          <div className="border-t border-line-soft pt-4">
            <h4 className="mb-3 font-display text-[15px] font-semibold text-ink">Cálculo manual</h4>

            <h5 className="text-[13px] font-semibold text-ink">CPO-D</h5>
            <p className="mb-2.5 text-[11.5px] text-ink-faint">Dentes permanentes</p>
            <div className="grid grid-cols-4 gap-2">
              <InputNumerico rotulo="C" descricao="CPO-D: dentes cariados" value={registro.cpodManual.C} onChange={(v) => alterarCPOD("C", v)} disabled={disabled} />
              <InputNumerico rotulo="P" descricao="CPO-D: dentes perdidos" value={registro.cpodManual.P} onChange={(v) => alterarCPOD("P", v)} disabled={disabled} />
              <InputNumerico rotulo="O" descricao="CPO-D: dentes obturados" value={registro.cpodManual.O} onChange={(v) => alterarCPOD("O", v)} disabled={disabled} />
              <InputNumerico rotulo="Total" descricao="CPO-D: total" value={registro.cpodManual.total} onChange={(v) => alterarCPOD("total", v)} disabled={disabled} />
            </div>

            <h5 className="mt-4 text-[13px] font-semibold text-ink">ceo-d</h5>
            <p className="mb-2.5 text-[11.5px] text-ink-faint">Dentes decíduos</p>
            <div className="grid grid-cols-4 gap-2">
              <InputNumerico rotulo="c" descricao="ceo-d: dentes cariados" value={registro.ceodManual.c} onChange={(v) => alterarCEOD("c", v)} disabled={disabled} />
              <InputNumerico rotulo="e" descricao="ceo-d: dentes extraídos" value={registro.ceodManual.e} onChange={(v) => alterarCEOD("e", v)} disabled={disabled} />
              <InputNumerico rotulo="o" descricao="ceo-d: dentes obturados" value={registro.ceodManual.o} onChange={(v) => alterarCEOD("o", v)} disabled={disabled} />
              <InputNumerico rotulo="Total" descricao="ceo-d: total" value={registro.ceodManual.total} onChange={(v) => alterarCEOD("total", v)} disabled={disabled} />
            </div>

            <p className="mt-3 text-[11.5px] text-ink-faint">
              Preencha os valores que você calculou manualmente. O professor fará a conferência na revisão.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
