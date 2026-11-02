import type { KeyboardEvent, MouseEvent } from "react";
import { Check, CircleAlert, Clock, Lock, PenLine, RefreshCw, RotateCcw, type LucideIcon } from "lucide-react";
import type { LocalProntuario } from "../db/dexie";
import { acessoVigente, pedidoPendente, pedidoRecusado } from "../lib/acesso";
import { formatarIdade } from "../lib/idade";
import { tempoRelativo } from "../lib/tempo";
import TimerRegressivo from "./TimerRegressivo";

interface Badge {
  icone: LucideIcon;
  classes: string;
  label: string;
}

const BADGES = {
  rascunho: { icone: PenLine, classes: "bg-[#E5E7EB] text-ink-soft", label: "Rascunho" },
  aguardando: { icone: Clock, classes: "bg-amber-tint text-amber", label: "Aguardando revisão" },
  devolvido: { icone: RotateCcw, classes: "bg-alt-tint text-alt", label: "Devolvido" },
  bloqueado: { icone: Lock, classes: "bg-alt-tint text-alt", label: "Bloqueado" },
  assinado: { icone: Check, classes: "bg-primary-tint text-primary", label: "Assinado" },
  recusado: { icone: CircleAlert, classes: "bg-alt-tint text-alt", label: "Acesso recusado" },
} satisfies Record<string, Badge>;

interface Props {
  prontuario: LocalProntuario;
  onAbrir: () => void;
  onSolicitarAcesso: () => void;
  onCorrigir: () => void;
}

function timestamp(iso: string | undefined, padrao: number): number {
  const ts = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(ts) ? ts : padrao;
}

export default function ProntuarioCard({ prontuario: p, onAbrir, onSolicitarAcesso, onCorrigir }: Props) {
  const semNome = p.pacienteNome.trim() === "";
  const vigente = acessoVigente(p);
  const recusado = pedidoRecusado(p);
  const bloqueado = p.status === "assinado" && !vigente && !recusado;
  const pendente = pedidoPendente(p);

  const badge: Badge = recusado
    ? BADGES.recusado
    : vigente
      ? BADGES.rascunho
      : bloqueado
        ? BADGES.bloqueado
        : p.status === "em_andamento"
          ? BADGES.rascunho
          : p.status === "enviado"
            ? BADGES.aguardando
            : p.status === "devolvido"
              ? BADGES.devolvido
              : BADGES.assinado;
  const Icone = badge.icone;

  const idade = p.pacienteDataNascimento ? formatarIdade(p.pacienteDataNascimento) : "";
  const tempo = tempoRelativo(timestamp(p.status === "devolvido" ? p.devolvidoEm : undefined, p.atualizadoEm));
  const marco = recusado
    ? "pedido de acesso recusado pelo professor"
    : p.status === "em_andamento"
      ? `editado ${tempo}`
      : p.status === "enviado"
        ? `enviado ${tempo}`
        : p.status === "devolvido"
          ? `devolvido pelo professor · ${tempo}`
          : p.assinadoPorNome
            ? `assinado por ${p.assinadoPorNome}`
            : p.assinadoEm
              ? `assinado em ${new Date(p.assinadoEm).toLocaleDateString("pt-BR")}`
              : "assinado";
  const meta = semNome ? "Aguardando preenchimento" : [idade, marco].filter(Boolean).join(" · ");

  const acao = recusado
    ? "Toque para solicitar novamente"
    : bloqueado
      ? pendente
        ? "Aguardando aprovação do professor"
        : "Toque para solicitar acesso"
      : null;

  const mostrarCadeado = bloqueado || recusado;

  function aoClicar() {
    if (recusado) return onSolicitarAcesso();
    if (bloqueado && !pendente) return onSolicitarAcesso();
    onAbrir();
  }

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    aoClicar();
  }

  function aoCorrigir(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onCorrigir();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      className="flex w-full cursor-pointer flex-col gap-3 rounded-card border border-line bg-raised p-4 text-left transition active:bg-paper"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <span
            className={`font-display text-[16px] font-semibold leading-tight ${semNome ? "text-ink-soft" : "text-ink"}`}
          >
            {semNome ? "Novo prontuário" : p.pacienteNome}
          </span>
          {mostrarCadeado &&
            (recusado ? (
              <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-alt" />
            ) : (
              <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-faint" />
            ))}
        </div>
        {vigente && (
          <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#DC2626]">
            Acesso expira em: <TimerRegressivo expiraEm={p.acessoExpiraEm!} />
          </span>
        )}
      </div>

      <p className="text-[12px] text-ink-soft">{meta}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${badge.classes}`}>
          <Icone size={12} aria-hidden="true" />
          {badge.label}
        </span>
        {!p.sincronizado && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-sync-tint px-2.5 py-1 text-[11px] font-semibold text-sync">
            <RefreshCw size={12} aria-hidden="true" />
            Não sincronizado
          </span>
        )}
        {acao && <span className="ml-auto text-[12.5px] font-semibold text-primary">{acao}</span>}
        {p.status === "devolvido" && (
          <button type="button" onClick={aoCorrigir} className="ml-auto text-[12.5px] font-semibold text-primary">
            Corrigir
          </button>
        )}
      </div>
    </div>
  );
}