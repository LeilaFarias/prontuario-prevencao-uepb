import { useState } from "react";
import { QUADRANTES } from "../../lib/odontograma";
import {
  CODIGOS_CONDICAO,
  codigoExibido,
  condicaoDoCodigo,
  estiloCondicao,
  isDenteDeciduo,
  type CodigoCondicao,
} from "../../lib/cpod";
import BottomSheet from "../BottomSheet";

interface Props {
  dentes: Record<string, string>;
  onChange: (numero: number, codigo: string | null) => void;
  disabled?: boolean;
}

function Chip({ condicao, deciduo, tamanho }: { condicao: CodigoCondicao; deciduo: boolean; tamanho: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md border text-[11px] font-bold"
      style={{ width: tamanho, height: tamanho, ...estiloCondicao(condicao) }}
    >
      {codigoExibido(condicao, deciduo)}
    </span>
  );
}

function LinhaDentes({
  numeros,
  deciduo,
  dentes,
  disabled,
  onAbrir,
}: {
  numeros: ReadonlyArray<number>;
  deciduo: boolean;
  dentes: Record<string, string>;
  disabled: boolean;
  onAbrir: (numero: number) => void;
}) {
  const estilo = {
    gridTemplateColumns: `repeat(${numeros.length}, 1fr)`,
    padding: deciduo ? "0 9%" : undefined,
  };

  return (
    <>
      <div className="grid gap-[3px]" style={estilo}>
        {numeros.map((n) => (
          <span key={n} className="py-0.5 text-center text-[10px] font-semibold text-ink-soft">
            {n}
          </span>
        ))}
      </div>
      <div className="grid gap-[3px]" style={estilo}>
        {numeros.map((n) => {
          const codigo = dentes[String(n)];
          const condicao = condicaoDoCodigo(codigo, deciduo);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onAbrir(n)}
              aria-label={`Dente ${n}: ${condicao ? condicao.nome : "sem código"}`}
              className={`flex min-h-[26px] items-center justify-center rounded-md border-[1.5px] text-[11px] font-bold transition ${
                condicao ? "" : "border-line bg-raised text-ink-faint"
              } ${disabled ? "cursor-default" : ""}`}
              style={condicao ? estiloCondicao(condicao) : undefined}
            >
              {condicao ? codigoExibido(condicao, deciduo) : "–"}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function OdontogramaCPOD({ dentes, onChange, disabled = false }: Props) {
  const [denteAberto, setDenteAberto] = useState<number | null>(null);

  const abrir = (numero: number) => {
    if (!disabled) setDenteAberto(numero);
  };
  const fechar = () => setDenteAberto(null);

  const deciduoAberto = denteAberto !== null && isDenteDeciduo(denteAberto);
  const codigoAtual = denteAberto !== null ? dentes[String(denteAberto)] : undefined;

  const escolher = (codigo: string | null) => {
    if (denteAberto === null) return;
    onChange(denteAberto, codigo);
    fechar();
  };

  return (
    <div>
      <div className="flex flex-col gap-5">
        {QUADRANTES.map((q) => (
          <div key={q.nome}>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{q.nome}</h4>
            <LinhaDentes numeros={q.permanentes} deciduo={false} dentes={dentes} disabled={disabled} onAbrir={abrir} />
            <div className="h-1.5" />
            <LinhaDentes numeros={q.deciduos} deciduo dentes={dentes} disabled={disabled} onAbrir={abrir} />
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {CODIGOS_CONDICAO.map((c) => (
            <li key={c.codigo} className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
              <span
                aria-hidden="true"
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[9.5px] font-bold"
                style={estiloCondicao(c)}
              >
                {c.codigo}
              </span>
              <span>
                {c.codigo}/{c.deciduo} · {c.nome}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BottomSheet
        open={denteAberto !== null}
        onClose={fechar}
        title={`Dente ${denteAberto ?? ""}`}
        subtitle={deciduoAberto ? "Decíduo" : "Permanente"}
      >
        <div className="grid grid-cols-2 gap-2">
          {CODIGOS_CONDICAO.map((c) => {
            const atual = codigoAtual === codigoExibido(c, deciduoAberto);
            return (
              <button
                key={c.codigo}
                type="button"
                aria-pressed={atual}
                onClick={() => escolher(codigoExibido(c, deciduoAberto))}
                className={`flex items-center gap-2 rounded-xl border-[1.5px] p-3 text-left transition ${
                  atual ? "border-primary bg-primary-tint" : "border-line bg-raised"
                }`}
              >
                <Chip condicao={c} deciduo={deciduoAberto} tamanho={22} />
                <span className="text-[12.5px] font-medium text-ink">{c.nome}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => escolher(null)}
          className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-alt bg-transparent py-3 text-[13px] font-semibold text-alt"
        >
          Limpar código do dente
        </button>
      </BottomSheet>
    </div>
  );
}
