import { startTransition, useEffect, useRef, useState } from "react";

const LIMIAR_PX = 80;

export function usePuxarParaAtualizar(aoAtualizar: () => Promise<unknown>): {
  puxando: boolean;
  atualizando: boolean;
} {
  const [puxando, setPuxando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const aoAtualizarRef = useRef(aoAtualizar);
  aoAtualizarRef.current = aoAtualizar;
  const emCurso = useRef(false);

  useEffect(() => {
    let inicioY: number | null = null;
    let passou = false;
    const noTopo = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;

    const aoComecar = (e: TouchEvent) => {
      inicioY = noTopo() && !emCurso.current && e.touches.length === 1 ? e.touches[0]!.clientY : null;
      passou = false;
    };

    const aoMover = (e: TouchEvent) => {
      if (inicioY === null) return;
      const ultrapassou = e.touches[0]!.clientY - inicioY >= LIMIAR_PX && noTopo();
      if (ultrapassou === passou) return;
      passou = ultrapassou;
      setPuxando(ultrapassou);
    };

    const aoTerminar = () => {
      const disparar = passou;
      inicioY = null;
      passou = false;
      setPuxando(false);
      if (!disparar || emCurso.current) return;
      emCurso.current = true;
      setAtualizando(true);
      void Promise.resolve(aoAtualizarRef.current())
        .catch(() => undefined)
        .finally(() => {
          emCurso.current = false;
          startTransition(() => setAtualizando(false));
        });
    };

    document.addEventListener("touchstart", aoComecar, { passive: true });
    document.addEventListener("touchmove", aoMover, { passive: true });
    document.addEventListener("touchend", aoTerminar);
    document.addEventListener("touchcancel", aoTerminar);
    return () => {
      document.removeEventListener("touchstart", aoComecar);
      document.removeEventListener("touchmove", aoMover);
      document.removeEventListener("touchend", aoTerminar);
      document.removeEventListener("touchcancel", aoTerminar);
    };
  }, []);

  return { puxando, atualizando };
}
