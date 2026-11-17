import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { InvalidPinError, LockoutError, NotPreparedError } from "../lib/localAuth";

interface PinUnlockProps {
  onUnlock: (pin: string) => Promise<void>;
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.98)",
};
const caixa: React.CSSProperties = { width: "100%", maxWidth: 360, padding: 24, display: "grid", gap: 12 };

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function PinUnlock({ onUnlock }: PinUnlockProps) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [bloqueioAte, setBloqueioAte] = useState<number | null | undefined>(undefined);
  const [agora, setAgora] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [semPreparo, setSemPreparo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof bloqueioAte !== "number") return;
    const t = window.setInterval(() => setAgora(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, [bloqueioAte]);

  const bloqueado = bloqueioAte === null || (typeof bloqueioAte === "number" && agora < bloqueioAte);

  const bloquearEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") e.preventDefault();
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado || bloqueado || semPreparo || !pin) return;
    setErro(null);
    setOcupado(true);
    try {
      await onUnlock(pin);
    } catch (err) {
      setPin("");
      setOcupado(false);
      if (err instanceof InvalidPinError) {
        setFalhas(err.tentativasFalhas);
        setErro("PIN incorreto");
      } else if (err instanceof LockoutError) {
        setAgora(Date.now());
        setBloqueioAte(err.ate);
        setErro(null);
      } else if (err instanceof NotPreparedError) {
        setSemPreparo(true);
        setErro("Faça login online para configurar o PIN");
      } else {
        setErro("Não foi possível desbloquear. Tente novamente.");
      }
      inputRef.current?.focus();
    }
  }

  const msgBloqueio =
    bloqueioAte === null
      ? "Acesso offline bloqueado. Faça login online."
      : typeof bloqueioAte === "number"
        ? `Bloqueado até ${hhmm(bloqueioAte)}`
        : null;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="pin-unlock-titulo" onKeyDown={bloquearEsc}>
      <form style={caixa} onSubmit={enviar}>
        <h2 id="pin-unlock-titulo">Desbloquear</h2>
        <label>
          PIN
          <input
            ref={inputRef}
            type="password"
            autoFocus
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={ocupado || bloqueado || semPreparo}
            style={{ width: "100%" }}
          />
        </label>
        {erro && (
          <p role="alert" style={{ color: "#b00020", margin: 0 }}>
            {erro}
            {!semPreparo && falhas > 0 && ` (tentativas incorretas: ${falhas})`}
          </p>
        )}
        {bloqueado && msgBloqueio && (
          <p role="alert" style={{ color: "#b00020", margin: 0 }}>
            {msgBloqueio}
          </p>
        )}
        <button type="submit" disabled={ocupado || bloqueado || semPreparo}>
          {ocupado ? "Verificando..." : "Desbloquear"}
        </button>
      </form>
    </div>
  );
}