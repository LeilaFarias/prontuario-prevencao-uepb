import { ClipboardList, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAcessosCount } from "../hooks/useAcessosCount";

type Aba = "fila" | "acessos";

export default function TabBarProfessor({ ativa }: { ativa: Aba }) {
  const navigate = useNavigate();
  const pedidos = useAcessosCount();

  const abas: Array<{ id: Aba; rota: string; rotulo: string; Icone: typeof ClipboardList; badge: number }> = [
    { id: "fila", rota: "/fila", rotulo: "Fila", Icone: ClipboardList, badge: 0 },
    { id: "acessos", rota: "/acessos", rotulo: "Acessos", Icone: KeyRound, badge: pedidos },
  ];

  return (
    <nav aria-label="Navegação do professor" className="sticky bottom-0 grid grid-cols-2 border-t border-line bg-paper">
      {abas.map(({ id, rota, rotulo, Icone, badge }) => {
        const selecionada = id === ativa;
        return (
          <button
            key={id}
            type="button"
            onClick={() => !selecionada && navigate(rota)}
            aria-current={selecionada ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-semibold ${
              selecionada ? "text-prof" : "text-ink-faint"
            }`}
          >
            <span className="relative">
              <Icone size={20} aria-hidden="true" />
              {badge > 0 && (
                <span
                  aria-label={`${badge} ${badge === 1 ? "pedido pendente" : "pedidos pendentes"}`}
                  className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alt px-1 text-[10px] font-bold leading-none text-white"
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
