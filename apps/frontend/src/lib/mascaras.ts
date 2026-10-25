export const apenasDigitos = (v: string): string => v.replace(/\D/g, "");

export function formatarCep(digitos: string): string {
  const d = apenasDigitos(digitos).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function limparCep(entrada: string): string {
  return apenasDigitos(entrada).slice(0, 8);
}

export function limparUf(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}
