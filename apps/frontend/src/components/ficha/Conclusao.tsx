import { useEffect, useRef, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import { conclusaoSchema, type FotoAnexo } from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { comprimirImagem, ErroImagem } from "../../lib/imagem";
import { uuid } from "../../lib/uuid";
import CampoData from "./CampoData";
import CampoTexto from "./CampoTexto";
import GrupoFicha from "./GrupoFicha";
import SegmentedToggle from "./SegmentedToggle";

const MAX_FOTOS = 9;
const QUALIDADE_FOTO = 0.75;

const OPCOES_DESFECHO = [
  { value: "concluido", label: "Tratamento concluído" },
  { value: "encaminhado", label: "Encaminhado" },
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

function ViewerFoto({
  foto,
  somenteLeitura,
  onFechar,
  onRemover,
}: {
  foto: FotoAnexo;
  somenteLeitura: boolean;
  onFechar: () => void;
  onRemover: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div role="dialog" aria-modal="true" aria-label={foto.nome} className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <header className="flex items-center justify-between gap-3 px-5 py-4 text-white">
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{foto.nome}</p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <X size={18} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <img src={foto.dataUrl} alt={foto.nome} className="max-h-full max-w-full object-contain" />
      </div>
      {!somenteLeitura && (
        <footer className="px-5 py-4">
          <button type="button" onClick={onRemover} className="btn bg-alt text-white">
            Remover foto
          </button>
        </footer>
      )}
    </div>
  );
}

function FormularioConclusao({ prontuario }: { prontuario: LocalProntuario }) {
  const { control, setValue, getValues, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "conclusao",
    conclusaoSchema,
  );

  const tipoDesfecho = useWatch({ control, name: "tipoDesfecho" });
  const fotos = useWatch({ control, name: "fotos" });

  const inputFotos = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fotoAbertaId, setFotoAbertaId] = useState<string | null>(null);

  const fotoAberta = fotos.find((f) => f.id === fotoAbertaId) ?? null;
  const limiteAtingido = fotos.length >= MAX_FOTOS;

  const removerFoto = (id: string) => {
    setValue(
      "fotos",
      getValues("fotos").filter((f) => f.id !== id),
    );
    setFotoAbertaId((atual) => (atual === id ? null : atual));
  };

  async function aoEscolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (arquivos.length === 0) return;

    setErro(null);
    setProcessando(true);
    const novas: FotoAnexo[] = [];
    let mensagem: string | null = null;
    const vagas = MAX_FOTOS - getValues("fotos").length;

    try {
      for (const arquivo of arquivos.slice(0, vagas)) {
        try {
          const dataUrl = await comprimirImagem(arquivo, QUALIDADE_FOTO);
          novas.push({ id: uuid(), nome: arquivo.name, dataUrl, adicionadaEm: new Date().toISOString() });
        } catch (err) {
          mensagem = err instanceof ErroImagem ? err.message : "Não foi possível anexar uma das imagens.";
        }
      }
      if (arquivos.length > vagas) {
        mensagem = `Limite de ${MAX_FOTOS} fotos: apenas as primeiras ${vagas} foram consideradas.`;
      }
      if (novas.length > 0) setValue("fotos", [...getValues("fotos"), ...novas]);
      setErro(mensagem);
    } finally {
      setProcessando(false);
    }
  }

  let dicaFotos = "Nenhuma foto anexada ainda.";
  if (limiteAtingido) dicaFotos = `Limite de ${MAX_FOTOS} fotos atingido.`;
  else if (fotos.length === 1) dicaFotos = `1 foto anexada · máximo de ${MAX_FOTOS}`;
  else if (fotos.length > 1) dicaFotos = `${fotos.length} fotos anexadas · máximo de ${MAX_FOTOS}`;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Conclusão do tratamento" subtitulo="Informe como o caso foi encerrado.">
        <Controller
          control={control}
          name="tipoDesfecho"
          render={({ field }) => (
            <SegmentedToggle
              label="O que aconteceu com o caso?"
              value={field.value}
              onChange={(v) => {
                if (v === field.value) return;
                field.onChange(v);
                if (v === "encaminhado") {
                  setValue("concluidoEm", "");
                } else {
                  setValue("encaminhamentoEm", "");
                  setValue("encaminhamentoPara", "");
                }
              }}
              options={OPCOES_DESFECHO}
              disabled={somenteLeitura}
            />
          )}
        />

        {tipoDesfecho === "concluido" && (
          <Controller
            control={control}
            name="concluidoEm"
            render={({ field }) => (
              <CampoData
                label="Tratamento concluído em"
                value={field.value}
                onChange={field.onChange}
                disabled={somenteLeitura}
              />
            )}
          />
        )}

        {tipoDesfecho === "encaminhado" && (
          <>
            <Controller
              control={control}
              name="encaminhamentoEm"
              render={({ field }) => (
                <CampoData
                  label="Encaminhamento em"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={somenteLeitura}
                />
              )}
            />
            <Controller
              control={control}
              name="encaminhamentoPara"
              render={({ field }) => (
                <div>
                  <CampoTexto
                    label="Para"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Ex.: Ortodontia — Profa. Helena"
                    disabled={somenteLeitura}
                  />
                  <p className="hint">Serviço, especialidade ou profissional de destino.</p>
                </div>
              )}
            />
          </>
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Anexos fotográficos" subtitulo="Fotos clínicas do antes e depois do caso.">
        {!somenteLeitura && (
          <input
            ref={inputFotos}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={aoEscolherFotos}
            tabIndex={-1}
            aria-hidden="true"
          />
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {fotos.map((foto) => (
            <div key={foto.id} className="relative aspect-square">
              <button
                type="button"
                onClick={() => setFotoAbertaId(foto.id)}
                aria-label={`Abrir foto ${foto.nome}`}
                className="h-full w-full overflow-hidden rounded-field border border-line bg-paper"
              >
                <img src={foto.dataUrl} alt={foto.nome} className="h-full w-full object-cover" />
              </button>
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => removerFoto(foto.id)}
                  aria-label={`Remover foto ${foto.nome}`}
                  className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}

          {!somenteLeitura && !limiteAtingido && (
            <button
              type="button"
              onClick={() => inputFotos.current?.click()}
              disabled={processando}
              aria-label="Adicionar foto"
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed border-ink-faint text-ink-soft disabled:opacity-60"
            >
              <Plus size={20} aria-hidden="true" />
              <span className="text-[11.5px] font-semibold">{processando ? "Processando…" : "Adicionar"}</span>
            </button>
          )}
        </div>

        {erro && (
          <p role="alert" className="banner-erro">
            {erro}
          </p>
        )}
        <p className="text-[11.5px] text-ink-faint">{dicaFotos}</p>
      </GrupoFicha>

      {fotoAberta && (
        <ViewerFoto
          foto={fotoAberta}
          somenteLeitura={somenteLeitura}
          onFechar={() => setFotoAbertaId(null)}
          onRemover={() => removerFoto(fotoAberta.id)}
        />
      )}

      <IndicadorSalvamento
        salvando={salvando}
        jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["conclusao"])}
      />
    </div>
  );
}

export default function Conclusao({ prontuarioId }: { prontuarioId: string }) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioConclusao prontuario={prontuario} />;
}
