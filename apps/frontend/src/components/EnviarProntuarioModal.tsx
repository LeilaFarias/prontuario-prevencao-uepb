import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronRight, CloudOff, Loader2, Send } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { SECOES, type Consentimento, type Conclusao, type ResultadoEnvio, type SecaoId } from "@prontuario/shared";
import { db, type LocalProntuario, type LocalStatus } from "../db/dexie";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { validarEnvio } from "../lib/validarEnvio";
import { enviarAoProfessor } from "../sync/queue";
import BottomSheet from "./BottomSheet";

interface Props {
  prontuario: LocalProntuario;
  onClose: () => void;
  onIrParaSecao: (secaoId: SecaoId) => void;
  onVoltarParaLista: () => void;
  onAbrirProntuario: (id: string) => void;
}

type Fase =
  | { tipo: "revisao" }
  | { tipo: "enviando" }
  | { tipo: "sucesso"; professorNome: string; em: number }
  | { tipo: "offline"; em: number }
  | { tipo: "duplicidade"; resultado: ResultadoEnvio }
  | { tipo: "erro"; codigo: "professor_nao_encontrado" | null; mensagem: string };

const MENSAGEM_PROFESSOR =
  "O professor informado no Consentimento não foi encontrado. Verifique o nome e tente novamente.";
const MENSAGEM_GENERICA = "Ocorreu um erro. Tente novamente.";

const pad = (n: number) => String(n).padStart(2, "0");

