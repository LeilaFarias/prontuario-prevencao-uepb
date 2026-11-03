import { RefreshCw, WifiOff } from "lucide-react";
import { useSyncStatus } from "../hooks/useSyncStatus";

const pad = (n: number) => String(n).padStart(2, "0");

function formatarHora(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StatusBar({ className = "" }: { className?: string }) {
  const { online, pendentes, ultimoSalvamento } = useSyncStatus();

  if (!online) {
    const texto =
      pendentes === 0
        ? "Você está sem internet"
        : `Sem internet — ${pendentes} ${pendentes === 1 ? "alteração" : "alterações"} pendente${pendentes === 1 ? "" : "s"}`;

    return (
      <span
        role="status"
        className={`inline-flex w-fit items-center gap-1.5 rounded-pill border border-alt/20 bg-alt-tint py-1 pl-[7px] pr-[9px] text-[11.5px] font-semibold leading-none text-alt ${className}`}
      >
        <WifiOff size={12} className="shrink-0" aria-hidden="true" />
        <span className="leading-none">{texto}</span>
      </span>
    );
  }

  if (pendentes > 0) {
    return (
      <span
        role="status"
        className={`inline-flex w-fit items-center gap-1.5 rounded-pill bg-sync-tint py-1 pl-[7px] pr-[9px] text-[11.5px] font-semibold leading-none text-sync ${className}`}
      >
        <RefreshCw size={12} className="shrink-0 animate-spin" aria-hidden="true" />
        <span className="leading-none">
          Sincronizando ({pendentes})…
        </span>
      </span>
    );
  }

  if (ultimoSalvamento !== null) {
    return (
      <span
        role="status"
        className={`inline-flex w-fit items-center gap-1.5 rounded-pill bg-sync-tint py-1 pl-[7px] pr-[9px] text-[11.5px] font-semibold leading-none text-sync ${className}`}
      >
        <RefreshCw size={12} className="shrink-0" aria-hidden="true" />
        <span className="leading-none">
          Salvo neste aparelho às {formatarHora(ultimoSalvamento)}
        </span>
      </span>
    );
  }

  return null;
}