import { useRef, useState, type ReactNode } from "react";
import { Camera, X } from "lucide-react";
import { formatarDataHora } from "../../lib/data";
import { comprimirImagem, ErroImagem } from "../../lib/imagem";

interface Props {
  foto: string | null;
  anexadaEm: string | null;
  onAnexar: (dataUrl: string, anexadaEm: string) => void;
  onRemover: () => void;
  somenteLeitura?: boolean;
  rotulo?: string;
  children?: ReactNode;
}

export default function UploadAssinatura({
  foto,
  anexadaEm,
  onAnexar,
  onRemover,
  somenteLeitura = false,
  rotulo = "assinatura",
  children,
}: Props) {
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; 
    if (!arquivo) return;

    setErro(null);
    setProcessando(true);
    try {
      const dataUrl = await comprimirImagem(arquivo);
      onAnexar(dataUrl, new Date().toISOString());
    } catch (err) {
      setErro(err instanceof ErroImagem ? err.message : "Não foi possível anexar a imagem. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  const inputs = !somenteLeitura && (
    <>
      <input
        ref={inputCamera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={aoEscolher}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={inputGaleria}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={aoEscolher}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );

  const botaoPequeno = "btn-ghost !h-9 !w-auto px-3.5 !text-[13px]";

  return (
    <div className="flex flex-col gap-3">
      {inputs}

      {foto ? (
        <>
          <div className="relative overflow-hidden rounded-field border border-line bg-white">
            <img src={foto} alt={`Foto da ${rotulo}`} className="max-h-[132px] w-full object-contain" />
            {!somenteLeitura && (
              <button
                type="button"
                onClick={onRemover}
                aria-label={`Remover foto da ${rotulo}`}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-ink-faint">
              Foto da {rotulo} anexada{anexadaEm ? ` · ${formatarDataHora(anexadaEm)}` : ""}
            </p>
            {!somenteLeitura && (
              <button
                type="button"
                className={botaoPequeno}
                onClick={() => inputGaleria.current?.click()}
                disabled={processando}
              >
                {processando ? "Processando…" : "Substituir foto"}
              </button>
            )}
          </div>
        </>
      ) : somenteLeitura ? (
        <p className="rounded-field border border-dashed border-ink-faint px-4 py-6 text-center text-[12.5px] text-ink-faint">
          Nenhuma foto anexada.
        </p>
      ) : (
        <div className="rounded-field border-2 border-dashed border-ink-faint px-4 py-8 text-center">
          <Camera size={26} className="mx-auto text-ink-faint" aria-hidden="true" />
          <p className="mt-2 text-[13px] font-semibold text-ink">Anexar foto da {rotulo}</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11.5px] text-ink-faint">
            Tire uma foto do termo assinado à mão ou escolha uma imagem da galeria.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              className={botaoPequeno}
              onClick={() => inputCamera.current?.click()}
              disabled={processando}
            >
              {processando ? "Processando…" : "Usar câmera"}
            </button>
            <button
              type="button"
              className={botaoPequeno}
              onClick={() => inputGaleria.current?.click()}
              disabled={processando}
            >
              Escolher da galeria
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="banner-erro">
          {erro}
        </p>
      )}

      {children}
    </div>
  );
}
