import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { startSyncLoop } from "./sync/queue";
import "./index.css";

async function solicitarPersistencia(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const jaPersistente = (await navigator.storage.persisted?.()) ?? false;
    if (jaPersistente) return;
    const concedida = await navigator.storage.persist();
    if (!concedida) {
      console.warn("[storage] persistência do IndexedDB não concedida pelo navegador");
    }
  } catch (err) {
    console.warn("[storage] falha ao solicitar persistência", err);
  }
}

void solicitarPersistencia();
startSyncLoop();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);