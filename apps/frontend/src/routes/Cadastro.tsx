import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupFormSchema, type Perfil, type SignupFormInput } from "@prontuario/shared";
import PinExplicacao, { TEXTOS_PIN } from "../components/PinExplicacao";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";

const apenasDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 8);

type Etapa = "dados" | "pin";

export default function Cadastro() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("Conta criada!");
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { perfil: "aluno", nome: "", email: "", senha: "", matricula: "", pin: "", confirmarPin: "" },
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

  async function avancar() {
    setErro(null);
    const campos: (keyof SignupFormInput)[] = ["nome", "email", "senha"];
    if (perfil === "professor") campos.push("matricula");
    if (await trigger(campos)) setEtapa("pin");
  }

  async function onSubmit({ confirmarPin: _confirmarPin, ...dados }: SignupFormInput) {
    setErro(null);
    try {
      const resultado = await api.post<{ emailConfirmationRequired: boolean; message?: string }>("/auth/signup", {
        ...dados,
        matricula: dados.perfil === "professor" ? dados.matricula : undefined,
      });
      setMensagemSucesso(resultado.message ?? (resultado.emailConfirmationRequired
        ? "Cadastro realizado! Enviamos um link para confirmar seu e-mail."
        : "Conta criada! Agora você já pode entrar."));
      setSucesso(true);
      setRedirecionar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a conta.");
      setEtapa("dados");
    }
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    void (etapa === "dados" ? avancar() : handleSubmit(onSubmit)());
  }

  const textos = TEXTOS_PIN[perfil];

  return (
    <div className="flex flex-1 flex-col">
      <Topbar
        titulo="Criar conta"
        tituloClassName="text-[16px]"
        onVoltar={() => (etapa === "pin" && !sucesso ? setEtapa("dados") : navigate("/login"))}
      />
      <main className="flex flex-1 flex-col px-6 pb-8 pt-4">
        <p className="text-[12px] font-medium text-ink-faint">Etapa {etapa === "dados" ? 1 : 2} de 2</p>
        <h2 className="mt-1 font-display text-[26px] font-medium leading-tight text-ink">
          {etapa === "dados" ? "Vamos criar sua conta" : textos.titulo}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          {etapa === "dados" ? "Escolha seu perfil e preencha os dados de acesso." : textos.subtitulo}
        </p>

        {etapa === "dados" && (
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

        <form onSubmit={aoEnviar} className="mt-5 flex flex-col gap-4" noValidate>
          {etapa === "dados" && (
          <>
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

          {perfil === "professor" && (
            <div>
              <label htmlFor="matricula" className="label">Matrícula</label>
              <input
                id="matricula"
                type="text"
                inputMode="numeric"
                className="input"
                {...register("matricula")}
              />
              {errors.matricula && (
                <p className="field-error">{errors.matricula.message}</p>
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

          </>
          )}

          {etapa === "pin" && (
            <>
              <PinExplicacao perfil={perfil} />

              <div>
                <label htmlFor="pin" className="label">{textos.rotuloPin}</label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="off"
                  autoFocus
                  placeholder={textos.placeholderPin}
                  className="input"
                  {...register("pin", { onChange: (e) => { e.target.value = apenasDigitos(e.target.value); } })}
                />
                {errors.pin && <p className="field-error">{errors.pin.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmarPin" className="label">Confirme seu PIN</label>
                <input
                  id="confirmarPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="off"
                  placeholder="Digite novamente o PIN"
                  className="input"
                  {...register("confirmarPin", { onChange: (e) => { e.target.value = apenasDigitos(e.target.value); } })}
                />
                {errors.confirmarPin && <p className="field-error">{errors.confirmarPin.message}</p>}
              </div>
            </>
          )}

          {erro && <div role="alert" className="banner-erro">{erro}</div>}
          {sucesso && <div role="status" className="banner-ok">{mensagemSucesso} Redirecionando para o login…</div>}

          <button type="submit" disabled={isSubmitting || sucesso} className="btn-primary">
            {etapa === "dados" ? "Continuar" : isSubmitting ? "Criando…" : "Criar conta"}
          </button>
          {etapa === "pin" && !sucesso && (
            <button type="button" disabled={isSubmitting} onClick={() => setEtapa("dados")} className="btn-ghost">
              Voltar
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-[14px] text-ink-soft">
          Já tem conta? <Link to="/login" className="font-medium text-primary">Entrar</Link>
        </p>
        <p className="mt-4 text-center text-[12px]">
          <Link to="/privacidade" className="font-medium text-primary">Privacidade e segurança</Link>
        </p>
      </main>
    </div>
  );
}
