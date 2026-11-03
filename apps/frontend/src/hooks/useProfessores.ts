import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface Professor {
  id: string;
  nome: string;
  matricula: string | null;
}

const CACHE_KEY = "prontuario:professores";

function lerCache(): Professor[] | null {
  try {
    const bruto = localStorage.getItem(CACHE_KEY);
    if (!bruto) return null;
    const dados: unknown = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as Professor[]) : null;
  } catch {
    return null;
  }
}

function gravarCache(lista: Professor[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(lista));
  } catch {
  }
}

export function useProfessores(): { professores: Professor[]; carregando: boolean; falhou: boolean } {
  const [inicial] = useState<Professor[] | null>(lerCache);
  const [professores, setProfessores] = useState<Professor[]>(inicial ?? []);
  const [carregando, setCarregando] = useState(inicial === null && navigator.onLine);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!navigator.onLine) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    api
      .get<Professor[]>("/professores")
      .then((lista) => {
        if (!ativo) return;
        setProfessores(lista);
        setFalhou(false);
        gravarCache(lista);
      })
      .catch(() => {
        if (ativo) setFalhou(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { professores, carregando, falhou };
}
