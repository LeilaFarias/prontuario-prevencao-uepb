import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";
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
}

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
}: Props) {
  const [etapa, setEtapa] = useState<"formulario" | "aguardando">("formulario");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoEm, setEnviadoEm] = useState<string | null>(null);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [carregandoProfessores, setCarregandoProfessores] = useState(false);
  const [professorSelecionadoId, setProfessorSelecionadoId] = useState("");
  const [professorSelecionadoNome, setProfessorSelecionadoNome] = useState("");

  const paciente = prontuario.pacienteNome.trim();

  const nomeConsentimento = String(
    (prontuario.secoes["consentimento"] as { professorSupervisor?: unknown } | undefined)?.professorSupervisor ?? "",
  ).trim();

  const nomePreferido = (prontuario.professorSupervisorNome || professorNome || nomeConsentimento).trim();
  const temProfessorVinculado = !!prontuario.professorSupervisorId;
  const precisaEscolherProfessor = !temProfessorVinculado;

  useEffect(() => {
    if (!open || !precisaEscolherProfessor || professores.length > 0) return;
    setCarregandoProfessores(true);
    api
      .get<Professor[]>("/professores")
      .then(setProfessores)
      .catch(() => setErro("Não foi possível carregar a lista de professores."))
      .finally(() => setCarregandoProfessores(false));
  }, [open, precisaEscolherProfessor, professores.length]);

  useEffect(() => {
    if (!precisaEscolherProfessor) return;
    if (professorSelecionadoId) return;
    if (professores.length === 0) return;
    if (!nomePreferido) return;
    const alvo = nomePreferido.toLowerCase();
    const encontrado = professores.find((p) => p.nome.toLowerCase() === alvo);
    if (encontrado) {
      setProfessorSelecionadoId(encontrado.id);
      setProfessorSelecionadoNome(encontrado.nome);
    }
  }, [precisaEscolherProfessor, professores, nomePreferido, professorSelecionadoId]);

  async function enviar() {
    if (precisaEscolherProfessor && !professorSelecionadoId) {
      setErro("Selecione o professor responsável.");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const corpo: Record<string, string> = {};
      if (precisaEscolherProfessor) {
        corpo.professorSupervisorId = professorSelecionadoId;
        corpo.professorSupervisorNome = professorSelecionadoNome;
      }

      const resposta = await api.post<SolicitarAcessoResponse>(
        `/prontuarios/${encodeURIComponent(prontuario.id)}/solicitar-acesso`,
        corpo,
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
        ...(precisaEscolherProfessor && professorSelecionadoId
          ? {
              professorSupervisorId: professorSelecionadoId,
              professorSupervisorNome: professorSelecionadoNome,
            }
          : {}),
      });

      setEnviadoEm(agora);
      setEtapa("aguardando");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const professorExibido = professorNome || professorSelecionadoNome || "—";

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
        {precisaEscolherProfessor ? (
          <div>
            <label htmlFor="professor-supervisor" className="label">
              Professor responsável
            </label>
            {carregandoProfessores ? (
              <p className="hint">Carregando professores…</p>
            ) : professores.length === 0 ? (
              <p className="hint">Nenhum professor disponível no momento.</p>
            ) : (
              <select
                id="professor-supervisor"
                className="input"
                value={professorSelecionadoId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProfessorSelecionadoId(id);
                  setProfessorSelecionadoNome(professores.find((p) => p.id === id)?.nome ?? "");
                }}
                disabled={enviando}
              >
                <option value="">Selecione…</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <Detalhes
            linhas={[
              ["Paciente", paciente],
              ["Professor", professorNome || nomePreferido || "—"],
            ]}
          />
        )}

        {erro && (
          <p role="alert" className="banner-erro">
            {erro}
          </p>
        )}

        <button
          type="button"
          className="btn-primary"
          disabled={enviando || (precisaEscolherProfessor && !professorSelecionadoId)}
          onClick={() => void enviar()}
        >
          {enviando ? "Enviando…" : "Enviar pedido"}
        </button>
        <button type="button" className="btn-ghost" disabled={enviando} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}