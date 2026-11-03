import { useState } from "react";
import type { Conclusao } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";
import { dataOuVazio } from "./rotulos";
import VisualizadorFoto, { MiniaturaFoto } from "./VisualizadorFoto";

export default function ConclusaoLeitura({ dados }: { dados: Conclusao }) {
  const [fotoAbertaId, setFotoAbertaId] = useState<string | null>(null);
  const fotoAberta = dados.fotos.find((f) => f.id === fotoAbertaId) ?? null;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Desfecho do caso">
        <CampoLeitura
          label="O que aconteceu com o caso?"
          valor={dados.tipoDesfecho === "concluido" ? "Tratamento concluído" : dados.tipoDesfecho === "encaminhado" ? "Encaminhado" : ""}
        />
        {dados.tipoDesfecho === "concluido" && (
          <CampoLeitura label="Tratamento concluído em" valor={dataOuVazio(dados.concluidoEm)} />
        )}
        {dados.tipoDesfecho === "encaminhado" && (
          <>
            <CampoLeitura label="Encaminhamento em" valor={dataOuVazio(dados.encaminhamentoEm)} />
            <CampoLeitura label="Para" valor={dados.encaminhamentoPara} />
          </>
        )}
      </GrupoFicha>

      <GrupoFicha
        titulo="Anexos fotográficos"
        subtitulo={dados.fotos.length === 0 ? undefined : `${dados.fotos.length} ${dados.fotos.length === 1 ? "foto" : "fotos"} · toque para ampliar`}
      >
        {dados.fotos.length === 0 ? (
          <p className="rounded-field border border-line-soft bg-paper px-4 py-6 text-center text-[13px] text-ink-faint">
            Nenhuma foto anexada.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {dados.fotos.map((foto) => (
              <li key={foto.id}>
                <MiniaturaFoto
                  src={foto.dataUrl}
                  nome={foto.nome}
                  onAbrir={() => setFotoAbertaId(foto.id)}
                  className="aspect-square w-full"
                />
              </li>
            ))}
          </ul>
        )}
      </GrupoFicha>

      {fotoAberta && (
        <VisualizadorFoto src={fotoAberta.dataUrl} nome={fotoAberta.nome} onFechar={() => setFotoAbertaId(null)} />
      )}
    </div>
  );
}
