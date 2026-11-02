import { useEffect, useState } from "react";
import { CircleAlert, Clock, Loader2, Lock, WifiOff } from "lucide-react";
import { ACESSO_TEMPORARIO_HORAS, ERRO_ACESSO_EXPIRADO, type SolicitarAcessoResponse } from "@prontuario/shared";
import { db, type LocalProntuario } from "../db/dexie";
import { ApiError, api } from "../lib/api";
import BottomSheet from "./BottomSheet";
import { formatarDataHoraCompleta } from "./ficha/revisao/rotulos";
import { Detalhes, IconeModal } from "./revisao/ModalPartes";

interface Professor {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prontuario: LocalProntuario;
  professorNome: string;
  onJaLiberado: () => void;
  onSolicitarManual?: () => void;
  onVoltarParaLista?: () => void;
}

type Etapa = "formulario" | "aguardando" | "offline";

function mensagemDeErro(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.message === ERRO_ACESSO_EXPIRADO || err.codigo === ERRO_ACESSO_EXPIRADO) {
      return "O acesso expirou antes de você conseguir. Tente novamente.";
    }
    if (err.status === 0) return err.message;
  }
  return "Não foi possível enviar o pedido. Tente novamente.";
}

export default function SolicitarAcessoModal({
  open,
  onClose,
  prontuario,
  professorNome,
  onJaLiberado,
  onSolicitarManual,
  onVoltarParaLista,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>("formulario");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoEm, setEnviadoEm] = useState<string | null>(null);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [carregandoProfessores, setCarregandoProfessores] = useState(false);
  const [professorSelecionadoId, setProfessorSelecionadoId] = useState(
    prontuario.professorSupervisorId ?? "",
  );
  const [professorSelecionadoNome, setProfessorSelecionadoNome] = useState(
    prontuario.professorSupervisorNome ?? professorNome ?? "",
  );

  const paciente = prontuario.pacienteNome.trim();

  const nomeConsentimento = String(
    (prontuario.secoes["consentimento"] as { professorSupervisor?: unknown } | undefined)?.professorSupervisor ?? "",
  ).trim();

  const nomePreferido = (professorSelecionadoNome || professorNome || nomeConsentimento).trim();

  useEffect(() => {
    if (!open || professores.length > 0) return;
    setCarregandoProfessores(true);
    api
      .get<Professor[]>("/professores")
      .then(setProfessores)
      .catch(() => setErro("Não foi possível carregar a lista de professores."))
      .finally(() => setCarregandoProfessores(false));
  }, [open, professores.length]);

  useEffect(() => {
    if (professorSelecionadoId) return;
    if (professores.length === 0) return;
    if (!nomePreferido) return;
    const alvo = nomePreferido.toLowerCase();
    const encontrado = professores.find((p) => p.nome.toLowerCase() === alvo);
    if (encontrado) {
      setProfessorSelecionadoId(encontrado.id);
      setProfessorSelecionadoNome(encontrado.nome);
    }
  }, [professores, nomePreferido, professorSelecionadoId]);

  useEffect(() => {
    if (!professorSelecionadoId) return;
    if (professorSelecionadoNome) return;
    const p = professores.find((x) => x.id === professorSelecionadoId);
    if (p) setProfessorSelecionadoNome(p.nome);
  }, [professores, professorSelecionadoId, professorSelecionadoNome]);

  async function enviar() {
    if (!navigator.onLine) {
      setEtapa("offline");
      return;
    }

    if (!professorSelecionadoId) {
      setErro("Selecione o professor responsável.");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.post<SolicitarAcessoResponse>(
        `/prontuarios/${encodeURIComponent(prontuario.id)}/solicitar-acesso`,
        {
          professorSupervisorId: professorSelecionadoId,
          professorSupervisorNome: professorSelecionadoNome,
        },
      );

      if (resposta.jaTemAcesso) {
        onJaLiberado();
        onClose();
        return;
      }

      const agora = new Date().toISOString();
      await db.prontuarios.update(prontuario.id, {
        acessoSolicitadoEm: agora,
        acessoExpiraEm: undefined,
        acessoRevogadoEm: undefined,
        acessoRecusadoEm: undefined,
        professorSupervisorId: professorSelecionadoId,
        professorSupervisorNome: professorSelecionadoNome,
      });

      setEnviadoEm(agora);
      setEtapa("aguardando");
    } catch (err) {
      if (!navigator.onLine || (err instanceof ApiError && err.status === 0)) {
        setEtapa("offline");
      } else {
        setErro(mensagemDeErro(err));
      }
    } finally {
      setEnviando(false);
    }
  }

  const professorExibido = professorSelecionadoNome || professorNome || "—";

  if (etapa === "offline") {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Sem internet"
        subtitle="Desculpe, não foi possível enviar o pedido de acesso devido à falta de conexão com a internet."
        icone={
          <IconeModal tom="sync">
            <WifiOff size={26} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg bg-primary-tint p-3 text-primary">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[12.5px] leading-relaxed">
              O professor pode te conceder acesso manualmente
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              className="btn-primary"
              onClick={onVoltarParaLista ?? onClose}
            >
              Voltar para meus prontuários
            </button>
            {onSolicitarManual && (
              <button
                type="button"
                className="btn bg-alt text-white"
                onClick={() => {
                  onClose();
                  onSolicitarManual();
                }}
              >
                Solicitar acesso manual
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    );
  }

  if (etapa === "aguardando") {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        centralizado
        title="Pedido enviado"
        subtitle="Aguardando aprovação do professor. Você pode continuar navegando."
        icone={
          <IconeModal tom="sync">
            <Clock size={26} />
          </IconeModal>
        }
      >
        <div className="flex flex-col gap-3">
          <Detalhes
            linhas={[
              ["Paciente", paciente],
              ["Professor", professorExibido],
              ["Pedido enviado em", formatarDataHoraCompleta(enviadoEm)],
            ]}
          />
          <button type="button" className="btn-primary" onClick={onClose}>
            Entendi
          </button>
        </div>
      </BottomSheet>
    );
  }

  const valorSelect =
    professorSelecionadoId && !professores.some((p) => p.id === professorSelecionadoId)
      ? "__atual__"
      : professorSelecionadoId;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      bloqueado={enviando}
      centralizado
      title="Solicitar acesso"
      subtitle={`O professor supervisor precisa aprovar. A liberação vale por ${ACESSO_TEMPORARIO_HORAS} horas.`}
      icone={
        <IconeModal tom="sync">
          <Lock size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="professor-supervisor" className="label">
            Professor responsável
          </label>
          {carregandoProfessores ? (
            <div className="input flex items-center gap-2 text-ink-soft">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Carregando professores…
            </div>
          ) : professores.length === 0 && !professorSelecionadoId ? (
            <p className="hint">Nenhum professor disponível no momento.</p>
          ) : (
            <>
              <select
                id="professor-supervisor"
                className="input"
                value={valorSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "__atual__") return;
                  setProfessorSelecionadoId(id);
                  setProfessorSelecionadoNome(professores.find((p) => p.id === id)?.nome ?? "");
                }}
                disabled={enviando}
              >
                {!professorSelecionadoId && <option value="">Selecione…</option>}
                {professorSelecionadoId && !professores.some((p) => p.id === professorSelecionadoId) && (
                  <option value="__atual__">
                    {professorSelecionadoNome || "Professor atual"}
                  </option>
                )}
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <p className="hint mt-1">
                {professorSelecionadoId
                  ? "Professor atual. Altere apenas se precisar."
                  : "Escolha o professor responsável pela liberação."}
              </p>
            </>
          )}
        </div>

        <Detalhes
          linhas={[
            ["Paciente", paciente],
          ]}
        />

        {erro && (
          <p role="alert" className="banner-erro">
            {erro}
          </p>
        )}

        <button
          type="button"
          className="btn-primary inline-flex items-center justify-center gap-2"
          disabled={enviando || !professorSelecionadoId}
          onClick={() => void enviar()}
        >
          {enviando ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            "Enviar pedido"
          )}
        </button>
        <button type="button" className="btn-ghost" disabled={enviando} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}