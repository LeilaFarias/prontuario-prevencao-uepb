import { useState } from "react";
import { Clock, Lock } from "lucide-react";
import { ACESSO_TEMPORARIO_HORAS, ERRO_ACESSO_EXPIRADO, type SolicitarAcessoResponse } from "@prontuario/shared";
import { db, type LocalProntuario } from "../db/dexie";
import { ApiError, api } from "../lib/api";
import BottomSheet from "./BottomSheet";
import { formatarDataHoraCompleta } from "./ficha/revisao/rotulos";
import { Detalhes, IconeModal } from "./revisao/ModalPartes";

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

export default function SolicitarAcessoModal({ open, onClose, prontuario, professorNome, onJaLiberado }: Props) {
  const [etapa, setEtapa] = useState<"formulario" | "aguardando">("formulario");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoEm, setEnviadoEm] = useState<string | null>(null);

  const paciente = prontuario.pacienteNome.trim();

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.post<SolicitarAcessoResponse>(
        `/prontuarios/${encodeURIComponent(prontuario.id)}/solicitar-acesso`,
        {},
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
      });
      setEnviadoEm(agora);
      setEtapa("aguardando");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
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
              ["Professor", professorNome],
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
      title="Solicitar acesso temporário"
      subtitle={`O professor supervisor precisa aprovar. A liberação vale por ${ACESSO_TEMPORARIO_HORAS} horas.`}
      icone={
        <IconeModal tom="sync">
          <Lock size={26} />
        </IconeModal>
      }
    >
      <div className="flex flex-col gap-3">
        <Detalhes
          linhas={[
            ["Paciente", paciente],
            ["Professor", professorNome],
            ["Última assinatura", formatarDataHoraCompleta(prontuario.assinadoEm)],
          ]}
        />
        {erro && (
          <p role="alert" className="banner-erro">
            {erro}
          </p>
        )}
        <button type="button" className="btn-primary" disabled={enviando} onClick={() => void enviar()}>
          {enviando ? "Enviando…" : "Enviar pedido"}
        </button>
        <button type="button" className="btn-ghost" disabled={enviando} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}
