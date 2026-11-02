import { useEffect, useState } from "react";
import { ACESSO_EXPIRADO_EVENT, formatarContagem } from "../lib/acesso";

interface Props {
  expiraEm: string;
  rotulo?: string;
  className?: string;
}

export default function TimerAcesso({ expiraEm, rotulo = "Expira em", className }: Props) {
  const [restante, setRestante] = useState(() => new Date(expiraEm).getTime() - Date.now());

  useEffect(() => {
    const alvo = new Date(expiraEm).getTime();
    const atualizar = () => {
      const r = alvo - Date.now();
      setRestante(r);
      if (r <= 0) {
        window.clearInterval(intervalo);
        window.dispatchEvent(new CustomEvent(ACESSO_EXPIRADO_EVENT));
      }
    };
    const intervalo = window.setInterval(atualizar, 1000);
    atualizar();
    return () => window.clearInterval(intervalo);
  }, [expiraEm]);

  return (
    <span role="timer" className={className}>
      {rotulo} <span className="tabular-nums">{formatarContagem(restante)}</span>
    </span>
  );
}
