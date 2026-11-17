import { useEffect, useReducer } from "react";
import { campoPacienteCifrado, decifrarCamposPaciente, getChave } from "../lib/chaveLocal";

interface ItemPaciente {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento?: string | null;
}

export interface PacienteDecifrado {
  pacienteNome: string;
  pacienteDataNascimento: string | undefined;
  bloqueado: boolean;
  carregando: boolean;
}

interface EntradaCache {
  chave: CryptoKey;
  nomeBruto: string;
  nascimentoBruto: string | undefined;
  nome: string;
  nascimento: string | undefined;
}

const cache = new Map<string, EntradaCache>();

function lerDoCache(id: string, nomeBruto: string, nascimentoBruto: string | undefined, chave: CryptoKey) {
  const entrada = cache.get(id);
  if (!entrada) return undefined;
  const valida =
    entrada.chave === chave && entrada.nomeBruto === nomeBruto && entrada.nascimentoBruto === nascimentoBruto;
  if (!valida) cache.delete(id);
  return valida ? entrada : undefined;
}

export function usePacienteDecifrado(item: ItemPaciente): PacienteDecifrado {
  const [, renderizar] = useReducer((n: number) => n + 1, 0);
  const { id } = item;
  const nomeBruto = item.pacienteNome ?? "";
  const nascimentoBruto = item.pacienteDataNascimento ?? undefined;
  const chave = getChave();
  const cifrado = campoPacienteCifrado(nomeBruto) || campoPacienteCifrado(nascimentoBruto);
  const entrada = chave && cifrado ? lerDoCache(id, nomeBruto, nascimentoBruto, chave) : undefined;

  if (!chave) cache.clear();

  useEffect(() => {
    if (!chave || !cifrado || entrada) return;
    let ativo = true;
    decifrarCamposPaciente(chave, { pacienteNome: nomeBruto, pacienteDataNascimento: nascimentoBruto })
      .then((claro) => {
        cache.set(id, {
          chave,
          nomeBruto,
          nascimentoBruto,
          nome: claro.pacienteNome,
          nascimento: claro.pacienteDataNascimento,
        });
        if (ativo) renderizar();
      })
      .catch((erro: unknown) => console.warn("[paciente] falha ao decifrar:", erro));
    return () => {
      ativo = false;
    };
  }, [id, nomeBruto, nascimentoBruto, chave, cifrado, entrada]);

  if (!cifrado) {
    return { pacienteNome: nomeBruto, pacienteDataNascimento: nascimentoBruto, bloqueado: false, carregando: false };
  }
  if (!chave) {
    return { pacienteNome: "", pacienteDataNascimento: undefined, bloqueado: true, carregando: false };
  }
  if (!entrada) {
    return { pacienteNome: "", pacienteDataNascimento: undefined, bloqueado: false, carregando: true };
  }
  return { pacienteNome: entrada.nome, pacienteDataNascimento: entrada.nascimento, bloqueado: false, carregando: false };
}