function formatarDataHora(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const ROTULO_STATUS: Record<LocalStatus, string> = {
  em_andamento: "Em andamento",
  enviado: "Aguardando revisão",
  assinado: "Assinado",
  devolvido: "Devolvido",
};

function rotuloStatus(status: string | null | undefined): string {
  return status && status in ROTULO_STATUS ? ROTULO_STATUS[status as LocalStatus] : "—";
}

function Icone({ children, tom }: { children: ReactNode; tom: "primary" | "alt" | "sync" }) {
  const cores = {
    primary: "bg-primary-tint text-primary",
    alt: "bg-alt-tint text-alt",
    sync: "bg-sync-tint text-sync",
  }[tom];
  return (
    <div aria-hidden="true" className={`flex h-14 w-14 items-center justify-center rounded-full ${cores}`}>
      {children}
    </div>
  );
}

function Detalhes({ linhas }: { linhas: Array<[string, string]> }) {
  return (
    <dl className="flex flex-col gap-2 rounded-card border border-line-soft bg-paper p-4">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex items-baseline justify-between gap-4 text-[13px]">
          <dt className="shrink-0 text-ink-soft">{rotulo}</dt>
          <dd className="min-w-0 break-words text-right font-semibold text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function EnviarProntuarioModal({
  prontuario,
  onClose,
  onIrParaSecao,
  onVoltarParaLista,
  onAbrirProntuario,
}: Props) {
  const { online } = useSyncStatus();
  const [fase, setFase] = useState<Fase>({ tipo: "revisao" });

  const validacao = useMemo(() => validarEnvio(prontuario), [prontuario]);
  const consentimento = prontuario.secoes["consentimento"] as Partial<Consentimento> | undefined;
  const conclusao = prontuario.secoes["conclusao"] as Partial<Conclusao> | undefined;
  const professorDigitado = (consentimento?.professorSupervisor ?? "").trim();
  const anexos = (conclusao?.fotos?.length ?? 0) + (consentimento?.assinaturaFoto ? 1 : 0);
  const paciente = prontuario.pacienteNome.trim();

  const duplicadoId = fase.tipo === "duplicidade" ? fase.resultado.prontuarioDuplicadoId : null;
  // O prontuário existente pode ser de outra dupla (o servidor não o libera para este aluno)
  const duplicadoNoAparelho = useLiveQuery(
    async () => (duplicadoId ? Boolean(await db.prontuarios.get(duplicadoId)) : false),
    [duplicadoId],
  );

  const irPara = (secaoId: SecaoId) => {
    onClose();
    onIrParaSecao(secaoId);
  };

  async function enviar() {
    setFase({ tipo: "enviando" });
    try {
      const r = await enviarAoProfessor(prontuario.id);
      switch (r.tipo) {
        case "enviado":
          setFase(
            r.resultado.duplicado
              ? { tipo: "duplicidade", resultado: r.resultado }
              : { tipo: "sucesso", professorNome: r.resultado.professorNome ?? professorDigitado, em: r.enviadoEm },
          );
          break;
        case "offline":
          setFase({ tipo: "offline", em: r.salvoEm });
          break;
        case "professor_nao_encontrado":
          setFase({ tipo: "erro", codigo: "professor_nao_encontrado", mensagem: MENSAGEM_PROFESSOR });
          break;
        case "erro":
          setFase({ tipo: "erro", codigo: null, mensagem: r.mensagem });
          break;
        default: {
          const _naoTratado: never = r;
          void _naoTratado;
          setFase({ tipo: "erro", codigo: null, mensagem: MENSAGEM_GENERICA });
        }
      }
    } catch {
      setFase({ tipo: "erro", codigo: null, mensagem: "Falha ao conectar com o servidor." });
    }
  }

  if (fase.tipo === "enviando") {
    return (
      <BottomSheet
        open
        onClose={onClose}
        bloqueado
        centralizado
        title="Enviando…"
        subtitle="Isso leva alguns segundos."
        icone={<Loader2 size={44} className="animate-spin text-primary" aria-hidden="true" />}
      >
        <div role="status" aria-live="polite" className="sr-only">
          Enviando o prontuário
        </div>
      </BottomSheet>
    );
  }

  if (fase.tipo === "sucesso") {
    return (
      <BottomSheet
        open
        onClose={onClose}
        centralizado
        title="Ficha enviada!"
        subtitle={`${fase.professorNome ? `A ${fase.professorNome}` : "O professor"} recebeu o prontuário e vai revisar.`}
        icone={
          <Icone tom="primary">
            <Check size={30} />
          </Icone>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Status", "Aguardando revisão"],
              ["Enviado em", formatarDataHora(fase.em)],
              ["Professor", fase.professorNome || "—"],
            ]}
          />
          <p className="text-[12px] text-ink-faint">
            Enquanto a ficha está em revisão, você pode consultá-la mas não editá-la. Se precisar alterar algo, peça
            liberação de acesso.
          </p>
          <button type="button" className="btn-primary" onClick={onVoltarParaLista}>
            Voltar para meus prontuários
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Ver ficha enviada
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (fase.tipo === "offline") {
    return (
      <BottomSheet
        open
        onClose={onClose}
        centralizado
        title="Ficha salva no aparelho"
        subtitle="Sem conexão. Vamos enviar automaticamente quando a internet voltar."
        icone={
          <Icone tom="sync">
            <CloudOff size={28} />
          </Icone>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Status", "Na fila de sincronização"],
              ["Salvo em", formatarDataHora(fase.em)],
              ["Professor", professorDigitado || "—"],
            ]}
          />
          <p className="text-[12px] text-ink-faint">Você pode continuar usando o app normalmente.</p>
          <button type="button" className="btn-primary" onClick={onVoltarParaLista}>
            Voltar para meus prontuários
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Ver ficha
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (fase.tipo === "duplicidade") {
    const r = fase.resultado;
    return (
      <BottomSheet
        open
        onClose={onClose}
        centralizado
        title="Possível duplicidade"
        subtitle="Encontramos outro prontuário com o mesmo nome e data de nascimento."
        icone={
          <Icone tom="alt">
            <AlertTriangle size={28} />
          </Icone>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Paciente", paciente || "—"],
              ["Prontuário existente", `criado em ${formatarData(r.prontuarioDuplicadoCriadoEm)}`],
              ["Situação", rotuloStatus(r.prontuarioDuplicadoStatus)],
            ]}
          />
          <p className="text-[12px] text-ink-faint">
            A ficha foi enviada e sinalizada para o professor avaliar a transferência de titularidade.
          </p>
          <button type="button" className="btn-primary" onClick={onVoltarParaLista}>
            Entendi, voltar para meus prontuários
          </button>
          {duplicadoId && duplicadoNoAparelho && (
            <button type="button" className="btn-ghost" onClick={() => onAbrirProntuario(duplicadoId)}>
              Ver prontuário existente
            </button>
          )}
        </div>
      </BottomSheet>
    );
  }

  if (fase.tipo === "erro") {
    const erroProfessor = fase.codigo === "professor_nao_encontrado";
    return (
      <BottomSheet
        open
        onClose={onClose}
        centralizado
        title="Não foi possível enviar"
        subtitle={fase.mensagem || MENSAGEM_GENERICA}
        icone={
          <Icone tom="alt">
            <AlertTriangle size={28} />
          </Icone>
        }
      >
        <div className="flex flex-col gap-3">
          {erroProfessor ? (
            <button type="button" className="btn-primary" onClick={() => irPara("consentimento")}>
              Ir para o Consentimento
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setFase({ tipo: "revisao" })}>
              Tentar novamente
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (!validacao.ok) {
    const primeira = validacao.pendencias[0]!;
    return (
      <BottomSheet
        open
        onClose={onClose}
        centralizado
        title="Faltam informações obrigatórias"
        subtitle="Complete as seções abaixo antes de enviar."
        icone={
          <Icone tom="alt">
            <AlertTriangle size={28} />
          </Icone>
        }
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col overflow-hidden rounded-card border border-line-soft">
            {validacao.pendencias.map((p) => (
              <li key={p.secaoId} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => irPara(p.secaoId)}
                  className="flex w-full items-center gap-3 bg-raised px-4 py-3 text-left active:bg-paper"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{p.secao}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-soft">{p.mensagem}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary" onClick={() => irPara(primeira.primeiraSecao)}>
            Ir para a primeira pendência
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      centralizado
      title="Enviar ao professor?"
      subtitle="O prontuário será enviado para revisão."
      icone={
        <Icone tom="primary">
          <Send size={26} />
        </Icone>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes
          linhas={[
            ["Paciente", paciente || "—"],
            ["Seções conferidas", `${SECOES.length} de ${SECOES.length}`],
            ["Anexos", `${anexos} ${anexos === 1 ? "foto" : "fotos"}`],
            ["Professor", professorDigitado],
          ]}
        />
        <p className="text-[12px] text-ink-faint">
          {online
            ? "Vamos verificar se o paciente já tem outro prontuário na clínica."
            : "Sem conexão. O envio será feito quando a internet voltar."}
        </p>
        <button type="button" className="btn-primary" onClick={() => void enviar()}>
          Enviar ao professor
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Continuar editando
        </button>
      </div>
    </BottomSheet>
  );
}
