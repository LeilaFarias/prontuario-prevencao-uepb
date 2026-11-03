import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { planoSchema, vazioPlano, type Plano as PlanoDados, type SessaoPlano } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao, type OpcoesSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { uuid } from "../../lib/uuid";
import CampoTexto from "./CampoTexto";
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

function garantirSessoes(plano: PlanoDados): PlanoDados {
  if (plano.sessoes.length === 0) return vazioPlano(uuid);
  return {
    sessoes: plano.sessoes.map((s, idx) => ({ ...s, id: s.id || uuid(), numero: idx + 1 })),
  };
}

const opcoesPlano: OpcoesSecao<PlanoDados> = { preencher: garantirSessoes };

function FormularioPlano({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "plano-preventivo",
    planoSchema,
    opcoesPlano,
  );

  const sessoes: SessaoPlano[] = useWatch({ control, name: "sessoes" });

  const adicionarSessao = () => {
    const nova: SessaoPlano = { id: uuid(), numero: sessoes.length + 1, descricao: "" };
    setValue("sessoes", [...sessoes, nova]);
  };

  const removerSessao = (id: string) => {
    const novas = sessoes.filter((s) => s.id !== id).map((s, idx) => ({ ...s, numero: idx + 1 }));
    setValue("sessoes", novas);
  };

  const podeRemover = !somenteLeitura && sessoes.length > 1;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha
        titulo="Plano de ações preventivas e de mínima intervenção"
        subtitulo="Descreva o que será feito em cada sessão de atendimento."
      >
        {sessoes.map((sessao, idx) => (
          <div
            key={sessao.id}
            className={`relative flex flex-col gap-2 ${idx > 0 ? "mt-1 border-t border-line-soft pt-4" : ""}`}
          >
            {podeRemover && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removerSessao(sessao.id);
                }}
                className={`absolute right-0 text-[11px] text-ink-faint hover:text-alt ${
                  idx > 0 ? "top-[22px]" : "top-1.5"
                }`}
              >
                Remover
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[13px] font-semibold text-primary">
                {sessao.numero}
              </div>
              <span className="text-[14px] font-semibold text-ink">
                {sessao.numero}ª sessão
                {idx > 0 && <span className="ml-1 text-[12px] font-normal text-ink-faint">(opcional)</span>}
              </span>
            </div>

            <Controller
              control={control}
              name={`sessoes.${idx}.descricao`}
              render={({ field }) => (
                <CampoTexto
                  label="Descrição"
                  obrigatorio={idx === 0}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Descreva as ações previstas para esta sessão"
                  multiline
                  disabled={somenteLeitura}
                />
              )}
            />
          </div>
        ))}

        {!somenteLeitura && (
          <button
            type="button"
            onClick={adicionarSessao}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-faint bg-transparent py-3 text-[13px] font-semibold text-ink-soft"
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar sessão
          </button>
        )}
      </GrupoFicha>

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["plano-preventivo"])}
      />
    </div>
  );
}

export default function Plano({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioPlano prontuario={prontuario} />;
}
