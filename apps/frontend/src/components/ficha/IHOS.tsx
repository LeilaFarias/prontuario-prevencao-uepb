import { useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { ihosSchema, type RegistroIHOSDados } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { hojeISO } from "../../lib/data";
import { dentesIHOSVazios } from "../../lib/ihos";
import { uuid } from "../../lib/uuid";
import GrupoFicha from "./GrupoFicha";
import RegistroIHOS from "./RegistroIHOS";

const LEGENDA = [
  { nota: "0", texto: "Ausência de biofilme na face avaliada", chip: "border border-[#1F6F64] bg-[#8FC4BB] text-[#124840]" },
  { nota: "1", texto: "Biofilme cobrindo até 1/3 da face", chip: "border border-[#9C7A23] bg-[#E3CB8A] text-[#5E4710]" },
  { nota: "2", texto: "Biofilme cobrindo entre 1/3 e 2/3", chip: "border border-[#B1602E] bg-[#E8AE86] text-[#6B3512]" },
  { nota: "3", texto: "Biofilme cobrindo mais de 2/3 da face", chip: "border border-[#A6543C] bg-[#DE9F8D] text-[#6A2D1D]" },
] as const;

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

function FormularioIHOS({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, getValues, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "ihos",
    ihosSchema,
  );

  const registros = useWatch({ control, name: "registros" });

  const adicionar = () =>
    setValue("registros", [
      ...getValues("registros"),
      { id: uuid(), data: hojeISO(), dentes: dentesIHOSVazios() },
    ]);

  const atualizar = (id: string, parcial: Partial<RegistroIHOSDados>) =>
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
        titulo="Índice de Higiene Oral Simplificado (IHOS)"
        subtitulo="Avalie a presença de biofilme em cada uma das 6 faces-índice."
      >
        <div className="flex flex-col gap-2 rounded-field bg-paper p-3">
          {LEGENDA.map((l) => (
            <div key={l.nota} className="flex items-start gap-2.5 text-[12px] leading-snug text-ink-soft">
              <span
                aria-hidden="true"
                className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${l.chip}`}
              >
                {l.nota}
              </span>
              <span>{l.texto}</span>
            </div>
          ))}
          <ul className="mt-2 flex flex-col gap-1 border-t border-line-soft pt-2 text-[11px] text-ink-faint">
            <li>0,0 a 1,0 → Boa higiene bucal</li>
            <li>1,1 a 2,0 → Higiene bucal regular</li>
            <li>2,1 a 3,0 → Higiene bucal ruim</li>
          </ul>
        </div>

        {registros.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-field border border-line-soft px-4 py-6 text-center">
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
        <RegistroIHOS
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
          Adicionar registro de IHOS
        </button>
      )}

      <IndicadorSalvamento salvando={salvando} jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["ihos"])} />
    </div>
  );
}

export default function IHOS({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioIHOS prontuario={prontuario} />;
}
