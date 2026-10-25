import { useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Paperclip, Plus } from "lucide-react";
import { procedimentosSchema, type ProcedimentoItem } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { uuid } from "../../lib/uuid";
import CampoData from "./CampoData";
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

function FormularioProcedimentos({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "procedimentos",
    procedimentosSchema,
  );

  const itens = useWatch({ control, name: "itens" });

  const atualizar = (id: string, parcial: Partial<ProcedimentoItem>) =>
    setValue(
      "itens",
      itens.map((i) => (i.id === id ? { ...i, ...parcial } : i)),
    );

  const adicionar = () => setValue("itens", [...itens, { id: uuid(), data: "", descricao: "" }]);

  const remover = (id: string) =>
    setValue(
      "itens",
      itens.filter((i) => i.id !== id),
    );

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Procedimentos executados" subtitulo="Registre cada atendimento realizado.">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-field border border-line-soft bg-paper px-4 py-8 text-center">
            <Paperclip size={24} className="text-ink-faint" aria-hidden="true" />
            <p className="text-[13px] text-ink-faint">Nenhum procedimento registrado ainda.</p>
          </div>
        ) : (
          itens.map((item) => (
            <div key={item.id} className="relative flex flex-col gap-3 rounded-field border border-line bg-paper p-4">
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => remover(item.id)}
                  className="absolute right-2 top-2 text-[11px] font-semibold text-ink-faint hover:text-alt"
                >
                  Remover
                </button>
              )}
              <CampoData
                label="Data"
                value={item.data}
                onChange={(v) => atualizar(item.id, { data: v })}
                disabled={somenteLeitura}
              />
              <CampoTexto
                label="Descrição"
                value={item.descricao}
                onChange={(v) => atualizar(item.id, { descricao: v })}
                placeholder="Descreva o procedimento realizado"
                multiline
                disabled={somenteLeitura}
              />
            </div>
          ))
        )}

        {!somenteLeitura && (
          <button
            type="button"
            onClick={adicionar}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-faint bg-transparent py-3 text-[13px] font-semibold text-ink-soft"
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar procedimento
          </button>
        )}
      </GrupoFicha>

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["procedimentos"])}
      />
    </div>
  );
}

export default function Procedimentos({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioProcedimentos prontuario={prontuario} />;
}
