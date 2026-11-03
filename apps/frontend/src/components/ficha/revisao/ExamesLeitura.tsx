import type { Exames } from "@prontuario/shared";
import CampoLeitura from "../CampoLeitura";
import GrupoFicha from "../GrupoFicha";

const ESTRUTURAS = [
  { chave: "labios", label: "Lábios" },
  { chave: "freioLabial", label: "Freio labial" },
  { chave: "gengiva", label: "Gengiva" },
  { chave: "mucosa", label: "Mucosa" },
  { chave: "palato", label: "Palato" },
  { chave: "lingua", label: "Língua" },
  { chave: "freioLingual", label: "Freio lingual" },
  { chave: "assoalho", label: "Assoalho da boca" },
] as const;

function TagResultado({ valor }: { valor: "normal" | "alteracao" | null }) {
  if (valor === "normal") {
    return <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11.5px] font-semibold text-primary">Normal</span>;
  }
  if (valor === "alteracao") {
    return <span className="rounded-pill bg-alt-tint px-2.5 py-1 text-[11.5px] font-semibold text-alt">Com alteração</span>;
  }
  return <span className="text-[13px] text-ink-faint">—</span>;
}

export default function ExamesLeitura({ dados }: { dados: Exames }) {
  const { extraOral, intraOral } = dados;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <GrupoFicha titulo="Exame extra oral">
        <CampoLeitura label="Locomoção" valor={extraOral.locomocao} multiline />
        <CampoLeitura label="Cicatrizes, edemas, assimetrias, tumefações" valor={extraOral.cicatrizesEdemas} multiline />
        <CampoLeitura label="Abertura anormal da boca?" valor={extraOral.aberturaAnormal} />
        {extraOral.aberturaAnormal === true && (
          <CampoLeitura label="Observações" valor={extraOral.aberturaObservacao} multiline />
        )}
      </GrupoFicha>

      <GrupoFicha titulo="Exame intra oral">
        <div className="rounded-field border border-line-soft bg-paper px-4 py-1.5">
          {ESTRUTURAS.map(({ chave, label }) => {
            const resultado = intraOral[chave];
            const descricao = intraOral.observacoes[chave].trim();
            return (
              <div key={chave} className="border-b border-line-soft py-2.5 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink">{label}</span>
                  <TagResultado valor={resultado} />
                </div>
                {resultado === "alteracao" && descricao !== "" && (
                  <p className="mt-2 whitespace-pre-wrap rounded-field bg-alt-tint px-3 py-2 text-[12.5px] text-alt">
                    {descricao}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <CampoLeitura label="Outras alterações" valor={intraOral.outrasAlteracoes} multiline />
      </GrupoFicha>
    </div>
  );
}
