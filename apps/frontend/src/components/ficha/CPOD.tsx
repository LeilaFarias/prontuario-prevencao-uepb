import { useState } from "react";
import { useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { cpodSchema, type RegistroCPODDados } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { hojeISO } from "../../lib/data";
import { uuid } from "../../lib/uuid";
import GrupoFicha from "./GrupoFicha";
import RegistroCPOD from "./RegistroCPOD";

const INSTRUCOES = [
  "Toque no código abaixo do número do dente.",
  "Escolha a condição na lista (0 a 9 para permanentes, A a L para decíduos).",
  "Repita para todos os dentes e, ao final, preencha o cálculo manual.",
];

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

function FormularioCPOD({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, getValues, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "cpod-ceod",
    cpodSchema,
  );

  const registros = useWatch({ control, name: "registros" });
  const [abertosManual, setAbertosManual] = useState<ReadonlySet<string> | null>(null);

  const ultimoId = registros[registros.length - 1]?.id;
  const abertos: ReadonlySet<string> = abertosManual ?? new Set(ultimoId ? [ultimoId] : []);

  const alternar = (id: string) => {
    const proximo = new Set(abertos);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    setAbertosManual(proximo);
  };

  const adicionar = () => {
    const novo: RegistroCPODDados = {
      id: uuid(),
      data: hojeISO(),
      dentes: {},
      cpodManual: { C: "", P: "", O: "", total: "" },
      ceodManual: { c: "", e: "", o: "", total: "" },
    };
    setValue("registros", [...getValues("registros"), novo]);
    setAbertosManual(new Set([novo.id]));
  };

  const atualizar = (id: string, parcial: Partial<Omit<RegistroCPODDados, "id">>) =>
    setValue(
      "registros",
      getValues("registros").map((r) => (r.id === id ? { ...r, ...parcial } : r)),
    );

  const remover = (id: string) => {
    setValue(
      "registros",
      getValues("registros").filter((r) => r.id !== id),
    );
    if (abertosManual) {
      const proximo = new Set(abertosManual);
      proximo.delete(id);
      setAbertosManual(proximo);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha
        titulo="Como preencher"
        subtitulo="Toque no código abaixo do número do dente e escolha a condição correspondente."
      >
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[12.5px] text-ink-soft">
          {INSTRUCOES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        {registros.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-field border border-line-soft bg-paper px-4 py-6 text-center">
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
        <RegistroCPOD
          key={registro.id}
          registro={registro}
          indice={indice}
          colapsavel={registros.length > 1}
          aberto={abertos.has(registro.id)}
          onAlternar={() => alternar(registro.id)}
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
          Adicionar registro de CPO-D/ceo-d
        </button>
      )}

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["cpod-ceod"])}
      />
    </div>
  );
}

export default function CPOD({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioCPOD prontuario={prontuario} />;
}
