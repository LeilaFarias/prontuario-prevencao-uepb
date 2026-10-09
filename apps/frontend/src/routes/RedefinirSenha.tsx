import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@prontuario/shared";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";

type Estado = "verificando" | "valido" | "invalido";

function CampoSenha(props: {
  id: string;
  label: string;
  autoComplete: string;
  erro?: string;
  hint?: string;
  disabled: boolean;
  registro: UseFormRegisterReturn;
}) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div>
      <label htmlFor={props.id} className="label">{props.label}</label>
      <div className="relative">
        <input
          id={props.id}
          type={mostrar ? "text" : "password"}
          autoComplete={props.autoComplete}
          disabled={props.disabled}
          className="input pr-12 disabled:opacity-60"
          {...props.registro}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          disabled={props.disabled}
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-ink-faint"
        >
          {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {props.erro ? <p className="field-error">{props.erro}</p> : props.hint && <p className="hint">{props.hint}</p>}
    </div>
  );
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>("verificando");
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, novaSenha: "", confirmarSenha: "" },
  });

  useEffect(() => {
    if (!token) {
      setEstado("invalido");
      return;
    }
    let ativo = true;
    api
      .get<{ valido: boolean }>(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => ativo && setEstado(r.valido ? "valido" : "invalido"))
      .catch(() => ativo && setEstado("invalido"));
    return () => {
      ativo = false;
    };
  }, [token]);

  async function onSubmit(dados: ResetPasswordInput) {
    setErro(null);
    try {
      await api.post("/auth/reset-password", { token, novaSenha: dados.novaSenha });
      navigate("/login", { replace: true, state: { senhaAlterada: true } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a senha.");
    }
  }

  const verificando = estado === "verificando";

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Nova senha" tituloClassName="text-[16px]" onVoltar={() => navigate("/login")} />
      <main className="flex flex-1 flex-col px-6 pb-8 pt-8">
        {estado === "invalido" ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-alt-tint text-alt">
              <AlertTriangle size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-center font-display text-[24px] font-medium text-ink">Link inválido ou expirado</h2>
            <p className="mt-2 text-center text-[13.5px] text-ink-soft">
              Este link já foi usado ou expirou. Solicite um novo.
            </p>
            <button type="button" onClick={() => navigate("/recuperar")} className="btn-primary mt-8">
              Solicitar novo link
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Lock size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-center font-display text-[24px] font-medium text-ink">Criar nova senha</h2>
            <p className="mt-2 text-center text-[13.5px] text-ink-soft">Defina uma nova senha para sua conta.</p>

            {verificando && (
              <p role="status" className="mt-6 flex items-center justify-center gap-2 text-[13px] text-ink-soft">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Verificando link…
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
              <CampoSenha
                id="novaSenha"
                label="Nova senha"
                autoComplete="new-password"
                erro={errors.novaSenha?.message}
                hint="Use letras, números e ao menos um caractere especial."
                disabled={verificando || isSubmitting}
                registro={register("novaSenha")}
              />
              <CampoSenha
                id="confirmarSenha"
                label="Confirmar nova senha"
                autoComplete="new-password"
                erro={errors.confirmarSenha?.message}
                disabled={verificando || isSubmitting}
                registro={register("confirmarSenha")}
              />

              {erro && <div role="alert" className="banner-erro">{erro}</div>}

              <button type="submit" disabled={verificando || isSubmitting} className="btn-primary">
                {isSubmitting ? "Salvando…" : "Salvar nova senha"}
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
