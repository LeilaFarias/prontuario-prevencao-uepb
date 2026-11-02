import type { HistoriaOdontologica } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";
import { ACOES_PREVENTIVAS, HABITOS, RECURSOS } from "../HistoriaOdontologica";
import ChipsLeitura from "./ChipsLeitura";
import { rotuloDe, rotulosDe } from "./rotulos";

const TEMPO = [
  { value: "menos-6", label: "Menos de 6 meses" },
  { value: "mais-6", label: "Mais de 6 meses" },
];
const COMPORTAMENTO = [
  { value: "cooperou", label: "Cooperou" },
  { value: "nao-cooperou", label: "Não cooperou" },
];
const FREQUENCIA = [
  { value: "1x", label: "1x" },
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x ou mais" },
];

export default function HistoriaOdontologicaLeitura({ dados }: { dados: HistoriaOdontologica }) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Histórico de consultas">
        <CampoLeitura label="Primeira consulta odontológica?" valor={dados.primeiraConsulta} />
        {dados.primeiraConsulta === false && (
          <>
            <CampoLeitura label="Tempo da última consulta" valor={rotuloDe(dados.tempoUltimaConsulta, TEMPO)} />
            <CampoLeitura
              label="Comportamento no atendimento anterior"
              valor={rotuloDe(dados.comportamentoAnterior, COMPORTAMENTO)}
            />
          </>
        )}
        <CampoLeitura label="Queixa principal" valor={dados.queixaPrincipal} multiline />
        <CampoLeitura label="Dor de dente?" valor={dados.dorDente} />
        <CampoLeitura label="Motivo da procura pela UEPB" valor={dados.motivoUEPB} multiline />
      </GrupoFicha>

      <GrupoFicha titulo="Ações preventivas e higiene bucal">
        <CampoLeitura label="Recebeu ações preventivas?" valor={dados.acoesPreventivasRecebidas} />
        {dados.acoesPreventivasRecebidas === true && (
          <CampoLeitura label="Quais?">
            <ChipsLeitura valores={rotulosDe(dados.quaisAcoesPreventivas, ACOES_PREVENTIVAS)} />
          </CampoLeitura>
        )}

        <CampoLeitura label="Escova diariamente?" valor={dados.escovaDiariamente} />
        {dados.escovaDiariamente === true && (
          <>
            <CampoLeitura label="Frequência" valor={rotuloDe(dados.frequenciaEscovacao, FREQUENCIA)} />
            <CampoLeitura label="Recursos utilizados">
              <ChipsLeitura valores={rotulosDe(dados.recursosUtilizados, RECURSOS)} />
            </CampoLeitura>
          </>
        )}
      </GrupoFicha>

      <GrupoFicha eyebrow="2.2.1" titulo="Hábitos parafuncionais">
        <CampoLeitura label="Hábitos identificados">
          <ChipsLeitura valores={rotulosDe(dados.habitosParafuncionais, HABITOS)} />
        </CampoLeitura>
        <CampoLeitura label="Frequência dos hábitos" valor={dados.frequenciaHabitos} />
      </GrupoFicha>

      <GrupoFicha titulo="Dieta">
        <CampoLeitura label="Manhã" valor={dados.dietaManha} multiline />
        <CampoLeitura label="Tarde" valor={dados.dietaTarde} multiline />
        <CampoLeitura label="Noite" valor={dados.dietaNoite} multiline />
      </GrupoFicha>
    </div>
  );
}
