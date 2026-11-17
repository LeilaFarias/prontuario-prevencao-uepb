import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldAlert } from "lucide-react";
import { db } from "../db/dexie";
import { verificarPinOffline } from "../lib/pinOffline";
import { liberarAcessoOffline } from "../sync/queue";
import BottomSheet from "./BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  prontuarioId: string;
  professorSupervisorId?: string;
  pacienteNome?: string;
  onLiberado: (expiraEm: string) => void;
}

export default function LiberacaoManualModal({
  open,
  onClose,
  prontuarioId,
  professorSupervisorId,
  pacienteNome,
  onLiberado,
}: Props) {
  const [professorId, setProfessorId] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [liberando, setLiberando] = useState(false);

  const professores = useLiveQuery(async () => {
    const lista = await db.professoresLiberacao.toArray();
    return lista
      .filter((p) => !professorSupervisorId || p.professorId === professorSupervisorId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [professorSupervisorId]);

  useEffect(() => {
    if (!open) {
      setProfessorId("");
      setPin("");
      setErro(null);
    }
  }, [open]);

  useEffect(() => {
    if (professores?.length === 1) setProfessorId(professores[0]!.professorId);
  }, [professores]);

  async function liberar() {
    const professor = professores?.find((p) => p.professorId === professorId);
    if (!professor || liberando) return;
    setLiberando(true);
    setErro(null);
    try {
      const valido = await verificarPinOffline(pin, professor.saltClient, professor.pinHashClient);
      if (!valido) {
        setErro("PIN inválido");
        return;
      }
      const expiraEm = await liberarAcessoOffline(prontuarioId, professor.professorId);
      onLiberado(expiraEm);
      onClose();
    } catch {
      setErro("Não foi possível liberar o acesso. Tente novamente.");
    } finally {
      setLiberando(false);
    }
  }

  const semProfessores = professores !== undefined && professores.length === 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Liberar acesso offline"
      subtitle="O professor libera o acesso digitando o PIN neste aparelho."
    >
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-paper px-3 py-2.5">
        <span className="text-[12.5px] text-ink-soft">Paciente</span>
        <span className="text-right text-[13px] font-medium text-ink">{pacienteNome?.trim() || "Novo prontuário"}</span>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-alt-tint p-3">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-alt" aria-hidden="true" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Ação restrita ao professor.</strong> Somente o professor
          responsável deve digitar o PIN.
        </p>
      </div>

      {semProfessores ? (
        <p role="alert" className="banner-erro mt-4">
          Nenhum professor disponível neste aparelho. Conecte-se à internet ao menos uma vez para baixar os dados de liberação.
        </p>
      ) : (
        <>
          <label htmlFor="professor-liberacao" className="label mt-4">Professor</label>
          <select
            id="professor-liberacao"
            className="input"
            value={professorId}
            onChange={(e) => {
              setProfessorId(e.target.value);
              setErro(null);
            }}
          >
            <option value="">Selecione o professor</option>
            {professores?.map((p) => (
              <option key={p.professorId} value={p.professorId}>{p.nome}</option>
            ))}
          </select>

          <label htmlFor="pin-liberacao" className="label mt-4">PIN do professor</label>
          <input
            id="pin-liberacao"
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            className="input"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
              setErro(null);
            }}
            placeholder="8 dígitos"
          />
        </>
      )}

      {erro && (
        <p role="alert" className="banner-erro mt-2">
          {erro}
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-4"
        disabled={!professorId || pin.length !== 8 || liberando}
        onClick={() => void liberar()}
      >
        {liberando ? "Verificando…" : "Liberar"}
      </button>
      <button type="button" className="btn-ghost mt-2" onClick={onClose}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
