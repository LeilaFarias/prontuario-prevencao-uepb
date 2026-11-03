import { AlertTriangle, Check } from "lucide-react";
import type { ComparacaoRegistro, GrupoComparacao } from "../../../lib/comparacaoCPOD";

// Subgrid ainda falha em WebViews antigos: cada linha repete o mesmo template de 3 colunas.
const COLUNAS = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]";

function Grupo({ grupo }: { grupo: GrupoComparacao }) {
  return (
    <>
      <div role="row" className="bg-prof-tint px-3 py-1.5">
        <span role="rowheader" className="block text-[11px] font-bold uppercase tracking-wider text-prof">
          {grupo.titulo}
          <span className="ml-1.5 font-medium normal-case tracking-normal opacity-80">· {grupo.subtitulo}</span>
        </span>
      </div>

      {grupo.linhas.map((l) => {
        const cor = l.confere ? "text-primary" : "text-alt";
        const fundo = l.confere ? "" : "bg-alt-tint";
        const tamanho = l.total ? "font-display text-[16px] font-semibold" : "text-[13.5px] font-medium";
        return (
          <div
            key={l.chave}
            role="row"
            className={`${COLUNAS} items-center border-b border-line-soft px-3 py-2 ${fundo} ${
              l.total ? "border-t border-t-line" : ""
            }`}
          >
            <span role="cell" className={`${l.total ? "font-display text-[14px] font-semibold text-ink" : "text-[12.5px] text-ink-soft"}`}>
              {l.rotulo}
            </span>
            <span role="cell" className={`text-center ${tamanho} ${cor}`}>
              {grupo.semRegistro ? "—" : l.aluno === "" ? "—" : l.aluno}
            </span>
            <span role="cell" className={`text-center ${tamanho} ${cor}`}>
              {grupo.semRegistro ? "—" : l.sistema}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default function ComparacaoCPOD({ comparacao }: { comparacao: ComparacaoRegistro }) {
  return (
    <div>
      <div
        role="table"
        aria-label="Comparação entre o cálculo do aluno e o do sistema"
        className="overflow-hidden rounded-field border border-line"
      >
        <div role="row" className={`${COLUNAS} bg-paper px-3 py-2`}>
          <span role="columnheader" className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
            Componente
          </span>
          <span role="columnheader" className="text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
            Aluno
          </span>
          <span role="columnheader" className="text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
            Sistema
          </span>
        </div>
        <Grupo grupo={comparacao.cpod} />
        <Grupo grupo={comparacao.ceod} />
      </div>

      {comparacao.confere ? (
        <p className="mt-3 flex items-center gap-2 rounded-field bg-primary-tint px-3 py-2.5 text-[12.5px] font-semibold text-primary">
          <Check size={15} className="shrink-0" aria-hidden="true" />
          Cálculo do aluno confere com o sistema
        </p>
      ) : (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-field bg-alt-tint px-3 py-2.5 text-[12.5px] font-semibold text-alt"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          Divergência detectada — confira com o aluno antes de assinar
        </p>
      )}
    </div>
  );
}
