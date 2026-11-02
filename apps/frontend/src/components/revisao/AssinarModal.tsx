import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleCheck, Eye, EyeOff, Loader2, PenLine } from "lucide-react";
import { SECOES, type AssinarResponse } from "@prontuario/shared";
import { ApiError, api } from "../../lib/api";
import { getSession } from "../../lib/session";
import BottomSheet from "../BottomSheet";
import { formatarDataHoraCompleta } from "../ficha/revisao/rotulos";
import { Detalhes, IconeModal } from "./ModalPartes";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  pacienteNome: string;
  professorNome: string;
  procedimentosPendentes: number;
  onSucesso: () => void;
  onVoltarParaFila?: () => void;
}

type Estado = "formulario" | "enviando" | "sucesso" | "erro";

const MENSAGEM_GENERICA = "Ocorreu um erro. Tente novamente.";

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  MATRICULA_NAO_CONFERE: "A matrícula informada não corresponde ao seu usuário.",
  SENHA_INCORRETA: "A senha está incorreta. Tente novamente.",
  NAO_SUPERVISOR: "Você não é o professor supervisor deste prontuário.",
  NAO_AGUARDANDO: "Este prontuário não está mais disponível para assinatura. Recarregue a página.",
};

function mensagemDeErro(err: unknown): string {
  if (!(err instanceof ApiError)) return MENSAGEM_GENERICA;
  if (err.codigo && MENSAGENS_POR_CODIGO[err.codigo]) return MENSAGENS_POR_CODIGO[err.codigo]!;
  return err.status === 0 || err.status === 400 ? err.message : MENSAGEM_GENERICA;
}

export default function AssinarModal({
  open,
  onClose,
  prontuarioId,
  pacienteNome,
  professorNome,
  procedimentosPendentes,
  onSucesso,
  onVoltarParaFila,
}: Props) {
  const matriculaDoUsuario = getSession()?.user.matricula?.trim() ?? "";
  const [estado, setEstado] = useState<Estado>("formulario");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(MENSAGEM_GENERICA);
  const [comprovante, setComprovante] = useState<AssinarResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setEstado("formulario");
    setMatricula("");
    setSenha("");
    setMostrarSenha(false);
    setComprovante(null);
  }, [open]);

  const digitada = matricula.trim();
  const identificado = matriculaDoUsuario !== "" && digitada === matriculaDoUsuario;
  const divergente = digitada.length >= 6 && !identificado;
  const podeConfirmar = identificado && senha.length > 0;

  async function assinar() {
    setEstado("enviando");
    try {
      const resposta = await api.post<AssinarResponse>(`/prontuarios/${encodeURIComponent(prontuarioId)}/assinar`, {
        matricula: digitada,
        senha,
      });
      setComprovante(resposta);
      setSenha("");
      setEstado("sucesso");
      onSucesso();
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSenha("");
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
        title="Assinando…"
        icone={<Loader2 size={44} className="animate-spin text-prof" aria-hidden="true" />}
      >
        <div role="status" aria-live="polite" className="sr-only">
          Assinando o prontuário
        </div>
      </BottomSheet>
    );
  }

  if (estado === "sucesso" && comprovante) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Prontuário assinado"
        subtitle="A assinatura foi registrada com sucesso."
        icone={
          <IconeModal tom="primary">
            <Check size={30} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Paciente", pacienteNome],
              ["Assinado em", formatarDataHoraCompleta(comprovante.assinadoEm)],
              ["Assinado por", comprovante.assinadoPorNome],
              ["Procedimentos assinados", String(comprovante.procedimentosAssinados)],
            ]}
          />
          <p className="text-[12px] text-ink-faint">
            O prontuário agora está bloqueado para edição. O aluno será notificado.
          </p>
          {onVoltarParaFila && (
            <button type="button" className="btn-prof" onClick={onVoltarParaFila}>
              Voltar para a fila
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Ver prontuário assinado
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
        title="Não foi possível assinar"
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
      title="Assinar prontuário"
      subtitle="Confirme sua identidade para assinar o prontuário e os procedimentos pendentes."
      icone={
        <IconeModal tom="prof">
          <PenLine size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes
          linhas={[
            ["Paciente", pacienteNome],
            ["Seções conferidas", `${SECOES.length} de ${SECOES.length}`],
            ["Procedimentos a assinar", String(procedimentosPendentes)],
            ["Professor", professorNome],
          ]}
        />

        <div>
          <label htmlFor="assinatura-matricula" className="label">
            Matrícula
          </label>
          <input
            id="assinatura-matricula"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            aria-invalid={divergente}
            className="input"
          />
          {divergente && (
            <p role="alert" className="field-error">
              Matrícula não confere com seu usuário
            </p>
          )}
          {matriculaDoUsuario === "" && (
            <p className="field-error">Seu usuário não tem matrícula cadastrada. Cadastre-a no perfil para assinar.</p>
          )}
        </div>

        {identificado && (
          <div className="flex items-center gap-3 rounded-card border border-line-soft bg-prof-tint p-3">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prof font-display text-[14px] font-semibold text-white"
            >
              {professorNome.trim().charAt(0).toUpperCase() || "P"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-prof">Professor identificado</p>
              <p className="truncate text-[14px] font-semibold text-ink">{professorNome}</p>
              <p className="text-[12px] text-ink-soft">Professor supervisor</p>
            </div>
            <CircleCheck size={20} className="shrink-0 text-prof" aria-hidden="true" />
          </div>
        )}

        <div>
          <label htmlFor="assinatura-senha" className="label">
            Senha
          </label>
          <div className="relative">
            <input
              id="assinatura-senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="input pr-12"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-ink-faint"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="button" className="btn-prof" disabled={!podeConfirmar} onClick={() => void assinar()}>
          Confirmar assinatura
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
