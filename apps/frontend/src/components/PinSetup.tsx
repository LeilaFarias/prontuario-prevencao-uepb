import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CredentialExistsError, PIN_TAMANHO_MINIMO } from "../lib/localAuth";

interface PinSetupProps {
  onPrepare: (pin: string) => Promise<void>;
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

export function PinSetup({ onPrepare }: PinSetupProps) {
  const [pin, setPin] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinRef.current?.focus();
  }, []);

  const bloquearEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") e.preventDefault();
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (pin.length < PIN_TAMANHO_MINIMO) {
      setErro(`O PIN precisa ter pelo menos ${PIN_TAMANHO_MINIMO} caracteres.`);
      return;
    }
    if (pin !== confirmacao) {
      setErro("O PIN e a confirmação não coincidem.");
      return;
    }
    setErro(null);
    setOcupado(true);
    try {
      await onPrepare(pin);
    } catch (err) {
      setErro(
        err instanceof CredentialExistsError
          ? "Já existe credencial neste aparelho"
          : "Não foi possível criar o PIN. Tente novamente.",
      );
      setOcupado(false);
    }
  }

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="pin-setup-titulo" onKeyDown={bloquearEsc}>
      <form style={caixa} onSubmit={enviar}>
        <h2 id="pin-setup-titulo">Crie um PIN para uso offline</h2>
        <p>Este PIN protege os dados deste aparelho quando você estiver sem internet.</p>
        <label>
          PIN
          <input
            ref={pinRef}
            type="password"
            autoFocus
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={ocupado}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Confirmar PIN
          <input
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            disabled={ocupado}
            style={{ width: "100%" }}
          />
        </label>
        {erro && (
          <p role="alert" style={{ color: "#b00020", margin: 0 }}>
            {erro}
          </p>
        )}
        <button type="submit" disabled={ocupado}>
          {ocupado ? "Criando..." : "Criar PIN"}
        </button>
      </form>
    </div>
  );
}