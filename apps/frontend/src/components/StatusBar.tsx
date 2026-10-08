import { useSyncStatus } from "../hooks/useSyncStatus";

export default function StatusBar() {
  const { online, pendentes } = useSyncStatus();

  if (online && pendentes === 0) return null;

  const texto = online
    ? `Sincronizando (${pendentes})…`
    : `Offline — ${pendentes} ${pendentes === 1 ? "alteração" : "alterações"} na fila`;
  const cores = online ? "bg-prof-tint text-prof" : "bg-alt-tint text-alt";

  return (
    <div role="status" className={`flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-medium ${cores}`}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
      {texto}
    </div>
  );
}
