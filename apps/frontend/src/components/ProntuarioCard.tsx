import { Check, Clock, PenLine, RotateCcw, type LucideIcon } from "lucide-react";
import type { LocalProntuario, LocalStatus } from "../db/dexie";
import { calcularIdade, tempoRelativo } from "../lib/tempo";

interface Badge {
  icone: LucideIcon;
  fundo: string;
  texto: string;
  label: string;
}

const BADGE_POR_STATUS: Record<LocalStatus, Badge> = {
  em_andamento: { icone: PenLine, fundo: "bg-paper", texto: "text-ink-soft", label: "Em andamento" },
  enviado: { icone: Clock, fundo: "bg-sync-tint", texto: "text-sync", label: "Aguardando revisão" },
  assinado: { icone: Check, fundo: "bg-primary-tint", texto: "text-primary", label: "Assinado" },
  devolvido: { icone: RotateCcw, fundo: "bg-alt-tint", texto: "text-alt", label: "Devolvido" },
};

const ACAO_POR_STATUS: Record<LocalStatus, { label: string; cor: string }> = {
  em_andamento: { label: "Continuar →", cor: "text-primary" },
  enviado: { label: "Ver ficha →", cor: "text-sync" },
  assinado: { label: "Consultar →", cor: "text-primary" },
  devolvido: { label: "Corrigir →", cor: "text-alt" },
};

const PREFIXO_TEMPO: Record<LocalStatus, string> = {
  em_andamento: "Atualizado",
  enviado: "Enviado",
  assinado: "Assinado",
  devolvido: "Devolvido",
};

interface ProntuarioCardProps {
  prontuario: LocalProntuario;
  onAbrir: () => void;
}

export default function ProntuarioCard({ prontuario, onAbrir }: ProntuarioCardProps) {
  const { pacienteNome, status, atualizadoEm } = prontuario;
  const badge = BADGE_POR_STATUS[status];
  const semNome = pacienteNome.trim() === "";
  const acao = semNome && status === "em_andamento" ? { label: "Preencher →", cor: "text-primary" } : ACAO_POR_STATUS[status];
  const Icone = badge.icone;

  const tempo = tempoRelativo(atualizadoEm);
  const idade = calcularIdade(prontuario.pacienteDataNascimento);
  const subtitulo = semNome
    ? "Aguardando preenchimento"
    : idade !== null
      ? `${idade} anos · atualizado ${tempo}`
      : `atualizado ${tempo}`;
  const inicial = semNome ? "?" : pacienteNome.trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full rounded-card border border-line bg-raised p-4 text-left transition active:bg-paper"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[15px] font-semibold text-primary">
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[14.5px] font-semibold ${semNome ? "text-ink-soft" : "text-ink"}`}>
            {semNome ? "Novo prontuário" : pacienteNome}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-soft">{subtitulo}</div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${badge.fundo} ${badge.texto}`}
        >
          <Icone size={10} aria-hidden="true" />
          {badge.label}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-line-soft pt-2.5">
        <span className="text-[11.5px] text-ink-faint">
          {PREFIXO_TEMPO[status]} {tempo}
        </span>
        <span className={`text-[12.5px] font-semibold ${acao.cor}`}>{acao.label}</span>
      </div>
    </button>
  );
}
