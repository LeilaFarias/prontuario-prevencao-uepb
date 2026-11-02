import type { ReactNode } from "react";

type Tom = "primary" | "alt" | "prof" | "sync";

const CORES_ICONE: Record<Tom, string> = {
  primary: "bg-primary-tint text-primary",
  alt: "bg-alt-tint text-alt",
  prof: "bg-prof-tint text-prof",
  sync: "bg-sync-tint text-sync",
};

export function IconeModal({ children, tom }: { children: ReactNode; tom: Tom }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-14 w-14 items-center justify-center rounded-full ${CORES_ICONE[tom]}`}
    >
      {children}
    </div>
  );
}

export function Detalhes({ linhas }: { linhas: Array<[string, string]> }) {
  return (
    <dl className="flex flex-col gap-2 rounded-card border border-line-soft bg-paper p-4">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex items-baseline justify-between gap-4 text-[13px]">
          <dt className="shrink-0 text-ink-soft">{rotulo}</dt>
          <dd className="min-w-0 break-words text-right font-semibold text-ink">{valor || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
