import { CloudOff, RefreshCw } from "lucide-react";
import { useSyncStatus } from "../hooks/useSyncStatus";

const pad = (n: number) => String(n).padStart(2, "0");

function formatarHora(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pill compacta com o estado de sincronização. Oculta quando online, sem fila e sem salvamento prévio. */
export default function StatusBar({ className = "" }: { className?: string }) {
  const { online, pendentes, ultimoSalvamento } = useSyncStatus();

  let texto: string;
  let cores: string;
  let Icone = RefreshCw;
  let girando = false;

  if (!online) {
    Icone = CloudOff;
    cores = "bg-alt-tint text-alt";
    texto =
      pendentes === 0
        ? "Offline — sem alterações pendentes"
        : `Offline — ${pendentes} ${pendentes === 1 ? "alteração" : "alterações"} na fila`;
  } else if (pendentes > 0) {
    cores = "bg-sync-tint text-sync";
    girando = true;
    texto = `Sincronizando (${pendentes})…`;
  } else if (ultimoSalvamento !== null) {
    cores = "bg-sync-tint text-sync";
    texto = `Sincronizado às ${formatarHora(ultimoSalvamento)}`;
  } else {
    return null;
  }

  return (
<span
  role="status"
  className={`inline-flex w-fit items-center gap-1.5 rounded-pill py-1 pl-[7px] pr-[9px] text-[11.5px] font-semibold leading-none ${cores} ${className}`}
>
  <Icone
    size={12}
    className={`shrink-0 ${girando ? "animate-spin" : ""}`}
    aria-hidden="true"
  />
  <span className="leading-none">{texto}</span>
</span>
  );
}
