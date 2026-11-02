import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { DuplicidadeResponse, PartesDuplicidade } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";
import BottomSheet from "./BottomSheet";
import { Detalhes, IconeModal } from "./revisao/ModalPartes";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  pacienteNome: string;
  onSucesso: () => void;
}

type Decisao = "manter" | "transferir";

type Fase =
  | { tipo: "carregando" }
  | { tipo: "formulario"; dados: DuplicidadeResponse }
  | { tipo: "enviando" }
  | { tipo: "sucesso"; mensagem: string }
  | { tipo: "erro"; mensagem: string; dados: DuplicidadeResponse | null };

const ROTULO_STATUS: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  ENVIADO: "Aguardando revisão",
  ASSINADO: "Assinado",
  DEVOLVIDO: "Devolvido",
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function duplaTexto(p: PartesDuplicidade): string {
  return [p.alunoOperador, p.alunoAuxiliar].filter(Boolean).join(" e ") || p.alunoNome;
}

function Opcao({
  nome,
  marcada,
  onChange,
  titulo,
  descricao,
}: {
  nome: string;
  marcada: boolean;
  onChange: () => void;
  titulo: string;
  descricao?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-field border p-3.5 text-left transition ${
        marcada ? "border-prof bg-prof-tint" : "border-line bg-raised"
      }`}
    >
      <input type="radio" name={nome} checked={marcada} onChange={onChange} className="mt-1 accent-prof" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{titulo}</span>
        {descricao && <span className="mt-0.5 block text-[12px] text-ink-soft">{descricao}</span>}
      </span>
    </label>
  );
}

export default function TransferirTitularidadeModal({ open, onClose, prontuarioId, pacienteNome, onSucesso }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [decisao, setDecisao] = useState<Decisao>("manter");
  const [professorId, setProfessorId] = useState("");

  useEffect(() => {
    let ativo = true;
    setFase({ tipo: "carregando" });
    api
      .get<DuplicidadeResponse>(`/prontuarios/${encodeURIComponent(prontuarioId)}/duplicidade`)
      .then((dados) => {
        if (!ativo) return;
        setProfessorId(dados.atual.professorId ?? "");
        setFase({ tipo: "formulario", dados });
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setFase({
          tipo: "erro",
          mensagem: err instanceof ApiError ? err.message : "Não foi possível carregar os dados da duplicidade.",
          dados: null,
        });
      });
    return () => {
      ativo = false;
    };
  }, [prontuarioId, tentativa]);

  async function confirmar(dados: DuplicidadeResponse) {
    if (!professorId) return;
    const base = `/prontuarios/${encodeURIComponent(prontuarioId)}`;
    const transferir = decisao === "transferir" && dados.existente;
    setFase({ tipo: "enviando" });
    try {
      if (transferir) {
        await api.post<{ ok: true }>(`${base}/transferir-titularidade`, {
          novoAlunoTitularId: dados.existente!.alunoId,
          novoProfessorSupervisorId: professorId,
        });
      } else {
        await api.post<{ ok: true }>(`${base}/manter-titularidade`, { professorSupervisorId: professorId });
      }
      setFase({
        tipo: "sucesso",
        mensagem: transferir
          ? `A titularidade foi transferida para ${duplaTexto(dados.existente!)}.`
          : `O prontuário permanece com ${duplaTexto(dados.atual)}.`,
      });
      onSucesso();
    } catch (err) {
      setFase({
        tipo: "erro",
        mensagem: err instanceof ApiError ? err.message : "Não foi possível concluir a operação.",
        dados,
      });
    }
  }

  if (fase.tipo === "carregando" || fase.tipo === "enviando") {
    const enviando = fase.tipo === "enviando";
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        bloqueado={enviando}
        centralizado
        title={enviando ? "Salvando decisão…" : "Carregando…"}
        subtitle="Isso leva alguns segundos."
        icone={<Loader2 size={44} className="animate-spin text-prof" aria-hidden="true" />}
      >
        <div role="status" aria-live="polite" className="sr-only">
          {enviando ? "Salvando a decisão" : "Carregando os dados da duplicidade"}
        </div>
      </BottomSheet>
    );
  }

  if (fase.tipo === "sucesso") {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Duplicidade resolvida"
        subtitle={fase.mensagem}
        icone={
          <IconeModal tom="primary">
            <Check size={30} />
          </IconeModal>
        }
      >
        <button type="button" className="btn-prof" onClick={onClose}>
          Voltar para a fila
        </button>
      </BottomSheet>
    );
  }

  if (fase.tipo === "erro") {
    const { dados } = fase;
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Não foi possível concluir"
        subtitle={fase.mensagem}
        icone={
          <IconeModal tom="alt">
            <AlertTriangle size={28} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="btn-prof"
            onClick={() => (dados ? setFase({ tipo: "formulario", dados }) : setTentativa((n) => n + 1))}
          >
            Tentar novamente
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </BottomSheet>
    );
  }

  const { dados } = fase;
  const { atual, existente } = dados;

  const professores: Array<{ id: string; nome: string }> = [];
  for (const parte of [atual, existente] as Array<PartesDuplicidade | null>) {
    if (parte?.professorId && !professores.some((p) => p.id === parte.professorId)) {
      professores.push({ id: parte.professorId, nome: parte.professorNome ?? "—" });
    }
  }

  const aviso =
    decisao === "transferir"
      ? "A dupla que enviou perderá o direito de editar. O histórico será preservado."
      : "O prontuário permanece com a dupla que enviou e o alerta de duplicidade será removido.";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      centralizado
      title="Resolver duplicidade"
      subtitle="Este paciente já tem outro prontuário na clínica. Defina a dupla e o professor responsáveis."
      icone={
        <IconeModal tom="alt">
          <AlertTriangle size={28} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="field-label mb-0 text-left">Prontuário enviado</p>
        <Detalhes
          linhas={[
            ["Paciente", pacienteNome],
            ["Aluno operador", atual.alunoOperador],
            ["Aluno auxiliar", atual.alunoAuxiliar],
            ["Professor responsável", atual.professorNome ?? ""],
          ]}
        />

        {existente ? (
          <>
            <p className="field-label mb-0 text-left">Prontuário existente</p>
            <Detalhes
              linhas={[
                ["Aluno operador", existente.alunoOperador],
                ["Aluno auxiliar", existente.alunoAuxiliar],
                ["Professor responsável", existente.professorNome ?? ""],
                ["Criado em", formatarData(existente.criadoEm)],
                ["Situação", ROTULO_STATUS[existente.status.toUpperCase()] ?? existente.status],
              ]}
            />
          </>
        ) : (
          <p className="rounded-field bg-paper px-3.5 py-2.5 text-left text-[12.5px] text-ink-soft">
            O prontuário existente não foi encontrado. Só é possível manter a titularidade atual.
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="field-label text-left">Dupla responsável</legend>
          <Opcao
            nome="decisao"
            marcada={decisao === "manter"}
            onChange={() => setDecisao("manter")}
            titulo="Manter com a dupla que enviou"
            descricao={duplaTexto(atual)}
          />
          {existente && (
            <Opcao
              nome="decisao"
              marcada={decisao === "transferir"}
              onChange={() => setDecisao("transferir")}
              titulo="Transferir para a outra dupla"
              descricao={duplaTexto(existente)}
            />
          )}
        </fieldset>

        {professores.length > 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="field-label text-left">Professor responsável pelo prontuário</legend>
            {professores.map((p) => (
              <Opcao
                key={p.id}
                nome="professor"
                marcada={professorId === p.id}
                onChange={() => setProfessorId(p.id)}
                titulo={p.nome}
                descricao={p.id === atual.professorId ? "Recebeu o prontuário" : "Responsável pelo prontuário existente"}
              />
            ))}
          </fieldset>
        ) : (
          <Detalhes linhas={[["Professor responsável", professores[0]?.nome ?? ""]]} />
        )}

        <p className="rounded-field bg-alt-tint px-3.5 py-2.5 text-left text-[12.5px] text-alt">{aviso}</p>

        <button type="button" className="btn-prof" disabled={!professorId} onClick={() => void confirmar(dados)}>
          Confirmar decisão
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
