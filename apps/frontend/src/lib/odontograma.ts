import type { DenteSangramento } from "@prontuario/shared";

export type Arcada = "superior" | "inferior";
export type Face = "V" | "P" | "L";

export interface Quadrante {
  nome: string;
  permanentes: ReadonlyArray<number>;
  deciduos: ReadonlyArray<number>;
  arcada: Arcada;
  facesAvaliadas: ReadonlyArray<Face>;
}

export const QUADRANTES: ReadonlyArray<Quadrante> = [
  {
    nome: "Superior direito",
    permanentes: [17, 16, 15, 14, 13, 12, 11],
    deciduos: [55, 54, 53, 52, 51],
    arcada: "superior",
    facesAvaliadas: ["V", "P"],
  },
  {
    nome: "Superior esquerdo",
    permanentes: [21, 22, 23, 24, 25, 26, 27],
    deciduos: [61, 62, 63, 64, 65],
    arcada: "superior",
    facesAvaliadas: ["V", "P"],
  },
  {
    nome: "Inferior esquerdo",
    permanentes: [31, 32, 33, 34, 35, 36, 37],
    deciduos: [71, 72, 73, 74, 75],
    arcada: "inferior",
    facesAvaliadas: ["V", "L"],
  },
  {
    nome: "Inferior direito",
    permanentes: [41, 42, 43, 44, 45, 46, 47],
    deciduos: [81, 82, 83, 84, 85],
    arcada: "inferior",
    facesAvaliadas: ["V", "L"],
  },
];

export const NOMES_FACE: Record<Face, string> = {
  V: "vestibular",
  P: "palatina",
  L: "lingual",
};

export type DentesSangramento = Record<string, DenteSangramento>;

const FACES_POR_DENTE = new Map<string, ReadonlyArray<Face>>(
  QUADRANTES.flatMap((q) =>
    [...q.permanentes, ...q.deciduos].map((n) => [String(n), q.facesAvaliadas] as const),
  ),
);

export function denteVazio(): DenteSangramento {
  return { presente: false, faces: { V: 0, P: 0, L: 0 } };
}

export function gerarDentesVazios(): DentesSangramento {
  const dentes: DentesSangramento = {};
  for (const numero of FACES_POR_DENTE.keys()) dentes[numero] = denteVazio();
  return dentes;
}

export interface ResultadoSG {
  dentesPresentes: number;
  facesSangrantes: number;
  percentual: number;
  interpretacao: string;
}

export function calcularSG(dentes: DentesSangramento): ResultadoSG {
  let dentesPresentes = 0;
  let facesSangrantes = 0;

  for (const [numero, dente] of Object.entries(dentes)) {
    const faces = FACES_POR_DENTE.get(numero);
    if (!faces || !dente.presente) continue;
    dentesPresentes += 1;
    for (const face of faces) {
      if (dente.faces[face] === 1) facesSangrantes += 1;
    }
  }

  const percentual = dentesPresentes === 0 ? 0 : (facesSangrantes * 100) / (dentesPresentes * 2);
  const interpretacao =
    percentual === 0 ? "Sem sangramento gengival" : "Quanto maior o percentual, pior a saúde gengival";

  return { dentesPresentes, facesSangrantes, percentual, interpretacao };
}
