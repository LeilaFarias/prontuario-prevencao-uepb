import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput, type LoginResponse } from "@prontuario/shared";
import { api } from "../lib/api";
import { saveSession } from "../lib/session";

function Dente() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.5c-1.074-.586-2.583-1.5-4-1.5-2.1 0-4 1.247-4 5 0 4.899 1.056 8.41 2.671 10.537.573.756 1.97.521 2.567-.236.398-.505.819-1.439 1.262-2.801.292-.771.892-1.504 1.5-1.5.607-.004 1.208.729 1.5 1.5.443 1.362.864 2.295 1.262 2.8.597.759 1.994.993 2.567.237 1.615-2.127 2.671-5.637 2.671-10.537 0-3.753-1.9-5-4-5-1.417 0-2.926.914-4 1.5z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const senhaAlterada = (location.state as { senhaAlterada?: boolean } | null)?.senhaAlterada === true;
  const sessaoExpirada =
    params.get("sessao") === "expirada" ||
    (location.state as { sessaoExpirada?: boolean } | null)?.sessaoExpirada === true;
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(dados: LoginInput) {
    setErro(null);
    try {
      const sessao = await api.post<LoginResponse>("/auth/login", dados);
      saveSession(sessao);
      navigate("/prontuarios", { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Dente />
      </div>
      <h1 className="mt-5 text-center font-display text-[24px] font-medium text-ink">Prontuário Digital</h1>
      <p className="mt-1 text-center text-[12.5px] text-ink-soft">Clínica de Prevenção em Saúde Bucal · UEPB</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            className="input"
            {...register("email")}
          />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="senha" className="label">Senha</label>
          <div className="relative">
            <input
              id="senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              className="input pr-12"
              {...register("senha")}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-ink-faint"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.senha && <p className="field-error">{errors.senha.message}</p>}
        </div>

        <div className="-mt-1 text-right">
          <Link to="/recuperar" className="text-[13px] font-medium text-primary">Esqueci minha senha</Link>
        </div>

        {senhaAlterada && (
          <div role="status" className="banner-ok">Senha alterada com sucesso. Faça login com a nova senha.</div>
        )}
        {sessaoExpirada && !senhaAlterada && (
          <div role="status" className="banner-erro">Sua sessão expirou. Entre novamente.</div>
        )}
        {erro && <div role="alert" className="banner-erro">{erro}</div>}

        <button type="submit" disabled={isSubmitting} className="btn-dark">
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[12.5px] text-ink-faint">
        <span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" />
      </div>

      <p className="text-center text-[14px] text-ink-soft">
        Novo por aqui? <Link to="/cadastro" className="font-medium text-primary">Criar conta</Link>
      </p>
    </main>
  );
}
