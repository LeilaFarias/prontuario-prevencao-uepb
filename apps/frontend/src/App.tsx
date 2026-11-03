import { useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getSession } from "./lib/session";
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
import SessaoAviso from "./components/SessaoAviso";

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

function Inicio() {
  return <Navigate to={rotaInicial(getSession()?.user.perfil)} replace />;
}

export default function App() {
  useLocation();
  const token = getSession()?.accessToken;

  useEffect(() => {
    void atualizarCacheProfessores();
    const aoFicarOnline = () => void atualizarCacheProfessores();
    window.addEventListener("online", aoFicarOnline);
    return () => window.removeEventListener("online", aoFicarOnline);
  }, [token]);

  return (
    <div className="device">
      <SessaoAviso />
      <Routes>
        <Route path="/login" element={<SomenteVisitante><Login /></SomenteVisitante>} />
        <Route path="/cadastro" element={<SomenteVisitante><Cadastro /></SomenteVisitante>} />
        <Route path="/recuperar" element={<SomenteVisitante><RecuperarSenha /></SomenteVisitante>} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/prontuarios" element={<SomenteAluno><ListaProntuarios /></SomenteAluno>} />
        <Route path="/fila" element={<SomenteProfessor><Fila /></SomenteProfessor>} />
        <Route path="/acessos" element={<SomenteProfessor><Acessos /></SomenteProfessor>} />
        <Route path="/encaminhamentos" element={<SomenteProfessor><Encaminhamentos /></SomenteProfessor>} />
        <Route path="/fila/:id" element={<SomenteProfessor><RevisaoProntuario /></SomenteProfessor>} />
        <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
        <Route path="/prontuario/:id" element={<Protegida><Prontuario /></Protegida>} />
        <Route path="*" element={<Inicio />} />
      </Routes>
    </div>
  );
}
