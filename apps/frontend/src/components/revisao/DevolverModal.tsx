import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import {
  COMENTARIO_DEVOLUCAO_MAX,
  COMENTARIO_DEVOLUCAO_MIN,
  MOTIVOS_DEVOLUCAO,
  ROTULO_MOTIVO_DEVOLUCAO,
  type DevolverResponse,
  type MotivoDevolucao,
} from "@prontuario/shared";
import { ApiError, api } from "../../lib/api";
import BottomSheet from "../BottomSheet";
import { formatarDataHoraCompleta } from "../ficha/revisao/rotulos";
import { Detalhes, IconeModal } from "./ModalPartes";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  pacienteNome: string;
  alunoNome: string;
  onSucesso: () => void;
  onVoltarParaFila?: () => void;
}

type Estado = "formulario" | "enviando" | "sucesso" | "erro";

const MENSAGEM_GENERICA = "Ocorreu um erro. Tente novamente.";

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  NAO_SUPERVISOR: "Você não é o professor supervisor deste prontuário.",
  NAO_AGUARDANDO: "Este prontuário não está mais aguardando revisão. Recarregue a página.",
};

function mensagemDeErro(err: unknown): string {
  if (!(err instanceof ApiError)) return MENSAGEM_GENERICA;
  if (err.codigo && MENSAGENS_POR_CODIGO[err.codigo]) return MENSAGENS_POR_CODIGO[err.codigo]!;
  return err.status === 0 || err.status === 400 ? err.message : MENSAGEM_GENERICA;
}

export default function DevolverModal({
  open,
  onClose,
  prontuarioId,
  pacienteNome,
  alunoNome,
  onSucesso,
  onVoltarParaFila,
}: Props) {
  const [estado, setEstado] = useState<Estado>("formulario");
  const [motivo, setMotivo] = useState<MotivoDevolucao | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState(MENSAGEM_GENERICA);
  const [resultado, setResultado] = useState<{ resposta: DevolverResponse; motivo: MotivoDevolucao } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEstado("formulario");
    setMotivo(null);
    setComentario("");
    setResultado(null);
  }, [open]);

  const podeConfirmar = motivo !== null && comentario.trim().length >= COMENTARIO_DEVOLUCAO_MIN;

  async function devolver() {
    if (!motivo) return;
    setEstado("enviando");
    try {
      const resposta = await api.post<DevolverResponse>(`/prontuarios/${encodeURIComponent(prontuarioId)}/devolver`, {
        motivo,
        comentario: comentario.trim(),
      });
      setResultado({ resposta, motivo });
      setEstado("sucesso");
      onSucesso();
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEstado("erro");
    }
  }

  if (estado === "enviando") {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        bloqueado
        centralizado
        title="Devolvendo…"
        icone={<Loader2 size={44} className="animate-spin text-alt" aria-hidden="true" />}
      >
        <div role="status" aria-live="polite" className="sr-only">
          Devolvendo o prontuário
        </div>
      </BottomSheet>
    );
  }

  if (estado === "sucesso" && resultado) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Prontuário devolvido"
        subtitle="O aluno foi notificado e poderá corrigir a ficha."
        icone={
          <IconeModal tom="primary">
            <RotateCcw size={28} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Paciente", pacienteNome],
              ["Devolvido em", formatarDataHoraCompleta(resultado.resposta.devolvidoEm)],
              ["Motivo", ROTULO_MOTIVO_DEVOLUCAO[resultado.motivo]],
            ]}
          />
          <button type="button" className="btn-prof" onClick={onVoltarParaFila ?? onClose}>
            Voltar para a fila
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (estado === "erro") {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Não foi possível devolver"
        subtitle={erro}
        icone={
          <IconeModal tom="alt">
            <AlertTriangle size={28} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <button type="button" className="btn-prof" onClick={() => setEstado("formulario")}>
            Tentar novamente
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
      open={open}
      onClose={onClose}
      centralizado
      title="Devolver ao aluno"
      subtitle="Explique o que precisa ser corrigido. O prontuário volta para edição e o aluno será notificado."
      icone={
        <IconeModal tom="alt">
          <RotateCcw size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes
          linhas={[
            ["Paciente", pacienteNome],
            ["Aluno responsável", alunoNome],
          ]}
        />

        <div role="group" aria-labelledby="devolucao-motivo" className="flex flex-col gap-2">
          <span id="devolucao-motivo" className="label mb-0">
            Motivo
          </span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_DEVOLUCAO.map((m) => {
              const ativo = motivo === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setMotivo(m)}
                  className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition ${
                    ativo ? "border-prof bg-prof-tint text-prof" : "border-line bg-raised text-ink-soft"
                  }`}
                >
                  {ROTULO_MOTIVO_DEVOLUCAO[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="devolucao-comentario" className="label">
            Comentário
          </label>
          <textarea
            id="devolucao-comentario"
            value={comentario}
            maxLength={COMENTARIO_DEVOLUCAO_MAX}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Descreva o que precisa ser corrigido com o máximo de detalhe possível"
            className="input min-h-[100px] resize-none py-3"
          />
          <p className="hint text-right">
            {comentario.length}/{COMENTARIO_DEVOLUCAO_MAX}
          </p>
        </div>

        <button type="button" className="btn-alt" disabled={!podeConfirmar} onClick={() => void devolver()}>
          Devolver ao aluno
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
