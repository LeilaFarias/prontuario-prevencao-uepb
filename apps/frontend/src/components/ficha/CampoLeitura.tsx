import type { ReactNode } from "react";

export interface CampoLeituraProps {
  label: string;
  valor?: string | number | boolean | null;
  multiline?: boolean;
  children?: ReactNode;
}

function formatar(v: CampoLeituraProps["valor"]): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v).trim();
}

export default function CampoLeitura({ label, valor, multiline = false, children }: CampoLeituraProps) {
  const texto = formatar(valor);
  const vazio = !children && texto === "";

  return (
    <div className="flex flex-col gap-1 border-b border-line-soft py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">{label}</span>
      {children ? (
        children
      ) : (
        <span
          className={`text-[13.5px] ${vazio ? "text-ink-faint" : "text-ink"} ${multiline ? "whitespace-pre-wrap" : ""}`}
        >
          {vazio ? "—" : texto}
        </span>
      )}
    </div>
  );
}
