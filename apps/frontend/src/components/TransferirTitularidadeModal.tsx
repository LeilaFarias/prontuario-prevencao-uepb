import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Loader2 } from "lucide-react";
import type { DuplicidadeResponse, PartesDuplicidade, QuemRecebe } from "@prontuario/shared";
import { ApiError, api } from "../lib/api";
import { getSession } from "../lib/session";
import BottomSheet from "./BottomSheet";
import { Detalhes, IconeModal } from "./revisao/ModalPartes";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  pacienteNome: string;
  onSucesso: () => void;
}

type Fase =
  | { tipo: "carregando" }
  | { tipo: "formulario"; dados: DuplicidadeResponse }
  | { tipo: "enviando" }
  | { tipo: "sucesso"; titulo: string; mensagem: string }
  | { tipo: "erro"; mensagem: string; dados: DuplicidadeResponse | null };

function duplaTexto(p: PartesDuplicidade): string {
  return [p.alunoOperador, p.alunoAuxiliar].filter(Boolean).join(" e ") || p.alunoNome;
}

function OpcaoCard({
  nome,
  marcada,
  onChange,
  titulo,
  destaque,
  descricao,
}: {
  nome: string;
  marcada: boolean;
  onChange: () => void;
  titulo: string;
  destaque: string;
  descricao?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4 text-left transition ${
        marcada ? "border-primary bg-primary-tint" : "border-line bg-raised"
      }`}
    >
      <input type="radio" name={nome} checked={marcada} onChange={onChange} className="mt-1 accent-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{titulo}</span>
        <span className="mt-1.5 block text-[13px] font-medium text-ink">{destaque}</span>
        {descricao && <span className="mt-0.5 block text-[12px] text-ink-soft">{descricao}</span>}
      </span>
    </label>
  );
}

export default function TransferirTitularidadeModal({ open, onClose, prontuarioId, pacienteNome, onSucesso }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [escolha, setEscolha] = useState<QuemRecebe | null>(null);
  const professorLogado = getSession()?.user;
  const [professorId, setProfessorId] = useState(professorLogado?.id ?? "");

  useEffect(() => {
    let ativo = true;
    setFase({ tipo: "carregando" });
    setEscolha(null);
    setProfessorId(professorLogado?.id ?? "");
    api
      .get<DuplicidadeResponse>(`/prontuarios/${encodeURIComponent(prontuarioId)}/duplicidade`)
      .then((dados) => {
        if (ativo) setFase({ tipo: "formulario", dados });
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
  }, [prontuarioId, tentativa, professorLogado?.id]);

  async function confirmar(dados: DuplicidadeResponse) {
    const { atual, existente } = dados;
    if (existente && (!escolha || !professorId)) return;
    setFase({ tipo: "enviando" });
    try {
      if (existente && escolha) {
        await api.post<{ ok: true }>(`/prontuarios/${encodeURIComponent(existente.prontuarioId)}/transferir-titularidade`, {
          prontuarioAntigoId: existente.prontuarioId,
          prontuarioNovoId: atual.prontuarioId,
          quemRecebe: escolha,
          professorEscolhidoId: professorId,
        });
        const ativa = escolha === "anterior" ? existente : atual;
        setFase({
          tipo: "sucesso",
          titulo: "Transferência concluída",
          mensagem: `O prontuário ativo agora é de ${duplaTexto(ativa)}. O histórico da outra dupla está disponível nas seções.`,
        });
      } else {
        await api.post<{ ok: true }>(`/prontuarios/${encodeURIComponent(prontuarioId)}/manter-titularidade`, {
          professorSupervisorId: atual.professorId ?? "",
        });
        setFase({
          tipo: "sucesso",
          titulo: "Duplicidade resolvida",
          mensagem: "O alerta de duplicidade foi removido e o prontuário segue seu fluxo normal.",
        });
      }
      onSucesso();
    } catch (err) {
      setFase({
        tipo: "erro",
        mensagem: err instanceof ApiError ? err.message : "Não foi possível concluir a transferência.",
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
        title={enviando ? "Transferindo…" : "Carregando…"}
        subtitle="Isso leva alguns segundos."
        icone={<Loader2 size={44} className="animate-spin text-prof" aria-hidden="true" />}
      >
        <div role="status" aria-live="polite" className="sr-only">
          {enviando ? "Transferindo o prontuário" : "Carregando os dados da duplicidade"}
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
        title={fase.titulo}
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
  const professorAnterior =
    existente?.professorId && existente.professorId !== professorLogado?.id
      ? { id: existente.professorId, nome: existente.professorNome ?? "—" }
      : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      centralizado
      title="Avaliar duplicidade"
      subtitle="Este paciente já tem um prontuário em andamento. Escolha qual dupla deve continuar com o prontuário ativo."
      icone={
        <IconeModal tom="prof">
          <ArrowRightLeft size={28} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes linhas={[["Paciente", pacienteNome]]} />

        {existente ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Dupla que recebe o prontuário ativo</legend>
            <OpcaoCard
              nome="quemRecebe"
              marcada={escolha === "anterior"}
              onChange={() => setEscolha("anterior")}
              titulo="Manter com a dupla anterior"
              destaque={duplaTexto(existente)}
              descricao={`O prontuário atual fica ativo e recebe o histórico de ${duplaTexto(atual)}.`}
            />
            <OpcaoCard
              nome="quemRecebe"
              marcada={escolha === "novo"}
              onChange={() => setEscolha("novo")}
              titulo="Entregar para a nova dupla"
              destaque={duplaTexto(atual)}
              descricao={`O prontuário novo fica ativo e recebe o histórico de ${duplaTexto(existente)}.`}
            />
          </fieldset>
        ) : (
          <p className="rounded-field bg-paper px-3.5 py-2.5 text-left text-[12.5px] text-ink-soft">
            O prontuário anterior não foi encontrado, então não há o que transferir. Você pode apenas remover o alerta
            de duplicidade.
          </p>
        )}

        {existente && professorAnterior && (
          <fieldset className="flex flex-col gap-2">
            <legend className="field-label text-left">Professor responsável pela ficha</legend>
            <OpcaoCard
              nome="professor"
              marcada={professorId === professorAnterior.id}
              onChange={() => setProfessorId(professorAnterior.id)}
              titulo={professorAnterior.nome}
              destaque="Professor atual da dupla"
            />
            <OpcaoCard
              nome="professor"
              marcada={professorId === professorLogado?.id}
              onChange={() => setProfessorId(professorLogado?.id ?? "")}
              titulo={professorLogado?.nome ?? "Você"}
              destaque="Você"
            />
          </fieldset>
        )}

        {existente && (
          <p className="rounded-field bg-alt-tint p-3 text-left text-[11.5px] text-ink-soft">
            Nenhum dado será apagado. O prontuário arquivado ficará disponível para consulta apenas com acesso liberado.
          </p>
        )}

        <button
          type="button"
          className="btn-prof"
          disabled={existente ? !escolha || !professorId : !atual.professorId}
          onClick={() => void confirmar(dados)}
        >
          {existente ? "Confirmar transferência" : "Remover alerta"}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
