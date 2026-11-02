import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { Consentimento, DadosPessoais } from "@prontuario/shared";
import { formatarDataHora } from "../../../lib/data";
import CampoLeitura from "../CampoLeitura";
import { PARAGRAFOS_TERMO } from "../Consentimento";
import GrupoFicha from "../GrupoFicha";
import { dataOuVazio } from "./rotulos";
import VisualizadorFoto, { MiniaturaFoto } from "./VisualizadorFoto";

interface Props {
  dados: Consentimento;
  paciente: DadosPessoais;
}

export default function ConsentimentoLeitura({ dados, paciente }: Props) {
  const [termoAberto, setTermoAberto] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);

  const idadeNoTermo = paciente.idade.trim() || "___ anos";
  const temFoto = Boolean(dados.assinaturaFoto);
  const assinado = temFoto && dados.termoAceito;
  const assinante = paciente.responsavelNome.trim();

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Identificação do atendimento">
        <CampoLeitura label="Semestre letivo" valor={dados.semestreLetivo} />
        <CampoLeitura label="Professor supervisor" valor={dados.professorSupervisor} />
        <CampoLeitura label="Aluno operador" valor={dados.alunoOperador} />
        <CampoLeitura label="Aluno auxiliar" valor={dados.alunoAuxiliar} />
      </GrupoFicha>

      <GrupoFicha titulo="Dados do paciente" subtitulo="Vêm da seção Dados pessoais.">
        <CampoLeitura label="Paciente" valor={paciente.nomeCompleto} />
        <CampoLeitura label="Idade" valor={paciente.idade} />
        <CampoLeitura label="Responsável legal" valor={paciente.responsavelNome} />
        <CampoLeitura label="Parentesco" valor={paciente.responsavelParentesco} />
        <CampoLeitura label="Telefone" valor={paciente.telefone} />
      </GrupoFicha>

      <section aria-labelledby="titulo-termo-leitura" className="rounded-card border border-line bg-raised p-4">
        <h3 id="titulo-termo-leitura" className="font-display text-[15px] font-medium text-ink">
          Termo de Consentimento Livre e Esclarecido
        </h3>
        <div
          id="texto-termo-leitura"
          className="mt-3 overflow-y-auto rounded-field border border-line-soft bg-paper p-[14px] text-[12.5px] leading-[1.62] text-ink-soft"
          style={{ maxHeight: termoAberto ? 1800 : 140 }}
        >
          {PARAGRAFOS_TERMO.map((par, i) => (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {par.replace("{IDADE}", idadeNoTermo)}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTermoAberto((x) => !x)}
          aria-expanded={termoAberto}
          aria-controls="texto-termo-leitura"
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-prof"
        >
          {termoAberto ? "Recolher termo" : "Ler termo completo"}
          {termoAberto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <div className="mt-3">
          <CampoLeitura label="Concordância com o termo" valor={dados.termoAceito} />
        </div>
      </section>

      <GrupoFicha titulo="Assinatura do responsável">
        {temFoto && dados.assinaturaFoto ? (
          <>
            <MiniaturaFoto
              src={dados.assinaturaFoto}
              nome="Assinatura do responsável"
              onAbrir={() => setFotoAberta(true)}
              className="h-40 w-full"
            />
            {fotoAberta && (
              <VisualizadorFoto
                src={dados.assinaturaFoto}
                nome="Assinatura do responsável"
                onFechar={() => setFotoAberta(false)}
              />
            )}
          </>
        ) : (
          <p className="rounded-field border border-line-soft bg-paper px-4 py-6 text-center text-[13px] text-ink-faint">
            Nenhuma assinatura anexada.
          </p>
        )}

        <div
          className={`flex items-start gap-2 rounded-field px-3 py-2.5 text-[12.5px] font-medium ${
            assinado ? "bg-primary-tint text-primary" : "bg-alt-tint text-alt"
          }`}
        >
          {assinado ? (
            <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <Clock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {assinado
              ? `Assinatura registrada${assinante ? ` por ${assinante}` : ""}, em ${formatarDataHora(dados.assinaturaAnexadaEm)}`
              : temFoto
                ? "Assinatura anexada, mas o termo não foi marcado como aceito."
                : "Sem assinatura do responsável anexada."}
          </span>
        </div>

        <CampoLeitura label="Data da assinatura" valor={dataOuVazio(dados.dataAssinatura)} />
      </GrupoFicha>
    </div>
  );
}
