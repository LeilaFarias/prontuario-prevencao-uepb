import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { TermosResposta } from "@prontuario/shared";
import { api } from "../lib/api";
import { getSession } from "../lib/session";
import { rotaInicial } from "../lib/rotas";

type Bloco =
  | { tipo: "h1" | "h2"; texto: string; id?: string }
  | { tipo: "p"; texto: string }
  | { tipo: "ul"; itens: string[] };

function parseMarkdown(markdown: string): Bloco[] {
  const blocos: Bloco[] = [];
  let itens: string[] = [];
  const fecharLista = () => {
    if (itens.length > 0) {
      blocos.push({ tipo: "ul", itens });
      itens = [];
    }
  };

  for (const bruta of markdown.split("\n")) {
    const linha = bruta.trim();
    if (!linha) {
      fecharLista();
      continue;
    }
    const titulo = /^(#{1,2})\s+(.*?)(?:\s*\{#([\w-]+)\})?$/.exec(linha);
    if (titulo) {
      fecharLista();
      blocos.push({ tipo: titulo[1].length === 1 ? "h1" : "h2", texto: titulo[2], id: titulo[3] });
      continue;
    }
    if (linha.startsWith("- ")) {
      itens.push(linha.slice(2));
      continue;
    }
    fecharLista();
    blocos.push({ tipo: "p", texto: linha });
  }
  fecharLista();
  return blocos;
}

function Inline({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
        parte.length > 4 && parte.startsWith("**") && parte.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">{parte.slice(2, -2)}</strong>
        ) : (
          parte
        ),
      )}
    </>
  );
}

function renderBloco(bloco: Bloco, i: number): ReactNode {
  switch (bloco.tipo) {
    case "h1":
      return (
        <h1 key={i} className="font-display text-[20px] font-medium leading-snug text-ink">{bloco.texto}</h1>
      );
    case "h2":
      return (
        <h2 key={i} id={bloco.id} className="mt-6 scroll-mt-4 font-display text-[16px] font-medium text-ink">
          {bloco.texto}
        </h2>
      );
    case "ul":
      return (
        <ul key={i} className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-soft">
          {bloco.itens.map((item, j) => (
            <li key={j}><Inline texto={item} /></li>
          ))}
        </ul>
      );
    default:
      return (
        <p key={i} className="mt-2 text-[13.5px] leading-relaxed text-ink-soft"><Inline texto={bloco.texto} /></p>
      );
  }
}

export default function Termos() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const sessao = getSession();
  const [termos, setTermos] = useState<TermosResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    setErro(null);
    api
      .get<TermosResposta>("/termos")
      .then(setTermos)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os termos."));
  }

  useEffect(carregar, []);

  useEffect(() => {
    if (!termos || !hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [termos, hash]);

  function voltar() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    window.close();
    navigate(sessao ? rotaInicial(sessao.user.perfil) : "/login", { replace: true });
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-5 pb-6 pt-8">
        {erro && (
          <div role="alert" className="banner-erro">
            {erro}{" "}
            <button type="button" onClick={carregar} className="font-semibold underline">Tentar novamente</button>
          </div>
        )}
        {!termos && !erro && <p className="text-[13px] text-ink-soft">Carregando…</p>}
        {termos && parseMarkdown(termos.conteudo).map(renderBloco)}
      </main>

      <div className="sticky bottom-0 border-t border-line-soft bg-paper px-5 py-4">
        {sessao ? (
          <button type="button" onClick={voltar} className="btn-ghost">Voltar</button>
        ) : (
          <button type="button" onClick={() => navigate("/login")} className="btn-dark">Entrar</button>
        )}
      </div>
    </div>
  );
}
