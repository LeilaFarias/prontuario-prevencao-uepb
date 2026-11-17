import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { UsuarioMe } from "@prontuario/shared";
import { db } from "./db/dexie";
import { api, EVENTO_TERMOS_NAO_ACEITOS } from "./lib/api";
import { getChave } from "./lib/chaveLocal";
import { atualizarMetaPin, lerMetaPin, migrarNomesCifrados, type MetaPin } from "./lib/pinCriptografia";
import { getSession } from "./lib/session";
import { APP_BLOQUEADO_EVENT } from "./sync/queue";
import { atualizarCacheProfessores } from "./sync/professores";
import { rotaInicial } from "./lib/rotas";
import Login from "./routes/Login";
import Cadastro from "./routes/Cadastro";
import ListaProntuarios from "./routes/ListaProntuarios";
import Prontuario from "./routes/Prontuario";
import Fila from "./routes/Fila";
import Acessos from "./routes/Acessos";
import Encaminhamentos from "./routes/Encaminhamentos";
import RevisaoProntuario from "./routes/RevisaoProntuario";
import Perfil from "./routes/Perfil";
import RecuperarSenha from "./routes/RecuperarSenha";
import RedefinirSenha from "./routes/RedefinirSenha";
import Termos from "./routes/Termos";
import SessaoAviso from "./components/SessaoAviso";
import ModalTermos from "./components/ModalTermos";
import UnlockPin from "./components/UnlockPin";
import ErrorBoundary from "./components/ErrorBoundary";

function Protegida({ children }: { children: ReactElement }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

function SomenteVisitante({ children }: { children: ReactElement }) {
  const sessao = getSession();
  return sessao ? <Navigate to={rotaInicial(sessao.user.perfil)} replace /> : children;
}

function SomenteProfessor({ children }: { children: ReactElement }) {
  const sessao = getSession();
  if (!sessao) return <Navigate to="/login" replace />;
  return sessao.user.perfil === "professor" ? children : <Navigate to="/prontuarios" replace />;
}

function SomenteAluno({ children }: { children: ReactElement }) {
  const sessao = getSession();
  if (!sessao) return <Navigate to="/login" replace />;
  return sessao.user.perfil === "professor" ? <Navigate to="/fila" replace /> : children;
}

function GateTermos({ onAceito }: { onAceito: () => void }) {
  const { pathname } = useLocation();
  const token = getSession()?.accessToken;
  const [usuario, setUsuario] = useState<UsuarioMe | null>(null);

  const carregar = useCallback(async () => {
    try {
      setUsuario(await api.get<UsuarioMe>("/users/me"));
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    setUsuario(null);
    if (!token) return;
    void carregar();
    const aoNegar = () => void carregar();
    window.addEventListener(EVENTO_TERMOS_NAO_ACEITOS, aoNegar);
    return () => window.removeEventListener(EVENTO_TERMOS_NAO_ACEITOS, aoNegar);
  }, [token, carregar]);

  if (!token || !usuario || pathname.startsWith("/termos")) return null;
  const { versaoAtual } = usuario;
  if (!versaoAtual || (usuario.termosAceitosEm && usuario.termosVersao === versaoAtual)) return null;

  return (
    <ModalTermos
      perfil={usuario.perfil}
      versao={versaoAtual}
      onAceito={async () => {
        await carregar();
        onAceito();
      }}
    />
  );
}

function GateCriptografia({ onDesbloqueado }: { onDesbloqueado: () => void }) {
  const sessao = getSession();
  const userId = sessao?.user.id;
  const token = sessao?.accessToken;
  const [meta, setMeta] = useState<MetaPin | null>(null);
  const totalLocal = useLiveQuery(() => db.prontuarios.count(), []);

  useEffect(() => {
    if (!userId) {
      setMeta(null);
      return;
    }
    setMeta(lerMetaPin(userId));
    if (!navigator.onLine) return;
    let ativo = true;
    atualizarMetaPin(userId)
      .then((m) => ativo && setMeta(m))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [userId, token]);

  if (!userId || !meta || getChave()) return null;
  if (!meta.tem && !totalLocal) return null;
  return <UnlockPin temPin={meta.tem} onDesbloqueado={onDesbloqueado} />;
}

function AvisoBloqueio() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const mostrar = () => setVisivel(true);
    window.addEventListener(APP_BLOQUEADO_EVENT, mostrar);
    return () => window.removeEventListener(APP_BLOQUEADO_EVENT, mostrar);
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const t = window.setTimeout(() => setVisivel(false), 4_000);
    return () => window.clearTimeout(t);
  }, [visivel]);

  if (!visivel) return null;
  return (
    <div role="alert" className="fixed inset-x-4 top-4 z-50 rounded-lg bg-alt-tint px-4 py-2.5 text-[13px] text-alt shadow-lg">
      Desbloqueie o app primeiro.
    </div>
  );
}

function Inicio() {
  return <Navigate to={rotaInicial(getSession()?.user.perfil)} replace />;
}

export default function App() {
  useLocation();
  const token = getSession()?.accessToken;
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    migrarNomesCifrados().catch((erro: unknown) => console.warn("[migracao] nomes de pacientes:", erro));
  }, [token, recarga]);

  useEffect(() => {
    void atualizarCacheProfessores();
    let agendado: number | undefined;
    const aoFicarOnline = () => {
      window.clearTimeout(agendado);
      agendado = window.setTimeout(() => void atualizarCacheProfessores(), 3_000);
    };
    window.addEventListener("online", aoFicarOnline);
    return () => {
      window.clearTimeout(agendado);
      window.removeEventListener("online", aoFicarOnline);
    };
  }, [token]);

  return (
    <div className="device">
      <SessaoAviso />
      <GateTermos onAceito={() => setRecarga((n) => n + 1)} />
      <GateCriptografia onDesbloqueado={() => setRecarga((n) => n + 1)} />
      <AvisoBloqueio />
      <Routes key={recarga}>
        <Route path="/login" element={<SomenteVisitante><Login /></SomenteVisitante>} />
        <Route path="/cadastro" element={<SomenteVisitante><Cadastro /></SomenteVisitante>} />
        <Route path="/recuperar" element={<SomenteVisitante><RecuperarSenha /></SomenteVisitante>} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/prontuarios" element={<SomenteAluno><ListaProntuarios /></SomenteAluno>} />
        <Route path="/fila" element={<SomenteProfessor><Fila /></SomenteProfessor>} />
        <Route path="/acessos" element={<SomenteProfessor><Acessos /></SomenteProfessor>} />
        <Route path="/encaminhamentos" element={<SomenteProfessor><Encaminhamentos /></SomenteProfessor>} />
        <Route path="/fila/:id" element={<SomenteProfessor><RevisaoProntuario /></SomenteProfessor>} />
        <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
        <Route path="/prontuario/:id" element={<Protegida><ErrorBoundary><Prontuario /></ErrorBoundary></Protegida>} />
        <Route path="*" element={<Inicio />} />
      </Routes>
    </div>
  );
}
