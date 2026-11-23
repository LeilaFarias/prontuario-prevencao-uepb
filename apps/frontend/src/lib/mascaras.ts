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
