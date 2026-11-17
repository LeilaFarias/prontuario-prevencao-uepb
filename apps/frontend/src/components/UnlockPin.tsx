import { useState, type FormEvent } from "react";
import { Lock, TriangleAlert } from "lucide-react";
import BottomSheet from "./BottomSheet";
import PinExplicacao, { TEXTOS_PIN } from "./PinExplicacao";
import { ApiError } from "../lib/api";
import { definirPin, desbloquear, esquecerPin } from "../lib/pinCriptografia";
import { getSession } from "../lib/session";
import { contarPendentes, flush } from "../sync/queue";

const PIN_VALIDO = /^\d{8}$/;

const apenasDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 8);
const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente novamente.");

function CampoPin({ id, label, valor, onChange, autoFocus, placeholder = "8 dígitos" }: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        maxLength={8}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="input"
        value={valor}
        onChange={(e) => onChange(apenasDigitos(e.target.value))}
      />
    </div>
  );
}

export function EsqueciPinSheet({ onClose }: { onClose: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!senha) {
      setErro("Digite sua senha.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await esquecerPin(getSession()?.user.id ?? "", senha);
    } catch (err) {
      setErro(err instanceof ApiError && err.status === 401 ? "Senha incorreta" : mensagem(err));
      setEnviando(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Esqueci o PIN"
      subtitle="Os dados locais serão apagados e recarregados do servidor."
      bloqueado={enviando}
    >
      <form onSubmit={(e) => void confirmar(e)} noValidate>
        <label htmlFor="senha-reset-pin" className="label">Digite sua senha para confirmar</label>
        <input
          id="senha-reset-pin"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="input"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="submit" disabled={enviando} className="btn-primary">
            {enviando ? "Redefinindo…" : "Redefinir PIN"}
          </button>
          <button type="button" disabled={enviando} onClick={onClose} className="btn-ghost">Cancelar</button>
        </div>
      </form>
    </BottomSheet>
  );
}

export default function UnlockPin({ temPin, onDesbloqueado }: { temPin: boolean; onDesbloqueado: () => void }) {
  const userId = getSession()?.user.id ?? "";
  const perfil = getSession()?.user.perfil ?? "aluno";
  const textos = TEXTOS_PIN[perfil];
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [pendentes, setPendentes] = useState<number | null>(null);

  async function tentarDesbloquear(e: FormEvent) {
    e.preventDefault();
    if (!PIN_VALIDO.test(pin)) {
      setErro("O PIN deve ter exatamente 8 dígitos.");
      return;
    }
    setErro(null);
    setOcupado(true);
    try {
      if (await desbloquear(userId, pin)) {
        onDesbloqueado();
        return;
      }
      setErro("PIN inválido");
      setPin("");
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  async function pedirConfirmacao(e: FormEvent) {
    e.preventDefault();
    if (!PIN_VALIDO.test(pin)) {
      setErro("O PIN deve ter exatamente 8 dígitos.");
      return;
    }
    if (pin !== confirmar) {
      setErro("Os PINs não coincidem.");
      return;
    }
    setErro(null);
    setOcupado(true);
    try {
      await flush();
      setPendentes(await contarPendentes());
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarDefinicao() {
    setOcupado(true);
    try {
      await definirPin(userId, pin, { limparLocal: true });
      onDesbloqueado();
    } catch (err) {
      setPendentes(null);
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-paper px-6 pb-8 pt-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Lock size={22} />
        </div>
        <h1 className="font-display text-[22px] font-medium text-ink">
          {temPin ? "Desbloquear dados" : textos.titulo}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {temPin
            ? perfil === "professor"
              ? "Digite seu PIN de 8 dígitos para ver os prontuários neste aparelho e autorizar a liberação de acesso offline aos alunos."
              : "Digite seu PIN de 8 dígitos para ver os prontuários neste aparelho."
            : textos.subtitulo}
        </p>
        {!temPin && (
          <div className="mt-4 flex flex-col gap-3">
            <PinExplicacao perfil={perfil} />
          </div>
        )}

        <form onSubmit={(e) => void (temPin ? tentarDesbloquear(e) : pedirConfirmacao(e))} noValidate className="mt-5 flex flex-col gap-3.5">
          <CampoPin
            id="pin-cripto"
            label={temPin ? "PIN" : textos.rotuloPin}
            placeholder={temPin ? undefined : textos.placeholderPin}
            valor={pin}
            onChange={setPin}
            autoFocus
          />
          {!temPin && (
            <CampoPin
              id="pin-cripto-confirmar"
              label="Confirme seu PIN"
              placeholder="Digite novamente o PIN"
              valor={confirmar}
              onChange={setConfirmar}
            />
          )}
          {erro && <div role="alert" className="banner-erro">{erro}</div>}
          <button type="submit" disabled={ocupado} className="btn-primary">
            {ocupado ? (temPin ? "Desbloqueando…" : "Verificando…") : temPin ? "Desbloquear" : "Definir PIN"}
          </button>
          {temPin && (
            <button type="button" onClick={() => setEsqueci(true)} className="py-2 text-[13px] font-medium text-primary">
              Esqueci o PIN
            </button>
          )}
        </form>
      </div>

      {pendentes !== null && (
        <BottomSheet
          open
          onClose={() => setPendentes(null)}
          title="Apagar dados locais?"
          bloqueado={ocupado}
          icone={
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-alt-tint text-alt">
              <TriangleAlert size={22} />
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Vamos apagar os dados locais e recarregar do servidor. Seus dados no servidor estão seguros.
          </p>
          {pendentes > 0 && (
            <p className="mt-2 text-[13px] leading-relaxed text-alt">
              {pendentes === 1
                ? "Há 1 alteração ainda não enviada que será perdida."
                : `Há ${pendentes} alterações ainda não enviadas que serão perdidas.`}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2.5">
            <button type="button" disabled={ocupado} onClick={() => void confirmarDefinicao()} className="btn-primary">
              {ocupado ? "Carregando dados…" : "Continuar"}
            </button>
            <button type="button" disabled={ocupado} onClick={() => setPendentes(null)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </BottomSheet>
      )}

      {esqueci && <EsqueciPinSheet onClose={() => setEsqueci(false)} />}
    </div>
  );
}
