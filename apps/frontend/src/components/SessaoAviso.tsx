import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { clearSession, getSession, sessionExpiresAt } from "../lib/session";
import { useSyncStatus } from "../hooks/useSyncStatus";

const AVISO_MS = 10 * 60 * 1000;
const AVISO_FINAL_MS = 2 * 60 * 1000;

function formatar(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessaoAviso() {
  const navigate = useNavigate();
  const { pendentes } = useSyncStatus();
  const [restante, setRestante] = useState<number | null>(null);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const verificar = async () => {
      const sessao = getSession();
      const fim = sessao ? sessionExpiresAt(sessao) : null;
      if (!ativo) return;
      if (!sessao || fim === null) {
        setRestante(null);
        return;
      }
      const falta = fim - Date.now();
      if (falta <= 0) {
        await clearSession();
        if (!ativo) return;
        setRestante(null);
        navigate("/login", { replace: true, state: { sessaoExpirada: true } });
        return;
      }
      setRestante(falta);
    };
    void verificar();
    const t = window.setInterval(() => void verificar(), 1000);
    return () => {
      ativo = false;
      window.clearInterval(t);
    };
  }, [navigate]);

  if (restante === null || restante > AVISO_MS) return null;
  if (dispensado && restante > AVISO_FINAL_MS) return null;

  async function sair() {
    await clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div role="alert" className="flex flex-col gap-2 bg-alt-tint px-4 py-3 text-[13px] text-alt">
      <div className="flex items-start gap-2">
        <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Sua sessão termina em <strong>{formatar(restante)}</strong>. Depois disso será preciso entrar novamente.
          {pendentes > 0 && " Há alterações aguardando sincronização — conecte-se à internet para enviá-las antes."}
        </p>
      </div>
      <div className="flex gap-2 pl-6">
        <button type="button" onClick={() => void sair()} className="font-semibold underline">
          Sair e entrar novamente
        </button>
        {restante > AVISO_FINAL_MS && (
          <button type="button" onClick={() => setDispensado(true)} className="ml-auto font-medium">
            Dispensar
          </button>
        )}
      </div>
    </div>
  );
}