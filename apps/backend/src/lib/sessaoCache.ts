const TTL_MS = 10_000;
const MAX_ENTRADAS = 500;

const entradas = new Map<string, { tokenVersion: number; expiraEm: number }>();
let marcaInvalidacao = 0;

export function marcaAtual(): number {
  return marcaInvalidacao;
}

export function lerSessaoCache(usuarioId: string): number | undefined {
  const entrada = entradas.get(usuarioId);
  if (!entrada) return undefined;
  if (entrada.expiraEm <= Date.now()) {
    entradas.delete(usuarioId);
    return undefined;
  }
  return entrada.tokenVersion;
}

export function gravarSessaoCache(usuarioId: string, tokenVersion: number, marca: number): void {
  if (marca !== marcaInvalidacao) return;
  if (entradas.size >= MAX_ENTRADAS) entradas.clear();
  entradas.set(usuarioId, { tokenVersion, expiraEm: Date.now() + TTL_MS });
}

export function invalidarSessaoCache(usuarioId: string): void {
  marcaInvalidacao += 1;
  entradas.delete(usuarioId);
}
