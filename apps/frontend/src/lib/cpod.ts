export interface CodigoCondicao {
  codigo: string;
  deciduo: string;
  nome: string;
  fundo: string;
  borda: string;
  texto: string;
  tracejado?: boolean;
}

export const CODIGOS_CONDICAO: ReadonlyArray<CodigoCondicao> = [
  { codigo: "0", deciduo: "A", nome: "Hígido", fundo: "#8FC4BB", borda: "#1F6F64", texto: "#124840" },
  { codigo: "1", deciduo: "B", nome: "Cariado", fundo: "#DE9F8D", borda: "#A6543C", texto: "#6A2D1D" },
  { codigo: "2", deciduo: "C", nome: "Restaurado com cárie", fundo: "#E8AE86", borda: "#B1602E", texto: "#6B3512" },
  { codigo: "3", deciduo: "D", nome: "Restaurado sem cárie", fundo: "#B3BCD6", borda: "#4F5F87", texto: "#2B3552" },
  { codigo: "4", deciduo: "E", nome: "Perdido por cárie", fundo: "#B9BFB5", borda: "#2A2F2B", texto: "#1E241F" },
  { codigo: "5", deciduo: "F", nome: "Perdido por outra razão", fundo: "#E7E9E2", borda: "#8B948A", texto: "#5B655D" },
  { codigo: "6", deciduo: "G", nome: "Apresenta selante", fundo: "#E3CB8A", borda: "#9C7A23", texto: "#5E4710" },
  { codigo: "8", deciduo: "K", nome: "Não erupcionado", fundo: "transparent", borda: "#8B948A", texto: "#8B948A", tracejado: true },
  { codigo: "T", deciduo: "T", nome: "Trauma (fratura)", fundo: "#E7E9F1", borda: "#4F5F87", texto: "#4F5F87" },
  { codigo: "9", deciduo: "L", nome: "Dente excluído", fundo: "#D8DBD2", borda: "#5B655D", texto: "#3A423C" },
];

export function estiloCondicao(c: CodigoCondicao) {
  return {
    backgroundColor: c.fundo,
    color: c.texto,
    borderColor: c.borda,
    borderStyle: c.tracejado ? ("dashed" as const) : ("solid" as const),
  };
}

export type Interpretacao = "Muito baixo" | "Baixo" | "Moderado" | "Alto" | "Muito alto";

export function isDenteDeciduo(numero: number): boolean {
  return numero >= 51 && numero <= 85;
}

export function codigoExibido(condicao: CodigoCondicao, deciduo: boolean): string {
  return deciduo ? condicao.deciduo : condicao.codigo;
}

export function condicaoDoCodigo(codigo: string | undefined, deciduo: boolean): CodigoCondicao | null {
  if (!codigo) return null;
  return CODIGOS_CONDICAO.find((c) => codigoExibido(c, deciduo) === codigo) ?? null;
}

export interface ResultadoCPOD {
  C: number;
  P: number;
  O: number;
  total: number;
  avaliados: number;
}

export interface ResultadoCEOD {
  c: number;
  e: number;
  o: number;
  total: number;
  avaliados: number;
}

export function calcularCPOD(dentes: Record<string, string>): ResultadoCPOD {
  let C = 0;
  let P = 0;
  let O = 0;
  let avaliados = 0;
  for (const num in dentes) {
    if (isDenteDeciduo(Number(num))) continue;
    const cod = dentes[num];
    if (!cod) continue;
    avaliados += 1;
    if (cod === "1") C += 1;
    else if (cod === "4" || cod === "5") P += 1;
    else if (cod === "2" || cod === "3") O += 1;
  }
  return { C, P, O, total: C + P + O, avaliados };
}

export function calcularCEOD(dentes: Record<string, string>): ResultadoCEOD {
  let c = 0;
  let e = 0;
  let o = 0;
  let avaliados = 0;
  for (const num in dentes) {
    if (!isDenteDeciduo(Number(num))) continue;
    const cod = dentes[num];
    if (!cod) continue;
    avaliados += 1;
    if (cod === "B") c += 1;
    else if (cod === "E" || cod === "F") e += 1;
    else if (cod === "C" || cod === "D") o += 1;
  }
  return { c, e, o, total: c + e + o, avaliados };
}

export function interpretarCPOD(total: number): Interpretacao {
  if (total <= 1.1) return "Muito baixo";
  if (total <= 2.6) return "Baixo";
  if (total <= 4.4) return "Moderado";
  if (total <= 6.5) return "Alto";
  return "Muito alto";
}
