import { useId, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import {
  conclusaoSchema,
  consentimentoSchema,
  cpodSchema,
  dadosPessoaisSchema,
  examesSchema,
  historiaMedicaSchema,
  historiaOdontologicaSchema,
  ihosSchema,
  planoSchema,
  procedimentosSchema,
  sangramentoSchema,
} from "@prontuario/shared";
import ConclusaoLeitura from "./ficha/revisao/ConclusaoLeitura";
import ConsentimentoLeitura from "./ficha/revisao/ConsentimentoLeitura";
import CPODLeitura from "./ficha/revisao/CPODLeitura";
import DadosPessoaisLeitura from "./ficha/revisao/DadosPessoaisLeitura";
import ExamesLeitura from "./ficha/revisao/ExamesLeitura";
import HistoriaMedicaLeitura from "./ficha/revisao/HistoriaMedicaLeitura";
import HistoriaOdontologicaLeitura from "./ficha/revisao/HistoriaOdontologicaLeitura";
import IHOSLeitura from "./ficha/revisao/IHOSLeitura";
import PlanoLeitura from "./ficha/revisao/PlanoLeitura";
import ProcedimentosLeitura from "./ficha/revisao/ProcedimentosLeitura";
import { lerSecao } from "./ficha/revisao/rotulos";
import SangramentoLeitura from "./ficha/revisao/SangramentoLeitura";

interface Props {
  secaoId: string;
  dadosHistoricos: unknown;
  alunoNome: string;
  professorNome: string;
  criadoEm: string;
  dadosPessoaisHistoricos?: unknown;
}

const SECOES_COM_REGISTROS: ReadonlySet<string> = new Set(["sangramento", "ihos", "cpod-ceod"]);

function formatarData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function ConteudoHistorico({
  secaoId,
  dados,
  dadosPessoais,
}: {
  secaoId: string;
  dados: unknown;
  dadosPessoais: unknown;
}) {
  switch (secaoId) {
    case "dados-pessoais":
      return <DadosPessoaisLeitura dados={lerSecao(dadosPessoaisSchema, dados)} />;
    case "consentimento":
      return (
        <ConsentimentoLeitura
          dados={lerSecao(consentimentoSchema, dados)}
          paciente={lerSecao(dadosPessoaisSchema, dadosPessoais)}
        />
      );
    case "historia-medica":
      return <HistoriaMedicaLeitura dados={lerSecao(historiaMedicaSchema, dados)} />;
    case "historia-odontologica":
      return <HistoriaOdontologicaLeitura dados={lerSecao(historiaOdontologicaSchema, dados)} />;
    case "exames":
      return <ExamesLeitura dados={lerSecao(examesSchema, dados)} />;
    case "sangramento":
      return <SangramentoLeitura dados={lerSecao(sangramentoSchema, dados)} />;
    case "ihos":
      return <IHOSLeitura dados={lerSecao(ihosSchema, dados)} />;
    case "cpod-ceod":
      return <CPODLeitura dados={lerSecao(cpodSchema, dados)} />;
    case "plano-preventivo":
      return <PlanoLeitura dados={lerSecao(planoSchema, dados)} />;
    case "procedimentos":
      return <ProcedimentosLeitura dados={lerSecao(procedimentosSchema, dados)} />;
    case "conclusao":
      return <ConclusaoLeitura dados={lerSecao(conclusaoSchema, dados)} />;
    default:
      return null;
  }
}

export default function HistoricoSecao({
  secaoId,
  dadosHistoricos,
  alunoNome,
  professorNome,
  criadoEm,
  dadosPessoaisHistoricos,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const conteudoId = useId();
  const subtitulo = [alunoNome, professorNome, formatarData(criadoEm)].filter(Boolean).join(" · ");

  return (
    <section aria-label="Histórico anterior" className="rounded-field border border-line-soft bg-paper p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={conteudoId}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <History size={16} aria-hidden="true" className="shrink-0 text-ink-soft" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-ink">Histórico anterior</span>
          <span className="block truncate text-[11px] text-ink-faint">{subtitulo}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-ink-soft transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div id={conteudoId} className="mt-3 border-t border-line-soft pt-3">
          {SECOES_COM_REGISTROS.has(secaoId) && (
            <p className="mb-2 text-[12px] font-semibold text-ink-soft">Registros anteriores ({alunoNome})</p>
          )}
          <ConteudoHistorico secaoId={secaoId} dados={dadosHistoricos} dadosPessoais={dadosPessoaisHistoricos} />
        </div>
      )}
    </section>
  );
}
