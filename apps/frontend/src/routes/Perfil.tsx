import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Info, KeyRound, Lock, LogOut, TriangleAlert } from "lucide-react";
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
import { EsqueciPinSheet } from "../components/UnlockPin";
import VersaoApp from "../components/VersaoApp";
import { api, ApiError } from "../lib/api";
import { alterarPin, definirPin, lerMetaPin } from "../lib/pinCriptografia";
import { clearSession, getSession, updateSessionUser } from "../lib/session";
import { rotaInicial } from "../lib/rotas";
import { useSemestre } from "../hooks/useSemestre";

type ModalAberto = null | "nome" | "email" | "matricula" | "senha" | "excluir" | "sair";

interface Tema {
  texto: string;
  fundo: string;
  tint: string;
}

const TEMA_ALUNO: Tema = { texto: "text-primary", fundo: "bg-primary", tint: "bg-primary-tint" };
const TEMA_PROFESSOR: Tema = { texto: "text-prof", fundo: "bg-prof", tint: "bg-prof-tint" };

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

function ModalExcluir({ tema, onClose, onSucesso }: { tema: Tema; onClose: () => void; onSucesso: () => Promise<void> }) {
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
      await onSucesso();
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

function ModalSair({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => Promise<void> }) {
  const [saindo, setSaindo] = useState(false);

  async function confirmar() {
    setSaindo(true);
    await onSucesso();
  }

  return (
    <BottomSheet open onClose={onClose} title="Sair da conta" bloqueado={saindo}>
      <div className="-mt-1 mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-alt-tint text-alt">
        <LogOut size={22} />
      </div>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Você será desconectado deste aparelho. Você poderá entrar novamente quando quiser.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={saindo}
          onClick={() => void confirmar()}
          className="btn bg-alt-tint text-alt"
        >
          {saindo ? "Saindo…" : "Sair da conta"}
        </button>
        <button type="button" disabled={saindo} onClick={onClose} className="btn-ghost">
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}

function SemestreVigente({ tema }: { tema: Tema }) {
  const { inicio, fim, setInicio, setFim, carregando, salvando, salvar } = useSemestre();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const incompleto = !inicio || !fim;
  const invertido = !incompleto && inicio >= fim;

  async function enviar() {
    setErro(null);
    setSalvo(false);
    const falha = await salvar();
    if (falha) setErro(falha);
    else setSalvo(true);
  }

  return (
    <section className="mt-4 rounded-card border border-line-soft bg-raised p-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className={tema.texto} />
        <h2 className="font-display text-[15px] font-semibold text-ink">Semestre vigente</h2>
      </div>
      <p className="mt-1 text-[12px] text-ink-soft">Define o intervalo usado no indicador de pacientes atendidos.</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="semestre-inicio" className="label">Início</label>
          <input
            id="semestre-inicio"
            type="date"
            className="input"
            disabled={carregando}
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              setSalvo(false);
            }}
          />
        </div>
        <div>
          <label htmlFor="semestre-fim" className="label">Fim</label>
          <input
            id="semestre-fim"
            type="date"
            className="input"
            disabled={carregando}
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
              setSalvo(false);
            }}
          />
        </div>
      </div>

      {invertido && <p className="field-error">A data final deve ser posterior à data inicial.</p>}
      {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}
      {salvo && <div role="status" className="banner-ok mt-3">Semestre atualizado</div>}

      <button
        type="button"
        className="btn-prof mt-3"
        disabled={carregando || salvando || incompleto || invertido}
        onClick={() => void enviar()}
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </section>
  );
}

const apenasDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 8);

