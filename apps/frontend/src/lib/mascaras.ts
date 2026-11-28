export const apenasDigitos = (v: string): string => v.replace(/\D/g, "");

const MARCADORES = new Set(["NDN", "Não informado", "Não se aplica"]);

function preservarMarcador(valor: string): string | null {
  const marcador = [...MARCADORES].find((opcao) => opcao.toLocaleLowerCase("pt-BR") === valor.trim().toLocaleLowerCase("pt-BR"));
  return marcador ?? null;
}

export function formatarCep(digitos: string): string {
  const marcador = preservarMarcador(digitos);
  if (marcador) return marcador;
  const d = apenasDigitos(digitos).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function limparCep(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  return apenasDigitos(entrada).slice(0, 8);
}

export function limparUf(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  return entrada.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

export function formatarCpf(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  const d = apenasDigitos(entrada).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

export function limparCpf(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  return apenasDigitos(entrada).slice(0, 11);
}

export function formatarCartaoSus(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  const d = apenasDigitos(entrada).slice(0, 15);
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11), d.slice(11)].filter(Boolean).join(" ");
}

export function limparCartaoSus(entrada: string): string {
  const marcador = preservarMarcador(entrada);
  if (marcador) return marcador;
  return apenasDigitos(entrada).slice(0, 15);
}
