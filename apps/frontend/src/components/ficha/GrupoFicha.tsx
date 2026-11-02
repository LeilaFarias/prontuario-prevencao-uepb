import { useId, type ReactNode } from "react";

interface Props {
  titulo: string;
  eyebrow?: string;
  subtitulo?: string;
  children: ReactNode;
}

export default function GrupoFicha({ titulo, eyebrow, subtitulo, children }: Props) {
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="rounded-card border border-line bg-raised p-4">
      <div className="mb-3">
        {eyebrow && (
          <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{eyebrow}</p>
        )}
        <h3 id={tituloId} className="font-display text-[15px] font-medium text-ink">
          {titulo}
        </h3>
        {subtitulo && <p className="mt-1 text-[12px] text-ink-faint">{subtitulo}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
