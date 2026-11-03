import type { HistoriaMedica } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";

export default function HistoriaMedicaLeitura({ dados }: { dados: HistoriaMedica }) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Condição de saúde">
        <CampoLeitura label="Sofre de alguma doença?" valor={dados.temDoenca} />
        {dados.temDoenca === true && <CampoLeitura label="Qual?" valor={dados.qualDoenca} multiline />}

        <CampoLeitura label="Está em tratamento médico atualmente?" valor={dados.emTratamento} />
        {dados.emTratamento === true && <CampoLeitura label="Qual tratamento?" valor={dados.qualTratamento} multiline />}

        <CampoLeitura label="Faz uso de algum medicamento?" valor={dados.usaMedicamento} />
        {dados.usaMedicamento === true && (
          <>
            <CampoLeitura label="Qual medicamento?" valor={dados.qualMedicamento} multiline />
            <CampoLeitura label="Tempo de uso" valor={dados.tempoMedicamento} />
          </>
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Antecedentes familiares">
        <CampoLeitura label="Registro" valor={dados.antecedentesFamiliares} multiline />
      </GrupoFicha>
    </div>
  );
}
