import type { Plano } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";
import VazioLeitura from "./VazioLeitura";

export default function PlanoLeitura({ dados }: { dados: Plano }) {
  const sessoes = [...dados.sessoes].sort((a, b) => a.numero - b.numero);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Plano da dupla" subtitulo="Plano de ações preventivas e de mínima intervenção.">
        {sessoes.length === 0 ? (
          <VazioLeitura texto="A dupla não registrou sessões no plano." />
        ) : (
          sessoes.map((s, i) => (
            <CampoLeitura key={s.id || i} label={`${s.numero}ª sessão`} valor={s.descricao} multiline />
          ))
        )}
      </GrupoFicha>
    </div>
  );
}
