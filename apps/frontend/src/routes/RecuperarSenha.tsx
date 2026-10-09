import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@prontuario/shared";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";

export default function RecuperarSenha() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(dados: ForgotPasswordInput) {
    setErro(null);
    try {
      await api.post("/auth/forgot-password", dados);
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o link.");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Recuperar senha" tituloClassName="text-[16px]" onVoltar={() => navigate("/login")} />
      <main className="flex flex-1 flex-col px-6 pb-8 pt-8">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary`}
        >
          {enviado ? <CheckCircle2 size={28} aria-hidden="true" /> : <Mail size={28} aria-hidden="true" />}
        </div>

        {enviado ? (
          <>
            <h2 className="mt-5 text-center font-display text-[24px] font-medium text-ink">Verifique seu e-mail</h2>
            <p className="mt-2 text-center text-[13.5px] text-ink-soft">
              Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha. Confira também a caixa de
              spam.
            </p>
            <button type="button" onClick={() => navigate("/login")} className="btn-ghost mt-8">
              Voltar para o login
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-center font-display text-[24px] font-medium text-ink">Esqueceu sua senha?</h2>
            <p className="mt-2 text-center text-[13.5px] text-ink-soft">
              Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor="email" className="label">E-mail cadastrado</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  className="input"
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="field-error">{errors.email.message}</p>
                ) : (
                  <p className="hint">O link expira em 30 minutos por segurança.</p>
                )}
              </div>

              {erro && <div role="alert" className="banner-erro">{erro}</div>}

              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? "Enviando…" : "Enviar link de recuperação"}
              </button>
            </form>

            <p className="mt-6 text-center text-[14px]">
              <Link to="/login" className="font-medium text-primary">Voltar para o login</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
