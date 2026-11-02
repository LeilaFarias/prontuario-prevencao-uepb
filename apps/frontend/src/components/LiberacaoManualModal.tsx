import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { LocalProfessor } from "../db/dexie";
import { buscarProfessorPorMatricula } from "../sync/professores";
import { liberarAcessoManual } from "../sync/queue";
import BottomSheet from "./BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  pacienteNome?: string;
  onLiberado: (expiraEm: string) => void;
}

const MIN_DIGITOS = 6;

export default function LiberacaoManualModal({ open, onClose, prontuarioId, pacienteNome, onLiberado }: Props) {
  const [matricula, setMatricula] = useState("");
  const [professor, setProfessor] = useState<LocalProfessor | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [liberando, setLiberando] = useState(false);

  useEffect(() => {
    if (!open) {
      setMatricula("");
      setProfessor(null);
      setErro(null);
    }
  }, [open]);

  useEffect(() => {
    let ativo = true;
    const valor = matricula.trim();
    setProfessor(null);
    setErro(null);
    if (valor.length < MIN_DIGITOS) return;

    void buscarProfessorPorMatricula(valor)
      .then((prof) => {
        if (!ativo) return;
        if (prof) setProfessor(prof);
        else setErro("Matrícula não encontrada neste aparelho");
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível consultar os professores neste aparelho");
      });

    return () => {
      ativo = false;
    };
  }, [matricula]);

  async function liberar() {
    if (!professor || liberando) return;
    setLiberando(true);
    try {
      const expiraEm = await liberarAcessoManual(prontuarioId, professor.matricula);
      onLiberado(expiraEm);
      onClose();
    } catch {
      setErro("Não foi possível liberar o acesso. Tente novamente.");
    } finally {
      setLiberando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Liberação manual"
      subtitle="O professor libera o acesso diretamente neste aparelho."
    >
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-paper px-3 py-2.5">
        <span className="text-[12.5px] text-ink-soft">Paciente</span>
        <span className="text-right text-[13px] font-medium text-ink">{pacienteNome?.trim() || "Novo prontuário"}</span>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-alt-tint p-3">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-alt" aria-hidden="true" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Ação restrita ao professor.</strong> Somente o professor
          responsável deve digitar a matrícula.
        </p>
      </div>

      <label htmlFor="matricula-professor" className="label mt-4">
        Matrícula do professor
      </label>
      <input
        id="matricula-professor"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input"
        value={matricula}
        onChange={(e) => setMatricula(e.target.value.trim())}
        placeholder="Digite a matrícula"
      />

      {professor && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-primary">
          <CheckCircle2 size={16} className="shrink-0 text-green-600" aria-hidden="true" />
          {professor.nome}
        </p>
      )}
      {erro && (
        <p role="alert" className="banner-erro mt-2">
          {erro}
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-4"
        disabled={!professor || liberando}
        onClick={() => void liberar()}
      >
        Liberar acesso por 4 horas
      </button>
      <button type="button" className="btn-ghost mt-2" onClick={onClose}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
