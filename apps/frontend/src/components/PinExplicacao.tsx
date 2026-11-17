import { ShieldAlert } from "lucide-react";
import type { Perfil } from "@prontuario/shared";

export const TEXTOS_PIN = {
  professor: {
    titulo: "Crie seu PIN de segurança",
    subtitulo: "Defina um PIN de 8 dígitos para proteger sua conta e os dados da clínica.",
    finalidade:
      "Seu PIN será utilizado para desbloquear os prontuários armazenados neste aparelho e autorizar a liberação de acesso offline aos alunos.",
    rotuloPin: "PIN de 8 dígitos",
    placeholderPin: "● ● ● ● ● ● ● ●",
    lembrete:
      "Guarde seu PIN e lembre-se dele. Você precisará dele para acessar os prontuários protegidos neste aparelho.",
  },
  aluno: {
    titulo: "Crie seu PIN de acesso",
    subtitulo: "Defina um PIN de 8 dígitos para utilizar no aplicativo.",
    finalidade:
      "Seu PIN será utilizado para desbloquear os prontuários armazenados neste aparelho. Ele protege os dados dos pacientes com criptografia local.",
    rotuloPin: "PIN de 8 dígitos",
    placeholderPin: "Digite seu PIN",
    lembrete:
      "Lembre-se do seu PIN. Você precisará dele para utilizar os recursos protegidos do aplicativo.",
  },
} satisfies Record<Perfil, Record<string, string>>;

export const AVISO_RECUPERACAO_PIN =
  "Se esquecer, você poderá redefinir o PIN confirmando sua senha. Nesse caso, os dados locais deste aparelho serão apagados e recarregados do servidor.";

export default function PinExplicacao({ perfil }: { perfil: Perfil }) {
  const t = TEXTOS_PIN[perfil];
  return (
    <>
      <section className="rounded-card border border-line-soft bg-raised p-4">
        <h3 className="font-display text-[14px] font-semibold text-ink">Para que ele será utilizado?</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{t.finalidade}</p>
      </section>
      <div className="flex items-start gap-2 rounded-lg bg-alt-tint p-3">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-alt" aria-hidden="true" />
        <div className="text-[12.5px] leading-relaxed text-ink-soft">
          <p>
            <strong className="font-semibold text-ink">{t.lembrete}</strong>
          </p>
          <p className="mt-1.5">{AVISO_RECUPERACAO_PIN}</p>
        </div>
      </div>
    </>
  );
}
