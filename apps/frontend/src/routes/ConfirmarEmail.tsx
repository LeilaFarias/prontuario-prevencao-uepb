import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";

type Estado = "verificando" | "confirmando" | "sucesso" | "invalido";

export default function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    if (!token) {
      setEstado("invalido");
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const resultado = await api.get<{ valido: boolean }>(`/auth/verify-email-token?token=${encodeURIComponent(token)}`);
        if (!ativo) return;
        if (!resultado.valido) {
          setEstado("invalido");
          return;
        }
        setEstado("confirmando");
        await api.post("/auth/confirm-email", { token });
        if (ativo) setEstado("sucesso");
      } catch {
        if (ativo) setEstado("invalido");
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Confirmar e-mail" tituloClassName="text-[16px]" />
      <main className="flex flex-1 flex-col items-center px-6 pb-8 pt-10 text-center">
        {(estado === "verificando" || estado === "confirmando") && (
          <>
            <Loader2 size={34} className="animate-spin text-primary" aria-hidden="true" />
            <h2 className="mt-5 font-display text-[24px] font-medium text-ink">Confirmando seu e-mail…</h2>
            <p className="mt-2 text-[13.5px] text-ink-soft">Aguarde enquanto validamos o link.</p>
          </>
        )}
        {estado === "sucesso" && (
          <>
            <CheckCircle2 size={42} className="text-primary" aria-hidden="true" />
            <h2 className="mt-5 font-display text-[24px] font-medium text-ink">E-mail confirmado!</h2>
            <p className="mt-2 text-[13.5px] text-ink-soft">Sua conta está pronta. Você já pode entrar no Prontuário Digital.</p>
            <Link to="/login" className="btn-primary mt-8 w-full">Ir para o login</Link>
          </>
        )}
        {estado === "invalido" && (
          <>
            <AlertTriangle size={42} className="text-alt" aria-hidden="true" />
            <h2 className="mt-5 font-display text-[24px] font-medium text-ink">Link inválido ou expirado</h2>
            <p className="mt-2 text-[13.5px] text-ink-soft">Solicite um novo link de confirmação na tela de login.</p>
            <Link to="/login" className="btn-primary mt-8 w-full">Voltar para o login</Link>
          </>
        )}
      </main>
    </div>
  );
}
