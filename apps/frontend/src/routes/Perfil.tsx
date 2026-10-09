import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, LogOut, TriangleAlert } from "lucide-react";
import {
  alterarMatriculaSchema,
  alterarSenhaBaseSchema,
  atualizarPerfilSchema,
  excluirContaSchema,
  type UsuarioMe,
} from "@prontuario/shared";
import BottomSheet from "../components/BottomSheet";
import PerfilLinha from "../components/PerfilLinha";
import Topbar from "../components/Topbar";
import { api, ApiError } from "../lib/api";
import { clearSession, getSession, updateSessionUser } from "../lib/session";

type ModalAberto = null | "nome" | "email" | "matricula" | "senha" | "excluir";

interface Tema {
  texto: string;
  fundo: string;
  tint: string;
}

const TEMA_ALUNO: Tema = { texto: "text-primary", fundo: "bg-primary", tint: "bg-primary-tint" };
const TEMA_PROFESSOR: Tema = { texto: "text-prof", fundo: "bg-prof", tint: "bg-prof-tint" };

const SEMESTRE_VIGENTE: { inicio: string | null; fim: string | null } = { inicio: null, fim: null };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente novamente.");

function BotoesModal({ tema, enviando, rotulo, destrutivo, onCancelar }: {
  tema: Tema;
  enviando: boolean;
  rotulo: string;
  destrutivo?: boolean;
  onCancelar: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      <button type="submit" disabled={enviando} className={`btn text-white ${destrutivo ? "bg-alt" : tema.fundo}`}>
        {enviando ? "Salvando…" : rotulo}
      </button>
      <button type="button" onClick={onCancelar} className="btn-ghost">Cancelar</button>
    </div>
  );
}

