import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { historiaOdontologicaSchema } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import CampoTexto from "./CampoTexto";
import CheckboxGroup, { type OpcaoCheckbox } from "./CheckboxGroup";
import GrupoFicha from "./GrupoFicha";
import SegmentedToggle from "./SegmentedToggle";

type ChaveSimNao = "primeiraConsulta" | "dorDente" | "acoesPreventivasRecebidas" | "escovaDiariamente";
type ChaveTextoCurto = "motivoUEPB" | "frequenciaHabitos";
type ChaveTextoLongo = "queixaPrincipal" | "dietaManha" | "dietaTarde" | "dietaNoite";

const OPCOES_SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

const OPCOES_TEMPO = [
  { value: "menos-6", label: "Menos de 6 meses" },
  { value: "mais-6", label: "Mais de 6 meses" },
] as const;

const OPCOES_COMPORTAMENTO = [
  { value: "cooperou", label: "Cooperou" },
  { value: "nao-cooperou", label: "Não cooperou" },
] as const;

const OPCOES_FREQUENCIA = [
  { value: "1x", label: "1x" },
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x ou mais" },
] as const;

const ACOES_PREVENTIVAS: ReadonlyArray<OpcaoCheckbox> = [
  { value: "educacao", label: "Educação em Saúde" },
  { value: "escovacao", label: "Escovação Supervisionada" },
  { value: "higiene-dieta", label: "Orientação de Higiene/Dieta" },
  { value: "fluor", label: "Aplicação Tópica de Flúor" },
];

const RECURSOS: ReadonlyArray<OpcaoCheckbox> = [
  { value: "escova", label: "Escova" },
  { value: "creme", label: "Creme dental" },
  { value: "fio", label: "Fio dental" },
  { value: "enxaguatorio", label: "Enxaguatório" },
];

const HABITOS: ReadonlyArray<OpcaoCheckbox> = [
  { value: "chupeta", label: "Chupeta" },
  { value: "succao", label: "Sucção digital" },
  { value: "onicofagia", label: "Onicofagia" },
  { value: "morde-lingua", label: "Morde língua/bochecha" },
  { value: "respirador", label: "Respiração bucal" },
  { value: "morde-labio", label: "Morde lábio" },
  { value: "morde-objetos", label: "Morde objetos" },
  { value: "bruxismo", label: "Bruxismo" },
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

function FormularioHistoriaOdontologica({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "historia-odontologica",
    historiaOdontologicaSchema,
  );

  const acoesRecebidas = useWatch({ control, name: "acoesPreventivasRecebidas" });
  const escova = useWatch({ control, name: "escovaDiariamente" });
  const habitos = useWatch({ control, name: "habitosParafuncionais" });

  const simNao = (name: ChaveSimNao, label: string, aoDesmarcar?: () => void) => (
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
            if (!resposta) aoDesmarcar?.();
          }}
          options={OPCOES_SIM_NAO}
          disabled={somenteLeitura}
        />
      )}
    />
  );

  const textoCurto = (name: ChaveTextoCurto, label: string, placeholder: string) => (
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

  const textoLongo = (name: ChaveTextoLongo, label: string, placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CampoTexto
          label={label}
          value={field.value}
          onChange={field.onChange}
          placeholder={placeholder}
          multiline
          disabled={somenteLeitura}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Histórico de consultas">
        {simNao("primeiraConsulta", "Primeira consulta odontológica?")}

        <Controller
          control={control}
          name="tempoUltimaConsulta"
          render={({ field }) => (
            <SegmentedToggle
              label="Tempo da última consulta"
              value={field.value}
              onChange={(v) => field.onChange(v)}
              options={OPCOES_TEMPO}
              disabled={somenteLeitura}
            />
          )}
        />

        {textoLongo("queixaPrincipal", "Motivo da procura atual (queixa principal)", "Descreva o motivo relatado")}
        {simNao("dorDente", "Presença de dor de dente?")}
        {textoCurto("motivoUEPB", "Motivo da procura pela clínica da UEPB", "Ex.: encaminhamento, indicação")}

        <Controller
          control={control}
          name="comportamentoAnterior"
          render={({ field }) => (
            <SegmentedToggle
              label="Comportamento no atendimento anterior"
              value={field.value}
              onChange={(v) => field.onChange(v)}
              options={OPCOES_COMPORTAMENTO}
              disabled={somenteLeitura}
            />
          )}
        />
      </GrupoFicha>

      <GrupoFicha titulo="Ações preventivas e higiene bucal">
        {simNao("acoesPreventivasRecebidas", "Já recebeu ações preventivas?", () =>
          setValue("quaisAcoesPreventivas", []),
        )}

        {acoesRecebidas === true && (
          <Controller
            control={control}
            name="quaisAcoesPreventivas"
            render={({ field }) => (
              <CheckboxGroup
                label="Quais?"
                options={ACOES_PREVENTIVAS}
                values={field.value}
                onChange={field.onChange}
                disabled={somenteLeitura}
              />
            )}
          />
        )}

        {simNao("escovaDiariamente", "Escova os dentes diariamente?", () => {
          setValue("frequenciaEscovacao", null);
          setValue("recursosUtilizados", []);
        })}

        {escova === true && (
          <>
            <Controller
              control={control}
              name="frequenciaEscovacao"
              render={({ field }) => (
                <SegmentedToggle
                  label="Frequência"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  options={OPCOES_FREQUENCIA}
                  disabled={somenteLeitura}
                />
              )}
            />
            <Controller
              control={control}
              name="recursosUtilizados"
              render={({ field }) => (
                <CheckboxGroup
                  label="Recursos utilizados"
                  options={RECURSOS}
                  values={field.value}
                  onChange={field.onChange}
                  disabled={somenteLeitura}
                />
              )}
            />
          </>
        )}
      </GrupoFicha>

      <GrupoFicha eyebrow="2.2.1" titulo="Hábitos parafuncionais">
        <Controller
          control={control}
          name="habitosParafuncionais"
          render={({ field }) => (
            <CheckboxGroup
              label="Hábitos identificados"
              options={HABITOS}
              values={field.value}
              onChange={(novos) => {
                field.onChange(novos);
                if (novos.length === 0) setValue("frequenciaHabitos", "");
              }}
              disabled={somenteLeitura}
            />
          )}
        />

        {habitos.length > 0 &&
          textoCurto("frequenciaHabitos", "Frequência do(s) hábito(s)", "Ex.: ocasional, diariamente, em momentos de ansiedade")}
      </GrupoFicha>

      <GrupoFicha
        eyebrow="2.2.2"
        titulo="Dieta 24h"
        subtitulo="Recordatório de 24 horas — relatar quantidade e medidas"
      >
        {textoLongo("dietaManha", "Manhã", "Descreva o que consumiu pela manhã")}
        {textoLongo("dietaTarde", "Tarde", "Descreva o que consumiu à tarde")}
        {textoLongo("dietaNoite", "Noite", "Descreva o que consumiu à noite")}
      </GrupoFicha>

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["historia-odontologica"])}
      />
    </div>
  );
}

export default function HistoriaOdontologica({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioHistoriaOdontologica prontuario={prontuario} />;
}
