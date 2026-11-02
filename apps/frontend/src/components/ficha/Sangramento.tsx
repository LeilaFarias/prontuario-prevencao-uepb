import { useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Droplet, Plus } from "lucide-react";
import { sangramentoSchema, type RegistroSangramentoDados } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { hojeISO } from "../../lib/data";
import { gerarDentesVazios } from "../../lib/odontograma";
import { uuid } from "../../lib/uuid";
import GrupoFicha from "./GrupoFicha";
import RegistroSangramento from "./RegistroSangramento";

function IndicadorSalvamento({ salvando, jaSalvou }: { salvando: boolean; jaSalvou: boolean }) {
  const { pendentes, online } = useSyncStatus();

  let texto: string | null = null;
  if (salvando) texto = "Salvando…";
  else if (pendentes > 0) texto = online ? "Salvando…" : "Salvo neste aparelho · será enviado quando houver conexão";
  else if (jaSalvou) texto = "Salvo automaticamente";

  return (
    <p role="status" aria-live="polite" className="min-h-[16px] text-[11px] text-ink-faint">
      {texto}
    </p>
  );
}

function FormularioSangramento({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, getValues, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "sangramento",
    sangramentoSchema,
  );

  const registros = useWatch({ control, name: "registros" });

  const adicionar = () =>
    setValue("registros", [
      ...getValues("registros"),
      { id: uuid(), data: hojeISO(), dentes: gerarDentesVazios() },
    ]);

  const atualizar = (id: string, parcial: Partial<RegistroSangramentoDados>) =>
    setValue(
      "registros",
      getValues("registros").map((r) => (r.id === id ? { ...r, ...parcial } : r)),
    );

  const remover = (id: string) =>
    setValue(
      "registros",
      getValues("registros").filter((r) => r.id !== id),
    );

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha
        titulo="Sangramento gengival"
      >
        {registros.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-field border border-line-soft bg-paper px-4 py-8 text-center">
            <Droplet size={24} className="text-ink-faint" aria-hidden="true" />
            <p className="text-[13px] text-ink-faint">Nenhum registro ainda.</p>
            {!somenteLeitura && (
              <button type="button" className="btn-primary" onClick={adicionar}>
                Adicionar primeiro registro
              </button>
            )}
          </div>
        )}
      </GrupoFicha>

      {registros.map((registro, indice) => (
        <RegistroSangramento
          key={registro.id}
          registro={registro}
          indice={indice}
          onChange={(parcial) => atualizar(registro.id, parcial)}
          onRemover={registros.length > 1 ? () => remover(registro.id) : undefined}
          disabled={somenteLeitura}
        />
      ))}

      {registros.length > 0 && !somenteLeitura && (
        <button
          type="button"
          onClick={adicionar}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-faint bg-transparent py-3 text-[13px] font-semibold text-ink-soft"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar registro de sangramento
        </button>
      )}

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["sangramento"])}
      />
    </div>
  );
}

export default function Sangramento({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioSangramento prontuario={prontuario} />;
}