function ModalCampo({ titulo, subtitulo, label, schema, valorInicial, type = "text", inputMode, hint, tema, onSalvar, onClose }: {
  titulo: string;
  subtitulo: string;
  label: string;
  schema: z.ZodString;
  valorInicial: string;
  type?: string;
  inputMode?: "numeric";
  hint?: string;
  tema: Tema;
  onSalvar: (valor: string) => Promise<void>;
  onClose: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ valor: string }>({
    resolver: zodResolver(z.object({ valor: schema })),
    defaultValues: { valor: valorInicial },
  });

  async function enviar({ valor }: { valor: string }) {
    setErro(null);
    try {
      await onSalvar(valor);
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={titulo} subtitle={subtitulo}>
      <form onSubmit={handleSubmit(enviar)} noValidate>
        <label htmlFor="valor" className="label">{label}</label>
        <input id="valor" type={type} inputMode={inputMode} autoFocus className="input" {...register("valor")} />
        {errors.valor ? <p className="field-error">{errors.valor.message}</p> : hint && <p className="hint">{hint}</p>}
        {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}
        <BotoesModal tema={tema} enviando={isSubmitting} rotulo="Salvar alteração" onCancelar={onClose} />
      </form>
    </BottomSheet>
  );
}

const senhaFormSchema = alterarSenhaBaseSchema
  .extend({ confirmar: z.string().min(1, "Confirme a nova senha") })
  .superRefine((d, ctx) => {
    if (d.senhaAtual && d.novaSenha === d.senhaAtual) {
      ctx.addIssue({ code: "custom", path: ["novaSenha"], message: "A nova senha deve ser diferente da atual" });
    }
    if (d.confirmar && d.novaSenha !== d.confirmar) {
      ctx.addIssue({ code: "custom", path: ["confirmar"], message: "As senhas não coincidem" });
    }
  });
type SenhaForm = z.infer<typeof senhaFormSchema>;

function ModalSenha({ tema, onClose, onSucesso }: { tema: Tema; onClose: () => void; onSucesso: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SenhaForm>({ resolver: zodResolver(senhaFormSchema) });

  async function enviar({ senhaAtual, novaSenha }: SenhaForm) {
    setErro(null);
    try {
      await api.put("/users/me/password", { senhaAtual, novaSenha });
      onSucesso();
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 401 ? "Senha atual incorreta" : mensagem(e));
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Alterar senha" subtitle="Confirme a senha atual e escolha uma nova.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="senhaAtual" className="label">Senha atual</label>
          <input id="senhaAtual" type="password" autoComplete="current-password" autoFocus className="input" {...register("senhaAtual")} />
          {errors.senhaAtual && <p className="field-error">{errors.senhaAtual.message}</p>}
        </div>
        <div>
          <label htmlFor="novaSenha" className="label">Nova senha</label>
          <input id="novaSenha" type="password" autoComplete="new-password" className="input" {...register("novaSenha")} />
          {errors.novaSenha ? (
            <p className="field-error">{errors.novaSenha.message}</p>
          ) : (
            <p className="hint">Use letras, números e ao menos um caractere especial.</p>
          )}
        </div>
        <div>
          <label htmlFor="confirmar" className="label">Confirmar nova senha</label>
          <input id="confirmar" type="password" autoComplete="new-password" className="input" {...register("confirmar")} />
          {errors.confirmar && <p className="field-error">{errors.confirmar.message}</p>}
        </div>
        {erro && <div role="alert" className="banner-erro">{erro}</div>}
        <BotoesModal tema={tema} enviando={isSubmitting} rotulo="Salvar alteração" onCancelar={onClose} />
      </form>
    </BottomSheet>
  );
}

function ModalExcluir({ tema, onClose, onSucesso }: { tema: Tema; onClose: () => void; onSucesso: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ senha: string }>({ resolver: zodResolver(excluirContaSchema) });

  async function enviar(dados: { senha: string }) {
    setErro(null);
    try {
      await api.delete("/users/me", dados);
      onSucesso();
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 401 ? "Senha incorreta" : mensagem(e));
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Excluir conta">
      <div className="-mt-1 mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-alt-tint text-alt">
        <TriangleAlert size={22} />
      </div>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Sua conta será desativada e você não poderá mais fazer login. Seus prontuários permanecem armazenados
        conforme a política de retenção da clínica.
      </p>
      <form onSubmit={handleSubmit(enviar)} noValidate className="mt-4">
        <label htmlFor="senha" className="label">Digite sua senha para confirmar</label>
        <input id="senha" type="password" autoComplete="current-password" autoFocus className="input" {...register("senha")} />
        {errors.senha && <p className="field-error">{errors.senha.message}</p>}
        {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}
        <BotoesModal tema={tema} enviando={isSubmitting} rotulo="Excluir minha conta" destrutivo onCancelar={onClose} />
      </form>
    </BottomSheet>
  );
}

export default function Perfil() {
  const navigate = useNavigate();
  const sessao = getSession();
  const [usuario, setUsuario] = useState<UsuarioMe | null>(null);
  const [modal, setModal] = useState<ModalAberto>(null);

  function aplicar(u: UsuarioMe) {
    setUsuario(u);
    updateSessionUser({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, matricula: u.matricula });
  }

  useEffect(() => {
    api.get<UsuarioMe>("/users/me").then(aplicar).catch(() => {
    });
  }, []);

  if (!sessao) return null;

  const u = usuario ?? { ...sessao.user, criadoEm: "" };
  const professor = u.perfil === "professor";
  const tema = professor ? TEMA_PROFESSOR : TEMA_ALUNO;
  const fechar = () => setModal(null);

  function sair() {
    if (!window.confirm("Deseja sair da sua conta?")) return;
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Perfil" subtitulo="Suas informações de conta" onVoltar={() => navigate("/prontuarios")} />

      <main className="flex flex-1 flex-col px-5 pb-4 pt-2">
        <div className="flex flex-col items-center py-4">
          <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full font-display text-[30px] font-medium ${tema.tint} ${tema.texto}`}>
            {u.nome.charAt(0).toUpperCase()}
          </div>
          <p className="mt-3 font-display text-[17px] font-medium text-ink">{u.nome}</p>
          <p className="text-[12.5px] text-ink-soft">{u.email}</p>
        </div>

        <div className="divide-y divide-line rounded-card border border-line-soft bg-raised">
          <PerfilLinha label="Nome" value={u.nome} corClasse={tema.texto} onAlterar={() => setModal("nome")} />
          <PerfilLinha label="E-mail" value={u.email} corClasse={tema.texto} onAlterar={() => setModal("email")} />
          {professor && (
            <PerfilLinha label="Matrícula" value={u.matricula ?? "—"} corClasse={tema.texto} onAlterar={() => setModal("matricula")} />
          )}
          <PerfilLinha label="Senha" value="" isPassword corClasse={tema.texto} onAlterar={() => setModal("senha")} />
        </div>

        {professor && (
          <section className="mt-4 rounded-card border border-line-soft bg-raised p-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className={tema.texto} />
              <h2 className="font-display text-[15px] font-medium text-ink">Semestre vigente</h2>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[12px] text-ink-faint">Início</dt>
                <dd className="text-[14px] text-ink">{SEMESTRE_VIGENTE.inicio ?? "A definir"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-faint">Fim</dt>
                <dd className="text-[14px] text-ink">{SEMESTRE_VIGENTE.fim ?? "A definir"}</dd>
              </div>
            </dl>
          </section>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <button type="button" onClick={sair} className="btn bg-alt-tint text-alt">
            <LogOut size={18} /> Sair da conta
          </button>
          <button type="button" onClick={() => setModal("excluir")} className="py-2 text-[13px] font-medium text-ink-faint">
            Excluir conta
          </button>
        </div>
      </main>

      {modal === "nome" && (
        <ModalCampo
          titulo="Alterar nome"
          subtitulo="Seu nome aparece nos prontuários e na assinatura."
          label="Nome completo"
          schema={atualizarPerfilSchema.shape.nome.unwrap()}
          valorInicial={u.nome}
          tema={tema}
          onClose={fechar}
          onSalvar={async (nome) => {
            aplicar(await api.put<UsuarioMe>("/users/me", { nome }));
            fechar();
          }}
        />
      )}
      {modal === "email" && (
        <ModalCampo
          titulo="Alterar e-mail"
          subtitulo="Você usará o novo e-mail para entrar."
          label="E-mail"
          type="email"
          schema={atualizarPerfilSchema.shape.email.unwrap()}
          valorInicial={u.email}
          tema={tema}
          onClose={fechar}
          onSalvar={async (email) => {
            aplicar(await api.put<UsuarioMe>("/users/me", { email }));
            fechar();
          }}
        />
      )}
      {modal === "matricula" && (
        <ModalCampo
          titulo="Alterar matrícula"
          subtitulo="Informe a nova matrícula."
          label="Matrícula"
          inputMode="numeric"
          hint="Usada na assinatura e na liberação de acesso. Altere com cuidado."
          schema={alterarMatriculaSchema.shape.matricula}
          valorInicial={u.matricula ?? ""}
          tema={tema}
          onClose={fechar}
          onSalvar={async (matricula) => {
            aplicar(await api.put<UsuarioMe>("/users/me/matricula", { matricula }));
            fechar();
          }}
        />
      )}
      {modal === "senha" && <ModalSenha tema={tema} onClose={fechar} onSucesso={fechar} />}
      {modal === "excluir" && (
        <ModalExcluir
          tema={tema}
          onClose={fechar}
          onSucesso={() => {
            clearSession();
            navigate("/login", { replace: true });
          }}
        />
      )}
    </div>
  );
}