function PinLiberacaoOffline({ tema }: { tema: Tema }) {
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    setSalvo(false);
    if (!/^\d{8}$/.test(pin)) {
      setErro("O PIN deve ter exatamente 8 dígitos.");
      return;
    }
    if (pin !== confirmar) {
      setErro("Os PINs não coincidem.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await api.put<void>("/users/me/pin", { pin });
      setPin("");
      setConfirmar("");
      setSalvo(true);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-4 rounded-card border border-line-soft bg-raised p-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className={tema.texto} />
        <h2 className="font-display text-[15px] font-semibold text-ink">PIN de liberação offline</h2>
      </div>
      <p className="mt-1 text-[12px] text-ink-soft">Usado para liberar o acesso de alunos aos prontuários sem internet.</p>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label htmlFor="pin" className="label">PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            placeholder="8 dígitos"
            className="input"
            value={pin}
            onChange={(e) => {
              setPin(apenasDigitos(e.target.value));
              setSalvo(false);
            }}
          />
        </div>
        <div>
          <label htmlFor="pin-confirmar" className="label">Confirmar PIN</label>
          <input
            id="pin-confirmar"
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            placeholder="8 dígitos"
            className="input"
            value={confirmar}
            onChange={(e) => {
              setConfirmar(apenasDigitos(e.target.value));
              setSalvo(false);
            }}
          />
        </div>
      </div>

      {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}
      {salvo && <div role="status" className="banner-ok mt-3">PIN salvo</div>}

      <button type="button" className="btn-prof mt-3" disabled={salvando} onClick={() => void enviar()}>
        {salvando ? "Salvando…" : "Salvar PIN"}
      </button>
    </section>
  );
}

function ModalPinCriptografia({ tema, userId, temPin, onClose, onConcluido }: {
  tema: Tema;
  userId: string;
  temPin: boolean;
  onClose: () => void;
  onConcluido: () => void;
}) {
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if ((temPin && !/^\d{8}$/.test(atual)) || !/^\d{8}$/.test(novo)) {
      setErro("O PIN deve ter exatamente 8 dígitos.");
      return;
    }
    if (novo !== confirmar) {
      setErro("Os PINs não coincidem.");
      return;
    }
    if (temPin && novo === atual) {
      setErro("O novo PIN deve ser diferente do atual.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (temPin) await alterarPin(userId, atual, novo);
      else await definirPin(userId, novo, { limparLocal: false });
      onConcluido();
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (id: string, label: string, valor: string, set: (v: string) => void, autoFocus?: boolean) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        maxLength={8}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="8 dígitos"
        className="input"
        value={valor}
        onChange={(ev) => set(apenasDigitos(ev.target.value))}
      />
    </div>
  );

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={temPin ? "Alterar PIN de criptografia" : "Definir PIN de criptografia"}
      subtitle="Protege os prontuários guardados neste aparelho."
      bloqueado={enviando}
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="flex flex-col gap-3.5">
        {temPin && campo("pin-cripto-atual", "PIN atual", atual, setAtual, true)}
        {campo("pin-cripto-novo", "Novo PIN", novo, setNovo, !temPin)}
        {campo("pin-cripto-confirmar-novo", "Confirmar novo PIN", confirmar, setConfirmar)}
        {erro && <div role="alert" className="banner-erro">{erro}</div>}
        <BotoesModal tema={tema} enviando={enviando} rotulo="Salvar PIN" onCancelar={onClose} />
      </form>
    </BottomSheet>
  );
}

function PinCriptografiaLocal({ tema, userId, temPinServidor }: { tema: Tema; userId: string; temPinServidor?: boolean }) {
  const [tem, setTem] = useState(() => lerMetaPin(userId)?.tem ?? false);
  const [modal, setModal] = useState<null | "pin" | "esqueci">(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (temPinServidor !== undefined) setTem(temPinServidor);
  }, [temPinServidor]);

  return (
    <section className="mt-4 rounded-card border border-line-soft bg-raised p-4">
      <div className="flex items-center gap-2">
        <Lock size={16} className={tema.texto} />
        <h2 className="font-display text-[15px] font-semibold text-ink">PIN de criptografia local</h2>
      </div>
      <p className="mt-1 text-[12px] text-ink-soft">Protege os prontuários guardados neste aparelho.</p>
      <p className="mt-3 text-[13px] text-ink">
        Status: <span className="font-semibold">{tem ? "Definido" : "Não definido"}</span>
      </p>

      {salvo && <div role="status" className="banner-ok mt-3">PIN salvo</div>}

      <button
        type="button"
        className={`btn mt-3 text-white ${tema.fundo}`}
        onClick={() => {
          setSalvo(false);
          setModal("pin");
        }}
      >
        {tem ? "Alterar PIN" : "Definir PIN"}
      </button>
      {tem && (
        <button type="button" onClick={() => setModal("esqueci")} className={`mt-2 block text-[13px] font-medium ${tema.texto}`}>
          Esqueci o PIN
        </button>
      )}

      {modal === "pin" && (
        <ModalPinCriptografia
          tema={tema}
          userId={userId}
          temPin={tem}
          onClose={() => setModal(null)}
          onConcluido={() => {
            setTem(true);
            setSalvo(true);
            setModal(null);
          }}
        />
      )}
      {modal === "esqueci" && <EsqueciPinSheet onClose={() => setModal(null)} />}
    </section>
  );
}

function SobreApp({ tema }: { tema: Tema }) {
  return (
    <section className="mt-4 rounded-card border border-line-soft bg-raised p-4">
      <div className="flex items-center gap-2">
        <Info size={16} className={tema.texto} />
        <h2 className="font-display text-[15px] font-semibold text-ink">Sobre</h2>
      </div>
      <div className="mt-1.5">
        <VersaoApp />
      </div>
      <div className="mt-3 flex flex-col gap-2 text-[13px] font-medium">
        <Link to="/termos" className={tema.texto}>Termos de Uso e Política de Privacidade</Link>
        <Link to="/termos#seguranca" className={tema.texto}>Como protegemos seus dados</Link>
      </div>
    </section>
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
    setModal("sair");
  }

  return (
    <div className="flex flex-1 flex-col">
      <Topbar titulo="Perfil" subtitulo="Suas informações de conta" onVoltar={() => navigate(rotaInicial(u.perfil))} />

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

        {professor && <SemestreVigente tema={tema} />}
        {professor && <PinLiberacaoOffline tema={tema} />}
        <PinCriptografiaLocal tema={tema} userId={u.id} temPinServidor={usuario?.temPinCriptografia} />
        <SobreApp tema={tema} />

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
          onSucesso={async () => {
            await clearSession();
            navigate("/login", { replace: true });
          }}
        />
      )}
      {modal === "sair" && (
        <ModalSair
          onClose={fechar}
          onSucesso={async () => {
            await clearSession();
            navigate("/login", { replace: true });
          }}
        />
      )}
    </div>
  );
}