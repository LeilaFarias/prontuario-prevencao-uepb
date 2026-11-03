import type { RegistroCPODDados } from "@prontuario/shared";
import { calcularCEOD, calcularCPOD } from "./cpod";

export interface LinhaComparacao {
  chave: string;
  rotulo: string;
  aluno: string;
  sistema: number;
  confere: boolean;
  total: boolean;
}

export interface GrupoComparacao {
  titulo: string;
  subtitulo: string;
  linhas: LinhaComparacao[];
  semRegistro: boolean;
}

export interface ComparacaoRegistro {
  cpod: GrupoComparacao;
  ceod: GrupoComparacao;
  confere: boolean;
}

function montarLinha(chave: string, rotulo: string, aluno: string, sistema: number, total = false): LinhaComparacao {
  const digitado = aluno.trim();
  return { chave, rotulo, aluno: digitado, sistema, confere: digitado !== "" && Number(digitado) === sistema, total };
}

function montarGrupo(
  titulo: string,
  subtitulo: string,
  avaliados: number,
  itens: ReadonlyArray<{ chave: string; rotulo: string; aluno: string; sistema: number; total?: boolean }>,
): GrupoComparacao {
  const semRegistro = avaliados === 0 && itens.every((i) => i.aluno.trim() === "");
  const linhas = itens.map((i) => {
    const l = montarLinha(i.chave, i.rotulo, i.aluno, i.sistema, i.total);
    return semRegistro ? { ...l, confere: true } : l;
  });
  return { titulo, subtitulo, linhas, semRegistro };
}

export function compararRegistroCPOD(registro: RegistroCPODDados): ComparacaoRegistro {
  const cpod = calcularCPOD(registro.dentes);
  const ceod = calcularCEOD(registro.dentes);
  const m = registro.cpodManual;
  const d = registro.ceodManual;

  const grupoCPOD = montarGrupo("CPO-D", "Dentes permanentes", cpod.avaliados, [
    { chave: "C", rotulo: "C · Cariados", aluno: m.C, sistema: cpod.C },
    { chave: "P", rotulo: "P · Perdidos", aluno: m.P, sistema: cpod.P },
    { chave: "O", rotulo: "O · Obturados", aluno: m.O, sistema: cpod.O },
    { chave: "total", rotulo: "Total", aluno: m.total, sistema: cpod.total, total: true },
  ]);
  const grupoCEOD = montarGrupo("ceo-d", "Dentes decíduos", ceod.avaliados, [
    { chave: "c", rotulo: "c · Cariados", aluno: d.c, sistema: ceod.c },
    { chave: "e", rotulo: "e · Extraídos", aluno: d.e, sistema: ceod.e },
    { chave: "o", rotulo: "o · Obturados", aluno: d.o, sistema: ceod.o },
    { chave: "total", rotulo: "Total", aluno: d.total, sistema: ceod.total, total: true },
  ]);

  const confere = [...grupoCPOD.linhas, ...grupoCEOD.linhas].every((l) => l.confere);
  return { cpod: grupoCPOD, ceod: grupoCEOD, confere };
}

export function temDivergenciaCPOD(registros: ReadonlyArray<RegistroCPODDados>): boolean {
  return registros.some((r) => !compararRegistroCPOD(r).confere);
}
