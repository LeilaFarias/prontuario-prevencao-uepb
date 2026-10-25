import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { dadosPessoaisSchema, type DadosPessoais as DadosPessoaisValores } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { formatarIdade } from "../../lib/idade";
import { formatarCep, limparCep, limparUf } from "../../lib/mascaras";
import CampoData from "./CampoData";
import CampoSelect from "./CampoSelect";
import CampoTexto, { type CampoTextoProps } from "./CampoTexto";
import GrupoFicha from "./GrupoFicha";
import { ESCOLARIDADES } from "./opcoes";
import SegmentedToggle from "./SegmentedToggle";

type ChaveTexto =
  | "nomeCompleto"
  | "endereco"
  | "cidade"
  | "naturalidade"
  | "escola"
  | "serie"
  | "responsavelNome"
  | "responsavelParentesco"
  | "telefone"
  | "responsavelOcupacao"
  | "paiNome"
  | "paiOcupacao"
  | "maeNome"
  | "maeOcupacao";

type ChaveEscolaridade = "responsavelEscolaridade" | "paiEscolaridade" | "maeEscolaridade";

type ExtraTexto = Partial<Pick<CampoTextoProps, "placeholder" | "inputMode" | "autoComplete" | "maxLength" | "type">>;

const OPCOES_SEXO = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
] as const;

const OPCOES_ESTUDANTE = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

function preencher(v: DadosPessoaisValores, p: LocalProntuario): DadosPessoaisValores {
  const dataNascimento = v.dataNascimento || p.pacienteDataNascimento?.slice(0, 10) || "";
  return {
    ...v,
    nomeCompleto: v.nomeCompleto || p.pacienteNome || "",
    dataNascimento,
    idade: dataNascimento ? formatarIdade(dataNascimento) : "",
  };
}

function cabecalho(v: DadosPessoaisValores) {
  return { pacienteNome: v.nomeCompleto, pacienteDataNascimento: v.dataNascimento };
}

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

function FormularioDadosPessoais({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "dados-pessoais",
    dadosPessoaisSchema,
    { preencher, cabecalho },
  );
  const estudante = useWatch({ control, name: "estudante" });

  const texto = (name: ChaveTexto, label: string, extra: ExtraTexto = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CampoTexto
          label={label}
          value={field.value}
          onChange={field.onChange}
          disabled={somenteLeitura}
          {...extra}
        />
      )}
    />
  );

  const escolaridade = (name: ChaveEscolaridade) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CampoSelect
          label="Escolaridade"
          value={field.value}
          onChange={field.onChange}
          options={ESCOLARIDADES}
          disabled={somenteLeitura}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Identificação">
        {texto("nomeCompleto", "Nome completo", { autoComplete: "off" })}

        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="dataNascimento"
            render={({ field }) => (
              <CampoData
                label="Data de nascimento"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setValue("idade", v ? formatarIdade(v) : "");
                }}
                disabled={somenteLeitura}
              />
            )}
          />
          <Controller
            control={control}
            name="idade"
            render={({ field }) => <CampoTexto label="Idade" value={field.value} onChange={field.onChange} disabled />}
          />
        </div>

        <Controller
          control={control}
          name="sexo"
          render={({ field }) => (
            <SegmentedToggle
              label="Sexo"
              value={field.value}
              onChange={field.onChange}
              options={OPCOES_SEXO}
              disabled={somenteLeitura}
            />
          )}
        />

        <Controller
          control={control}
          name="cor"
          render={({ field }) => (
            <CampoTexto
              label="Cor (autodeclarada)"
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v === "" ? null : v)}
              placeholder="Ex.: parda"
              disabled={somenteLeitura}
            />
          )}
        />
      </GrupoFicha>

      <GrupoFicha titulo="Endereço">
        <Controller
          control={control}
          name="cep"
          render={({ field }) => (
            <CampoTexto
              label="CEP"
              value={formatarCep(field.value)}
              onChange={(v) => field.onChange(limparCep(v))}
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              disabled={somenteLeitura}
            />
          )}
        />
        {texto("endereco", "Endereço", { placeholder: "Rua, número, bairro" })}

        <div className="grid grid-cols-[1fr_84px] gap-3">
          {texto("cidade", "Cidade")}
          <Controller
            control={control}
            name="uf"
            render={({ field }) => (
              <CampoTexto
                label="UF"
                value={field.value}
                onChange={(v) => field.onChange(limparUf(v))}
                maxLength={2}
                autoComplete="off"
                disabled={somenteLeitura}
              />
            )}
          />
        </div>

        {texto("naturalidade", "Naturalidade")}
      </GrupoFicha>

      <GrupoFicha titulo="Educação">
        <Controller
          control={control}
          name="estudante"
          render={({ field }) => (
            <SegmentedToggle
              label="Estudante"
              value={field.value === null ? null : field.value ? "sim" : "nao"}
              onChange={(v) => {
                const ehEstudante = v === "sim";
                field.onChange(ehEstudante);
                if (!ehEstudante) {
                  setValue("escola", "");
                  setValue("serie", "");
                }
              }}
              options={OPCOES_ESTUDANTE}
              disabled={somenteLeitura}
            />
          )}
        />
        {estudante === true && (
          <>
            {texto("escola", "Escola")}
            {texto("serie", "Série")}
          </>
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Responsável legal">
        {texto("responsavelNome", "Nome")}
        {texto("responsavelParentesco", "Parentesco", { placeholder: "Ex.: Mãe, Avó, Tio" })}
        {texto("telefone", "Telefone", {
          type: "tel",
          inputMode: "tel",
          autoComplete: "tel",
          placeholder: "(83) 9 9999-0000",
        })}
        {texto("responsavelOcupacao", "Ocupação")}
        {escolaridade("responsavelEscolaridade")}
      </GrupoFicha>

      <GrupoFicha titulo="Pai">
        {texto("paiNome", "Nome")}
        {texto("paiOcupacao", "Ocupação")}
        {escolaridade("paiEscolaridade")}
      </GrupoFicha>

      <GrupoFicha titulo="Mãe">
        {texto("maeNome", "Nome")}
        {texto("maeOcupacao", "Ocupação")}
        {escolaridade("maeEscolaridade")}
      </GrupoFicha>

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["dados-pessoais"])}
      />
    </div>
  );
}

/**
 * Seção "Dados pessoais". Lê o prontuário direto do Dexie (live), de modo que reabrir a seção
 * após navegar pelos chips sempre mostra o que foi salvo, e o que chega do sync down aparece sozinho.
 */
export default function DadosPessoais({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioDadosPessoais prontuario={prontuario} />;
}
