import { ClipboardCheck, Lock, Send, Settings, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAcessosCount } from "../hooks/useAcessosCount";
import { useEncaminhamentos } from "../hooks/useEncaminhamentos";

type Aba = "fila" | "encaminhar" | "acessos" | "ajustes";

export default function TabBarProfessor({ ativa }: { ativa: Aba }) {
  const navigate = useNavigate();
  const pedidos = useAcessosCount();
  const { encaminhamentos } = useEncaminhamentos("semestre");

  const abas: Array<{
    id: Aba;
    rota: string;
    rotulo: string;
    Icone: LucideIcon;
    badge: number;
    corBadge: string;
    descricaoBadge: string;
  }> = [
    { id: "fila", rota: "/fila", rotulo: "Fila", Icone: ClipboardCheck, badge: 0, corBadge: "", descricaoBadge: "" },
    {
      id: "encaminhar",
      rota: "/encaminhamentos",
      rotulo: "Encaminhar",
      Icone: Send,
      badge: encaminhamentos.length,
      corBadge: "bg-prof",
      descricaoBadge: encaminhamentos.length === 1 ? "encaminhamento no semestre" : "encaminhamentos no semestre",
    },
    {
      id: "acessos",
      rota: "/acessos",
      rotulo: "Acessos",
      Icone: Lock,
      badge: pedidos,
      corBadge: "bg-alt",
      descricaoBadge: pedidos === 1 ? "pedido pendente" : "pedidos pendentes",
    },
    { id: "ajustes", rota: "/perfil", rotulo: "Ajustes", Icone: Settings, badge: 0, corBadge: "", descricaoBadge: "" },
  ];

  return (
    <nav aria-label="Navegação do professor" className="sticky bottom-0 grid grid-cols-4 border-t border-line bg-paper">
      {abas.map(({ id, rota, rotulo, Icone, badge, corBadge, descricaoBadge }) => {
        const selecionada = id === ativa;
        return (
          <button
            key={id}
            type="button"
            onClick={() => !selecionada && navigate(rota)}
            aria-current={selecionada ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold ${
              selecionada ? "text-prof" : "text-ink-faint"
            }`}
          >
            <span
              className={`relative flex h-7 w-12 items-center justify-center rounded-pill ${
                selecionada ? "bg-prof-tint" : ""
              }`}
            >
              <Icone size={20} aria-hidden="true" />
              {badge > 0 && (
                <span
                  aria-label={`${badge} ${descricaoBadge}`}
                  className={`absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ${corBadge}`}
                >
                  {badge}
                </span>
              )}
            </span>
            {rotulo}
          </button>
        );
      })}
    </nav>
  );
}
