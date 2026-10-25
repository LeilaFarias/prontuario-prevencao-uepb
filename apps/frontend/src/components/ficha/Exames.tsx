import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { examesSchema } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import CampoTexto from "./CampoTexto";
import ExamRow from "./ExamRow";
import GrupoFicha from "./GrupoFicha";
import SegmentedToggle from "./SegmentedToggle";

const OPCOES_SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

const ESTRUTURAS = [
  { chave: "labios", label: "Lábios" },
  { chave: "freioLabial", label: "Freio labial" },
  { chave: "gengiva", label: "Gengiva" },
  { chave: "mucosa", label: "Mucosa" },
  { chave: "palato", label: "Palato" },
  { chave: "lingua", label: "Língua" },
  { chave: "freioLingual", label: "Freio lingual" },
  { chave: "assoalho", label: "Assoalho da boca" },
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

function FormularioExames({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(prontuario, "exames", examesSchema);

  const aberturaAnormal = useWatch({ control, name: "extraOral.aberturaAnormal" });

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Exame extra oral">
        <Controller
          control={control}
          name="extraOral.locomocao"
          render={({ field }) => (
            <CampoTexto
              label="Locomoção"
              value={field.value}
              onChange={field.onChange}
              placeholder="Registre as alterações observadas"
              multiline
              disabled={somenteLeitura}
            />
          )}
        />

        <Controller
          control={control}
          name="extraOral.cicatrizesEdemas"
          render={({ field }) => (
            <CampoTexto
              label="Cicatrizes, edemas, assimetrias, tumefações"
              value={field.value}
              onChange={field.onChange}
              placeholder="Registre as alterações observadas"
              multiline
              disabled={somenteLeitura}
            />
          )}
        />

        <Controller
          control={control}
          name="extraOral.aberturaAnormal"
          render={({ field }) => (
            <SegmentedToggle
              label="Abertura anormal da boca?"
              value={field.value === null ? null : field.value ? "sim" : "nao"}
              onChange={(v) => {
                const resposta = v === "sim";
                field.onChange(resposta);
                if (!resposta) setValue("extraOral.aberturaObservacao", "");
              }}
              options={OPCOES_SIM_NAO}
              disabled={somenteLeitura}
            />
          )}
        />

        {aberturaAnormal === true && (
          <Controller
            control={control}
            name="extraOral.aberturaObservacao"
            render={({ field }) => (
              <CampoTexto
                label="Observações"
                value={field.value}
                onChange={field.onChange}
                placeholder="Descreva a alteração"
                multiline
                disabled={somenteLeitura}
              />
            )}
          />
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Exame intra oral">
        <div className="rounded-field border border-line-soft bg-paper px-4 py-1.5">
          {ESTRUTURAS.map(({ chave, label }) => (
            <Controller
              key={chave}
              control={control}
              name={`intraOral.${chave}`}
              render={({ field }) => (
                <ExamRow label={label} value={field.value} onChange={field.onChange} disabled={somenteLeitura} />
              )}
            />
          ))}
        </div>

        <Controller
          control={control}
          name="intraOral.outrasAlteracoes"
          render={({ field }) => (
            <CampoTexto
              label="Outras alterações"
              value={field.value}
              onChange={field.onChange}
              placeholder="Registre outras alterações observadas"
              multiline
              disabled={somenteLeitura}
            />
          )}
        />
      </GrupoFicha>

      <IndicadorSalvamento salvando={salvando} jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["exames"])} />
    </div>
  );
}

export default function Exames({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioExames prontuario={prontuario} />;
}
