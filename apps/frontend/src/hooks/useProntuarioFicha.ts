import { useContext } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { lerProntuarioDecifrado, type LocalProntuario } from "../db/dexie";
import { EdicaoProfessorContext } from "../lib/edicaoProfessor";

export function useProntuarioFicha(prontuarioId: string): LocalProntuario | undefined {
  const edicao = useContext(EdicaoProfessorContext);
  const local = useLiveQuery(
    () => (edicao ? undefined : lerProntuarioDecifrado(prontuarioId)),
    [prontuarioId, edicao === null],
  );
  return edicao ? edicao.prontuario : local;
}
