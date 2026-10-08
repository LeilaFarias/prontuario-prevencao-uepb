import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import StatusBar from "./components/StatusBar";
import { getSession } from "./lib/session";
import Login from "./routes/Login";
import Cadastro from "./routes/Cadastro";
import ListaProntuarios from "./routes/ListaProntuarios";
import Prontuario from "./routes/Prontuario";

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
      <Routes>
        <Route path="/login" element={<SomenteVisitante><Login /></SomenteVisitante>} />
        <Route path="/cadastro" element={<SomenteVisitante><Cadastro /></SomenteVisitante>} />
        <Route path="/prontuarios" element={<Protegida><ListaProntuarios /></Protegida>} />
        <Route path="/prontuario/:id" element={<Protegida><Prontuario /></Protegida>} />
        <Route path="*" element={<Navigate to="/prontuarios" replace />} />
      </Routes>
    </div>
  );
}
