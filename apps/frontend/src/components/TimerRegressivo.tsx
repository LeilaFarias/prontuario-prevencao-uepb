import { useEffect, useState } from "react";
import { ACESSO_EXPIRADO_EVENT } from "../lib/acesso";

interface Props {
  expiraEm: string;
  onExpirar?: () => void;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatarHHMMSS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export default function TimerRegressivo({ expiraEm, onExpirar, className }: Props) {
  const [restante, setRestante] = useState(() => new Date(expiraEm).getTime() - Date.now());

  useEffect(() => {
    const alvo = new Date(expiraEm).getTime();
    let intervalo: number | undefined;
    const atualizar = () => {
      const r = alvo - Date.now();
      setRestante(r);
      if (r > 0) return;
      window.clearInterval(intervalo);
      onExpirar?.();
      window.dispatchEvent(new CustomEvent(ACESSO_EXPIRADO_EVENT));
    };
    intervalo = window.setInterval(atualizar, 1000);
    atualizar();
    return () => window.clearInterval(intervalo);
  }, [expiraEm, onExpirar]);

  return (
    <span role="timer" className={`tabular-nums ${className ?? ""}`}>
      {restante > 0 ? formatarHHMMSS(restante) : "expirado"}
    </span>
  );
}
