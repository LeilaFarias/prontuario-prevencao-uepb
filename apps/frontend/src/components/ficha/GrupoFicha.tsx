import { useId, type ReactNode } from "react";

interface Props {
  titulo: string;
  children: ReactNode;
}

export default function GrupoFicha({ titulo, children }: Props) {
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="rounded-card border border-line bg-raised p-4">
      <h3 id={tituloId} className="mb-3 font-display text-[15px] font-medium text-ink">
        {titulo}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
