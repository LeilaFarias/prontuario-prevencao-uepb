import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { sangramentoSchema } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { calcularSG, denteVazio, gerarDentesVazios, type Face } from "../../lib/odontograma";
import CampoData from "./CampoData";
import GridSangramento from "./GridSangramento";
import GrupoFicha from "./GrupoFicha";

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

function Swatch({ valor, sangrando }: { valor: string; sangrando: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold ${
        sangrando ? "border-alt bg-alt-tint text-alt" : "border-line-soft bg-raised text-ink-faint"
      }`}
    >
      {valor}
    </span>
  );
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function FormularioSangramento({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, getValues, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "sangramento",
    sangramentoSchema,
    {
      preencher: (v) => ({ ...v, dentes: { ...gerarDentesVazios(), ...v.dentes } }),
    },
  );

  const dentes = useWatch({ control, name: "dentes" });
  const resultado = useMemo(() => calcularSG(dentes), [dentes]);

  const alternarDente = (numero: number) => {
    const atuais = getValues("dentes");
    const chave = String(numero);
    const atual = atuais[chave] ?? denteVazio();
    setValue("dentes", {
      ...atuais,
      [chave]: atual.presente ? denteVazio() : { ...atual, presente: true },
    });
  };

  const alternarFace = (numero: number, face: Face) => {
    const atuais = getValues("dentes");
    const chave = String(numero);
    const atual = atuais[chave] ?? denteVazio();
    if (!atual.presente) return;
    setValue("dentes", {
      ...atuais,
      [chave]: { ...atual, faces: { ...atual.faces, [face]: atual.faces[face] === 1 ? 0 : 1 } },
    });
  };

  const comSangramento = resultado.facesSangrantes > 0;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Data do exame">
        <Controller
          control={control}
          name="data"
          render={({ field }) => (
            <CampoData label="Data do exame" value={field.value} onChange={field.onChange} disabled={somenteLeitura} />
          )}
        />
      </GrupoFicha>

      <GrupoFicha
        titulo="Registro por face"
        subtitulo="Toque no dente para marcá-lo como presente. Depois, toque nas faces para registrar sangramento."
      >
        <div className="flex flex-col gap-1.5 text-[11.5px] text-ink-soft">
          <div className="flex items-center gap-2">
            <Swatch valor="0" sangrando={false} />
            <span>Face sem sangramento</span>
            <Swatch valor="1" sangrando />
            <span>Face com sangramento</span>
          </div>
          <p>Dente circulado = presente na boca</p>
          <p>V = vestibular · P = palatina (superior) · L = lingual (inferior)</p>
        </div>

        <GridSangramento
          dentes={dentes}
          onToggleDente={alternarDente}
          onToggleFace={alternarFace}
          disabled={somenteLeitura}
        />
      </GrupoFicha>

      <GrupoFicha titulo="Resultado">
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Dentes presentes</dt>
            <dd className="font-semibold text-ink">{resultado.dentesPresentes}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Faces com sangramento</dt>
            <dd className="font-semibold text-ink">{resultado.facesSangrantes}</dd>
          </div>
        </dl>

        <div
          role="status"
          aria-live="polite"
          className={`mt-1 rounded-field border p-4 text-center ${
            comSangramento ? "border-alt bg-alt-tint" : "border-primary bg-primary-tint"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Sangramento gengival (SG)</p>
          <p className={`font-display text-[36px] font-medium leading-tight ${comSangramento ? "text-alt" : "text-primary"}`}>
            {formatarPercentual(resultado.percentual)}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">SG = (faces sangrantes × 100) ÷ (dentes presentes × 2)</p>
          <p className="mt-1 text-[11.5px] text-ink-soft">{resultado.interpretacao}</p>
        </div>
      </GrupoFicha>

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
