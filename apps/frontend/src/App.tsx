import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import StatusBar from "./components/StatusBar";
import { getSession } from "./lib/session";
import Login from "./routes/Login";
import Cadastro from "./routes/Cadastro";
import ListaProntuarios from "./routes/ListaProntuarios";
import Prontuario from "./routes/Prontuario";
import Perfil from "./routes/Perfil";
import RecuperarSenha from "./routes/RecuperarSenha";
import RedefinirSenha from "./routes/RedefinirSenha";
import SessaoAviso from "./components/SessaoAviso";

function Protegida({ children }: { children: ReactElement }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

function SomenteVisitante({ children }: { children: ReactElement }) {
  return getSession() ? <Navigate to="/prontuarios" replace /> : children;
}

export default function App() {
  return (
    <div className="device">
      <StatusBar />
      <SessaoAviso />
      <Routes>
        <Route path="/login" element={<SomenteVisitante><Login /></SomenteVisitante>} />
        <Route path="/cadastro" element={<SomenteVisitante><Cadastro /></SomenteVisitante>} />
        <Route path="/recuperar" element={<SomenteVisitante><RecuperarSenha /></SomenteVisitante>} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/prontuarios" element={<Protegida><ListaProntuarios /></Protegida>} />
        <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
        <Route path="/prontuario/:id" element={<Protegida><Prontuario /></Protegida>} />
        <Route path="*" element={<Navigate to="/prontuarios" replace />} />
      </Routes>
    </div>
  );
}
