export function valorVazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.every(valorVazio);
  if (typeof valor === "object") return Object.values(valor as Record<string, unknown>).every(valorVazio);
  return false;
}

export function secoesVazias(conteudos: Iterable<unknown>): boolean {
  for (const conteudo of conteudos) {
    if (!valorVazio(conteudo)) return false;
  }
  return true;
}
