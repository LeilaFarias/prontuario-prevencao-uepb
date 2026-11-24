import { ArrowLeft, Eye, HardDrive, KeyRound, Lock, ScrollText, ShieldCheck, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { getSession } from "../lib/session";
import { rotaInicial } from "../lib/rotas";

const itensGerais = [
  { Icone: Lock, texto: "Os dados dos pacientes trafegam por conexão segura (HTTPS) e ficam armazenados em banco de dados com criptografia em repouso (AES-256), fornecida pelo provedor." },
  { Icone: Smartphone, texto: "Os dados salvos no aparelho são criptografados e protegidos por PIN." },
  { Icone: HardDrive, texto: "Os backups são criptografados e apenas administradores podem baixá-los." },
  { Icone: KeyRound, texto: "As senhas são armazenadas em formato de hash e não ficam disponíveis em texto legível." },
];

export default function PrivacidadeSeguranca() {
  const sessao = getSession();
  const destino = sessao ? rotaInicial(sessao.user.perfil) : "/login";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-8 pt-8">
        <Link to={destino} className="mb-5 inline-flex items-center gap-2 text-[13px] font-medium text-primary">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck size={20} />
          <h1 className="font-display text-[21px] font-medium text-ink">Privacidade e segurança</h1>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
          O Prontuário Digital utiliza medidas de segurança para proteger as informações clínicas e os dados de acesso ao sistema.
        </p>

        <section className="mt-6">
          <h2 className="font-display text-[16px] font-semibold text-ink">Proteção das informações</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {itensGerais.map(({ Icone, texto }) => (
              <li key={texto} className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-soft">
                <Icone size={17} className="mt-0.5 shrink-0 text-primary" />
                <span>{texto}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="font-display text-[16px] font-semibold text-ink">Controle de acesso e auditoria</h2>
          <ul className="mt-3 flex flex-col gap-3">
            <li className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-soft">
              <Eye size={17} className="mt-0.5 shrink-0 text-primary" />
              <span>Alunos acessam os prontuários dos pacientes que atendem. Professores podem acessar o acervo clínico da clínica para atividades de ensino e supervisão.</span>
            </li>
            <li className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-soft">
              <ScrollText size={17} className="mt-0.5 shrink-0 text-primary" />
              <span>As principais ações no sistema são registradas em log de auditoria, como a leitura de prontuários, a liberação de acessos, a transferência de titularidade e o download de backups.</span>
            </li>
          </ul>
        </section>

        <p className="mt-7 rounded-card bg-primary-tint p-3.5 text-[12px] leading-relaxed text-ink-faint">
          Utilize sua própria conta, mantenha sua senha e seu PIN em sigilo e acesse informações de pacientes somente no exercício das atividades clínicas e acadêmicas autorizadas.
        </p>
      </main>
      <div className="sticky bottom-0 border-t border-line-soft bg-paper px-5 py-4">
        <Link to={destino} className="btn-dark flex items-center justify-center">Voltar para o login</Link>
      </div>
    </div>
  );
}
