import { useEffect, useRef, useState } from "react";
import { Eye, HardDrive, KeyRound, Lock, ScrollText, ShieldCheck, LucideIcon } from "lucide-react";
import { api } from "../lib/api";

type Perfil = "aluno" | "professor";

interface Item {
  Icone: LucideIcon;
  texto: string;
}

const BULLETS: Record<Perfil, Item[]> = {
  aluno: [
    { Icone: Lock, texto: "Seus dados e os dos seus pacientes são criptografados em trânsito (HTTPS) e no banco de dados (AES-256)." },
    { Icone: Eye, texto: "Você só acessa os prontuários dos pacientes que VOCÊ atende. Outros alunos não veem seus prontuários." },
    { Icone: ScrollText, texto: "Toda leitura e escrita é registrada em um log de auditoria." },
    { Icone: HardDrive, texto: "Backups são criptografados e só administradores podem baixá-los." },
    { Icone: KeyRound, texto: "Senhas são armazenadas com hash (não podem ser lidas, nem por nós)." },
  ],
  professor: [
    { Icone: Lock, texto: "Os dados dos pacientes são criptografados em trânsito (HTTPS) e no banco de dados (AES-256)." },
    { Icone: Eye, texto: "Como professor supervisor, você acessa o acervo clínico da clínica para fins de ensino e supervisão. Todo acesso é registrado." },
    { Icone: ScrollText, texto: "Toda leitura, escrita, assinatura e devolução é registrada em log de auditoria." },
    { Icone: HardDrive, texto: "Backups são criptografados e só administradores podem baixá-los." },
    { Icone: KeyRound, texto: "Senhas são armazenadas com hash (não podem ser lidas, nem por nós)." },
  ],
};

interface Props {
  perfil: Perfil;
  versao: string;
  onAceito: () => void | Promise<void>;
}

export default function ModalTermos({ perfil, versao, onAceito }: Props) {
  const painel = useRef<HTMLDivElement>(null);
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const bloquearEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", bloquearEsc, true);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    painel.current?.focus();
    return () => {
      document.removeEventListener("keydown", bloquearEsc, true);
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  async function aceitar() {
    setErro(null);
    setEnviando(true);
    try {
      await api.post<void>("/users/me/aceitar-termos", { versao });
      await onAceito();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o aceite. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(18,22,18,0.55)] backdrop-blur-[3px] animate-overlay-in motion-reduce:animate-none sm:items-center">
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="termos-titulo"
        className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-raised px-5 pb-6 pt-5 outline-none animate-sheet-up motion-reduce:animate-none sm:rounded-[22px]"
      >
        <h2 id="termos-titulo" className="font-display text-[18px] font-medium leading-snug text-ink">
          Termos de Uso e Política de Privacidade
        </h2>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">Versão {versao}</p>

        <section className="mt-4 rounded-card bg-primary-tint p-3.5">
          <div className="flex items-center gap-1.5 text-primary">
            <ShieldCheck size={16} />
            <h3 className="text-[13px] font-semibold">Como protegemos seus dados</h3>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {BULLETS[perfil].map(({ Icone, texto }) => (
              <li key={texto} className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-soft">
                <Icone size={14} className="mt-px shrink-0 text-primary" />
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <a
            href="/termos#seguranca"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] font-medium text-primary"
          >
            Ver detalhes técnicos
          </a>
        </section>

        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[13px] font-medium text-primary"
        >
          Ler os Termos completos
        </a>

        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-ink">
          <input
            type="checkbox"
            checked={concordo}
            disabled={enviando}
            onChange={(e) => setConcordo(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--primary)]"
          />
          Li e concordo com os Termos de Uso e a Política de Privacidade.
        </label>

        {erro && <div role="alert" className="banner-erro mt-3">{erro}</div>}

        <button
          type="button"
          disabled={!concordo || enviando}
          onClick={() => void aceitar()}
          className="btn-primary mt-4"
        >
          {enviando ? "Registrando…" : "Aceitar e continuar"}
        </button>
      </div>
    </div>
  );
}
