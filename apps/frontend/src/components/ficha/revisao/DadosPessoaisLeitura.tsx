import type { DadosPessoais } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";
import { ESCOLARIDADES } from "../opcoes";
import { capitalizar, dataOuVazio, rotuloDe } from "./rotulos";

export default function DadosPessoaisLeitura({ dados }: { dados: DadosPessoais }) {
  const escolaridade = (v: string) => rotuloDe(v, ESCOLARIDADES);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Identificação">
        <CampoLeitura label="Nome completo" valor={dados.nomeCompleto} />
        <CampoLeitura label="Data de nascimento" valor={dataOuVazio(dados.dataNascimento)} />
        <CampoLeitura label="Idade" valor={dados.idade} />
        <CampoLeitura label="Sexo" valor={capitalizar(dados.sexo)} />
        <CampoLeitura label="Cor (autodeclarada)" valor={capitalizar(dados.cor)} />
      </GrupoFicha>

      <GrupoFicha titulo="Endereço">
        <CampoLeitura label="CEP" valor={dados.cep} />
        <CampoLeitura label="Endereço" valor={dados.endereco} />
        <CampoLeitura label="Cidade" valor={dados.cidade} />
        <CampoLeitura label="UF" valor={dados.uf} />
        <CampoLeitura label="Naturalidade" valor={dados.naturalidade} />
      </GrupoFicha>

      <GrupoFicha titulo="Educação">
        <CampoLeitura label="Estudante" valor={dados.estudante} />
        {dados.estudante === true && (
          <>
            <CampoLeitura label="Escola" valor={dados.escola} />
            <CampoLeitura label="Série" valor={dados.serie} />
          </>
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Responsável legal">
        <CampoLeitura label="Nome" valor={dados.responsavelNome} />
        <CampoLeitura label="Parentesco" valor={dados.responsavelParentesco} />
        <CampoLeitura label="Telefone" valor={dados.telefone} />
        <CampoLeitura label="Ocupação" valor={dados.responsavelOcupacao} />
        <CampoLeitura label="Escolaridade" valor={escolaridade(dados.responsavelEscolaridade)} />
      </GrupoFicha>

      <GrupoFicha titulo="Pai">
        <CampoLeitura label="Nome" valor={dados.paiNome} />
        <CampoLeitura label="Ocupação" valor={dados.paiOcupacao} />
        <CampoLeitura label="Escolaridade" valor={escolaridade(dados.paiEscolaridade)} />
      </GrupoFicha>

      <GrupoFicha titulo="Mãe">
        <CampoLeitura label="Nome" valor={dados.maeNome} />
        <CampoLeitura label="Ocupação" valor={dados.maeOcupacao} />
        <CampoLeitura label="Escolaridade" valor={escolaridade(dados.maeEscolaridade)} />
      </GrupoFicha>
    </div>
  );
}
