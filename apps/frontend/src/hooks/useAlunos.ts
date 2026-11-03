import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface Aluno {
  id: string;
  nome: string;
}

export function useAlunos(): { alunos: Aluno[]; carregando: boolean; falhou: boolean } {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<Aluno[]>("/alunos")
      .then((lista) => {
        if (ativo) setAlunos(lista);
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

  return { alunos, carregando, falhou };
}
