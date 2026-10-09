import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type Perfil, type SignupInput } from "@prontuario/shared";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";

const MOSTRAR_PROFESSOR = false;

export default function Cadastro() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { perfil: "aluno", nome: "", email: "", senha: "", matricula: "" },
  });

  const perfil = watch("perfil");

  function escolherPerfil(p: Perfil) {
    setValue("perfil", p);
    if (p === "aluno") {
      setValue("matricula", "");
      clearErrors("matricula");
    }
  }

  const [redirecionar, setRedirecionar] = useState(false);
  useEffect(() => {
    if (!redirecionar) return;
    const t = window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    return () => window.clearTimeout(t);
  }, [redirecionar, navigate]);

  async function onSubmit(dados: SignupInput) {
    setErro(null);
    try {
      await api.post("/auth/signup", {
        ...dados,
        matricula: dados.perfil === "professor" ? dados.matricula : undefined,
      });
      setSucesso(true);
      setRedirecionar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a conta.");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Criar conta" tituloClassName="text-[16px]" onVoltar={() => navigate("/login")} />
      <main className="flex flex-1 flex-col px-6 pb-8 pt-4">
        <h2 className="font-display text-[26px] font-medium leading-tight text-ink">Vamos criar sua conta</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          {MOSTRAR_PROFESSOR ? "Escolha seu perfil e preencha os dados de acesso." : "Preencha os dados de acesso."}
        </p>

        {MOSTRAR_PROFESSOR && (
        <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-field border border-line-soft bg-paper p-1">
          {(["aluno", "professor"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={perfil === p}
              onClick={() => escolherPerfil(p)}
              className={`h-10 rounded-[8px] text-[14px] font-medium transition ${
                perfil === p ? "bg-raised text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {p === "aluno" ? "Aluno" : "Professor"}
            </button>
          ))}
        </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="nome" className="label">Nome completo</label>
            <input id="nome" type="text" autoComplete="name" className="input" {...register("nome")} />
            {errors.nome && <p className="field-error">{errors.nome.message}</p>}
          </div>

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

          {MOSTRAR_PROFESSOR && perfil === "professor" && (
            <div>
              <label htmlFor="matricula" className="label">Matrícula</label>
              <input id="matricula" type="text" inputMode="numeric" className="input" {...register("matricula")} />
              {errors.matricula ? (
                <p className="field-error">{errors.matricula.message}</p>
              ) : (
                <p className="hint">Usada na assinatura e na liberação de acesso.</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="senha" className="label">Senha</label>
            <input id="senha" type="password" autoComplete="new-password" className="input" {...register("senha")} />
            {errors.senha ? (
              <p className="field-error">{errors.senha.message}</p>
            ) : (
              <p className="hint">Mínimo de 8 caracteres.</p>
            )}
          </div>

          {erro && <div role="alert" className="banner-erro">{erro}</div>}
          {sucesso && <div role="status" className="banner-ok">Conta criada! Redirecionando para o login…</div>}

          <button type="submit" disabled={isSubmitting || sucesso} className="btn-primary">
            {isSubmitting ? "Criando…" : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-ink-soft">
          Já tem conta? <Link to="/login" className="font-medium text-primary">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
