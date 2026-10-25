import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { historiaMedicaSchema } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import CampoTexto from "./CampoTexto";
import GrupoFicha from "./GrupoFicha";
import SegmentedToggle from "./SegmentedToggle";

type ChaveSimNao = "temDoenca" | "emTratamento" | "usaMedicamento";
type ChaveTexto = "qualDoenca" | "qualTratamento" | "qualMedicamento" | "tempoMedicamento";

const OPCOES_SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

const DEPENDENTES: Record<ChaveSimNao, ReadonlyArray<ChaveTexto>> = {
  temDoenca: ["qualDoenca"],
  emTratamento: ["qualTratamento"],
  usaMedicamento: ["qualMedicamento", "tempoMedicamento"],
};

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

function FormularioHistoriaMedica({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "historia-medica",
    historiaMedicaSchema,
  );

  const temDoenca = useWatch({ control, name: "temDoenca" });
  const emTratamento = useWatch({ control, name: "emTratamento" });
  const usaMedicamento = useWatch({ control, name: "usaMedicamento" });

  const simNao = (name: ChaveSimNao, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SegmentedToggle
          label={label}
          value={field.value === null ? null : field.value ? "sim" : "nao"}
          onChange={(v) => {
            const resposta = v === "sim";
            field.onChange(resposta);
            if (!resposta) {
              for (const dependente of DEPENDENTES[name]) setValue(dependente, "");
            }
          }}
          options={OPCOES_SIM_NAO}
          disabled={somenteLeitura}
        />
      )}
    />
  );

  const texto = (name: ChaveTexto, label: string, placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CampoTexto
          label={label}
          value={field.value}
          onChange={field.onChange}
          placeholder={placeholder}
          disabled={somenteLeitura}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Condição de saúde">
        {simNao("temDoenca", "Sofre de alguma doença?")}
        {temDoenca === true && texto("qualDoenca", "Qual?", "Descreva a doença")}

        {simNao("emTratamento", "Está em tratamento médico atualmente?")}
        {emTratamento === true && texto("qualTratamento", "Qual tratamento?", "Detalhes do tratamento (opcional)")}

        {simNao("usaMedicamento", "Faz uso de algum medicamento?")}
        {usaMedicamento === true && (
          <>
            {texto("qualMedicamento", "Qual medicamento?", "Nome do medicamento")}
            {texto("tempoMedicamento", "Tempo de uso", "Ex.: 5 dias, desde os 5 anos")}
          </>
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Antecedentes familiares">
        <Controller
          control={control}
          name="antecedentesFamiliares"
          render={({ field }) => (
            <CampoTexto
              label="Registre o que for relevante"
              value={field.value}
              onChange={field.onChange}
              placeholder="Doenças recorrentes na família, alergias conhecidas etc."
              multiline
              disabled={somenteLeitura}
            />
          )}
        />
      </GrupoFicha>

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["historia-medica"])}
      />
    </div>
  );
}

export default function HistoriaMedica({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioHistoriaMedica prontuario={prontuario} />;
}
