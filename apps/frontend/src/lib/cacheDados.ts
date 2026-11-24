export interface ErroCache {
  mensagem: string;
  status: number;
}

export interface EntradaCache {
  dados?: unknown;
  erro: ErroCache | null;
  buscando: boolean;
  atualizadoEm: number;
}

const VAZIA: EntradaCache = { erro: null, buscando: false, atualizadoEm: 0 };

const entradas = new Map<string, EntradaCache>();
const ouvintes = new Map<string, Set<() => void>>();
const emVoo = new Map<string, Promise<void>>();
const tokens = new Map<string, symbol>();

function notificar(chave: string): void {
  ouvintes.get(chave)?.forEach((ouvinte) => ouvinte());
}

function gravar(chave: string, parcial: Partial<EntradaCache>): void {
  entradas.set(chave, { ...(entradas.get(chave) ?? VAZIA), ...parcial });
  notificar(chave);
}

function converterErro(err: unknown): ErroCache {
  const status = (err as { status?: unknown } | null)?.status;
  return {
    mensagem: err instanceof Error ? err.message : "Não foi possível carregar os dados.",
    status: typeof status === "number" ? status : 0,
  };
}

export function lerEntrada(chave: string): EntradaCache {
  return entradas.get(chave) ?? VAZIA;
}

export function assinar(chave: string, ouvinte: () => void): () => void {
  let conjunto = ouvintes.get(chave);
  if (!conjunto) {
    conjunto = new Set();
    ouvintes.set(chave, conjunto);
  }
  conjunto.add(ouvinte);
  return () => {
    conjunto.delete(ouvinte);
    if (conjunto.size === 0) ouvintes.delete(chave);
  };
}

export function revalidar<T>(chave: string, buscar: () => Promise<T>, minIdadeMs = 0): Promise<void> {
  const atual = entradas.get(chave);
  if (atual?.dados !== undefined && Date.now() - atual.atualizadoEm < minIdadeMs) return Promise.resolve();

  const existente = emVoo.get(chave);
  if (existente) return existente;

  const token = Symbol(chave);
  tokens.set(chave, token);
  gravar(chave, { buscando: true, erro: null });

  const promessa = buscar()
    .then(
      (dados) => {
        if (tokens.get(chave) === token) gravar(chave, { dados, erro: null, buscando: false, atualizadoEm: Date.now() });
      },
      (err: unknown) => {
        if (tokens.get(chave) === token) gravar(chave, { erro: converterErro(err), buscando: false });
      },
    )
    .finally(() => {
      if (tokens.get(chave) !== token) return;
      tokens.delete(chave);
      emVoo.delete(chave);
    });

  emVoo.set(chave, promessa);
  return promessa;
}

export function marcarObsoleto(prefixo: string): void {
  for (const [chave, entrada] of entradas) {
    if (chave.startsWith(prefixo)) entradas.set(chave, { ...entrada, atualizadoEm: 0 });
  }
}

export function descartar(prefixo: string): void {
  for (const chave of [...entradas.keys()]) {
    if (!chave.startsWith(prefixo)) continue;
    entradas.delete(chave);
    tokens.delete(chave);
    emVoo.delete(chave);
    notificar(chave);
  }
}

export function limparCacheDados(): void {
  const chaves = [...entradas.keys()];
  entradas.clear();
  tokens.clear();
  emVoo.clear();
  chaves.forEach(notificar);
}
