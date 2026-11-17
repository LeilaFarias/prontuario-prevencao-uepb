import Dexie, { type DBCore, type DBCoreCursor, type DBCoreTable, type Table } from "dexie";
import type { HistoricoProntuario } from "@prontuario/shared";
import { LockedError, decryptField, encryptField, type EncryptedField } from "../lib/crypto";
import { keyring } from "../lib/keyring";

export type LocalStatus = "em_andamento" | "enviado" | "assinado" | "devolvido" | "transferido";

export interface LocalProntuario {
  id: string;
  pacienteNome: string;
  pacienteDataNascimento?: string;
  status: LocalStatus;
  secoes: Record<string, any>;
  criadoEm: number;
  atualizadoEm: number;
  sincronizado: boolean;
  alunoTitularId?: string;
  erroEnvio?: "professor_nao_encontrado" | "falha";
  assinadoEm?: string;
  assinadoPorNome?: string;
  professorSupervisorId?: string;
  professorSupervisorNome?: string;
  acessoSolicitadoEm?: string;
  acessoExpiraEm?: string;
  acessoRevogadoEm?: string;
  acessoRecusadoEm?: string;
  devolvidoEm?: string;
  devolvidoPorNome?: string;
  motivoDevolucao?: string;
  comentarioDevolucao?: string;
  vistoPeloAluno?: boolean;
  sinalizadoDuplicidade?: boolean;
  duplicidadeEmAnalise?: boolean;
  transferidoDe?: string;
  transferidoPara?: string;
  transferidoParaNome?: string;
  historico?: HistoricoProntuario;
  descartadoEm?: string;
}

export interface LocalPlanoProfessor {
  prontuarioId: string;
  sessoes: Array<{ numero: number; descricao: string }>;
  atualizadoEm: number;
}

export interface LocalProfessor {
  id: string;
  nome: string;
  matricula: string;
}

export interface LocalProfessorLiberacao {
  professorId: string;
  nome: string;
  pinHashClient: string;
  saltClient: string;
  sincronizadoEm: number;
}

export interface LocalLiberacaoOffline {
  id: string;
  alunoId: string;
  professorId: string;
  prontuarioId: string;
  liberadoEm: number;
  expiresAt: number;
  sincronizado: boolean;
}

export interface LocalCredential {
  userId: string;
  pinHash: string;
  salt: string;
  failedAttempts: number;
  lastFailedAt: number | null;
}

export interface LocalAutorizacaoOffline {
  id: string;
  professorId: string;
  alunoId: string;
  prontuarioId: string;
  operations: string[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
  publicKeyPem: string;
  revokedAt: string | null;
  ownerId: string;
}

export interface LocalSyncOp {
  id?: number;
  prontuarioId: string;
  op: "create" | "update" | "delete" | "enviar" | "reabrir" | "descartar";
  entity: "prontuario" | "secao" | "procedimento" | "anexo";
  entityId: string;
  payload: Record<string, unknown>;
  ts: number;
}

class ProntuarioDB extends Dexie {
  prontuarios!: Table<LocalProntuario, string>;
  syncQueue!: Table<LocalSyncOp, number>;
  planosProfessor!: Table<LocalPlanoProfessor, string>;
  professores!: Table<LocalProfessor, string>;
  professoresLiberacao!: Table<LocalProfessorLiberacao, string>;
  liberacoesOffline!: Table<LocalLiberacaoOffline, string>;
  autorizacoesOffline!: Table<LocalAutorizacaoOffline, string>;
  localCredentials!: Table<LocalCredential, string>;
  prontuarios_legacy!: Table<any, string>;
  syncQueue_legacy!: Table<any, number>;
  planosProfessor_legacy!: Table<any, string>;

  constructor() {
    super("prontuario-digital");
    this.version(1).stores({
      prontuarios: "id, status, atualizadoEm, sincronizado",
      syncQueue: "++id, prontuarioId, ts",
    });
    this.version(2).stores({
      planosProfessor: "prontuarioId, atualizadoEm",
    });
    this.version(3).stores({
      professores: "id, matricula",
    });
    this.version(4).stores({
      professoresLiberacao: "professorId",
      liberacoesOffline: "id, alunoId, prontuarioId",
    });
    this.version(5).stores({
      autorizacoesOffline: "id, prontuarioId, professorId, alunoId, ownerId, expiresAt",
      localCredentials: "userId",
      prontuarios_legacy: "id",
      syncQueue_legacy: "id",
      planosProfessor_legacy: "prontuarioId",
    });
    this.use({ stack: "dbcore", name: "campos-cifrados", create: criarDbCoreCifrado });
  }
}

export const db = new ProntuarioDB();

type CamposAcesso = Pick<LocalProntuario, "acessoExpiraEm" | "acessoRevogadoEm">;

export function temAcessoVigente(p: CamposAcesso, agora: number = Date.now()): boolean {
  if (!p.acessoExpiraEm) return false;
  if (p.acessoRevogadoEm) return false;
  return new Date(p.acessoExpiraEm).getTime() > agora;
}

export function pedidoPendenteLocal(
  p: Pick<LocalProntuario, "acessoSolicitadoEm" | "acessoExpiraEm" | "acessoRevogadoEm">,
): boolean {
  return !!p.acessoSolicitadoEm && !temAcessoVigente(p);
}

export function podeEnviarNaFila(
  p: Pick<LocalProntuario, "status" | "acessoExpiraEm" | "acessoRevogadoEm">,
): boolean {
  if (p.status !== "enviado" && p.status !== "assinado") return true;
  return temAcessoVigente(p);
}

export async function liberacaoOfflineVigente(
  prontuarioId: string,
  agora: number = Date.now(),
): Promise<LocalLiberacaoOffline | undefined> {
  const [liberacoes, pront] = await Promise.all([
    db.liberacoesOffline.where("prontuarioId").equals(prontuarioId).toArray(),
    db.prontuarios.get(prontuarioId),
  ]);
  const revogadoEm = pront?.acessoRevogadoEm ? new Date(pront.acessoRevogadoEm).getTime() : null;
  return liberacoes
    .filter((l) => l.expiresAt > agora && (revogadoEm === null || l.liberadoEm > revogadoEm))
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
}

export async function aplicarLiberacaoOffline(prontuarioId: string): Promise<void> {
  const liberacao = await liberacaoOfflineVigente(prontuarioId);
  if (!liberacao) return;
  const pront = await db.prontuarios.get(prontuarioId);
  if (!pront || temAcessoVigente(pront)) return;
  await db.prontuarios.update(prontuarioId, {
    acessoExpiraEm: new Date(liberacao.expiresAt).toISOString(),
    acessoRevogadoEm: undefined,
    acessoRecusadoEm: undefined,
  });
}

const CHAVE_ENVELOPE = "_enc";
const TABELAS_CIFRADAS: ReadonlySet<string> = new Set([
  "prontuarios",
  "syncQueue",
  "planosProfessor",
  "autorizacoesOffline",
]);
const TABELAS_COM_LEGADO = ["prontuarios", "syncQueue", "planosProfessor"] as const;
const LEGADO = Symbol("linha-legada-em-claro");

type Linha = Record<string, any>;

function camposEmClaro(tabela: DBCoreTable): Set<string> {
  const campos = new Set<string>();
  const incluir = (keyPath: string | string[] | null | undefined) => {
    if (keyPath == null) return;
    for (const caminho of Array.isArray(keyPath) ? keyPath : [keyPath]) campos.add(caminho.split(".")[0]!);
  };
  incluir(tabela.schema.primaryKey.keyPath);
  for (const indice of tabela.schema.indexes) incluir(indice.keyPath);
  return campos;
}

async function cifrarLinha(key: CryptoKey, linha: Linha, emClaro: Set<string>): Promise<Linha> {
  if (linha === null || typeof linha !== "object") return linha;
  const visivel: Linha = {};
  const secreto: Linha = {};
  for (const [campo, valor] of Object.entries(linha)) {
    if (campo === CHAVE_ENVELOPE) continue;
    if (emClaro.has(campo)) visivel[campo] = valor;
    else if (valor !== undefined) secreto[campo] = valor;
  }
  visivel[CHAVE_ENVELOPE] = await encryptField(key, JSON.stringify(secreto));
  return visivel;
}

async function lerLinha(key: CryptoKey, linha: Linha | undefined, tabela: DBCoreTable): Promise<Linha | undefined> {
  if (linha === null || linha === undefined || typeof linha !== "object") return linha;
  const envelope = linha[CHAVE_ENVELOPE] as EncryptedField | undefined;
  if (!envelope) {
    const copia: Linha = { ...linha };
    Object.defineProperty(copia, LEGADO, { value: true, enumerable: false });
    return copia;
  }
  try {
    const secreto = JSON.parse(await decryptField(key, envelope)) as Linha;
    const { [CHAVE_ENVELOPE]: _descartado, ...visivel } = linha;
    return { ...visivel, ...secreto };
  } catch {
    const pk = tabela.schema.primaryKey.extractKey?.(linha);
    console.warn("[dexie] linha cifrada ilegível com a chave atual; oculta (não apagada)", {
      tabela: tabela.name,
      chave: pk,
    });
    return undefined;
  }
}

const esperar = <T>(promessa: Promise<T>): Promise<T> => Dexie.waitFor(promessa) as unknown as Promise<T>;
const bloqueado = () => Dexie.Promise.reject(new LockedError()) as any;

function envolverCursor(interno: DBCoreCursor, key: CryptoKey, tabela: DBCoreTable): DBCoreCursor {
  const externo = Object.create(interno) as DBCoreCursor;
  let valor: Linha | undefined;
  Object.defineProperty(externo, "value", { get: () => valor, configurable: true });
  (externo as any).start = (onNext: () => void) =>
    interno.start(() => {
      esperar(lerLinha(key, interno.value, tabela)).then(
        (linha) => {
          if (linha === undefined) {
            interno.continue();
            return;
          }
          valor = linha;
          try {
            onNext();
          } catch (err) {
            interno.fail(err as Error);
          }
        },
        (err) => interno.fail(err),
      );
    });
  return externo;
}

function criarDbCoreCifrado(down: DBCore): DBCore {
  return {
    ...down,
    table(nome: string): DBCoreTable {
      const t = down.table(nome);
      if (!TABELAS_CIFRADAS.has(nome)) return t;
      const emClaro = camposEmClaro(t);

      return {
        ...t,
        get: (req) => {
          const key = keyring.get();
          if (!key) return bloqueado();
          return t.get(req).then((linha) => esperar(lerLinha(key, linha, t)));
        },
        getMany: (req) => {
          const key = keyring.get();
          if (!key) return bloqueado();
          return t.getMany(req).then((linhas) => esperar(Promise.all(linhas.map((l) => lerLinha(key, l, t)))));
        },
        query: (req) => {
          if (!req.values) return t.query(req);
          const key = keyring.get();
          if (!key) return bloqueado();
          return t.query(req).then((res) =>
            esperar(Promise.all(res.result.map((l: Linha) => lerLinha(key, l, t)))).then((linhas) => ({
              ...res,
              result: linhas.filter((l) => l !== undefined),
            })),
          );
        },
        openCursor: (req) => {
          if (!req.values) return t.openCursor(req);
          const key = keyring.get();
          if (!key) return bloqueado();
          return t.openCursor(req).then((cursor) => (cursor ? envolverCursor(cursor, key, t) : cursor));
        },
        mutate: (req) => {
          if (req.type !== "add" && req.type !== "put") return t.mutate(req);
          const key = keyring.get();
          if (!key) return bloqueado();
          return esperar(Promise.all(req.values.map((v: Linha) => cifrarLinha(key, v, emClaro)))).then((values) =>
            t.mutate({ ...req, values }),
          );
        },
      };
    },
  };
}

export interface ResultadoMigracaoLegado {
  cifradas: number;
  movidas: number;
}

export async function migrarLegado(): Promise<ResultadoMigracaoLegado> {
  if (!keyring.get()) throw new LockedError();
  const resultado: ResultadoMigracaoLegado = { cifradas: 0, movidas: 0 };

  for (const nome of TABELAS_COM_LEGADO) {
    const tabela = db.table(nome);
    const legada = db.table(`${nome}_legacy`);
    const pk = tabela.schema.primKey.keyPath as string;

    await db.transaction("rw", tabela, legada, async () => {
      const linhas = (await tabela.toArray()) as Linha[];
      for (const linha of linhas) {
        if (!(linha as any)[LEGADO]) continue;
        const copia: Linha = { ...linha };
        try {
          await tabela.put(copia);
          resultado.cifradas++;
        } catch (err) {
          console.error("[dexie] falha ao cifrar linha legada; movendo para tabela _legacy", {
            tabela: nome,
            chave: copia[pk],
            erro: err instanceof Error ? err.name : "desconhecido",
          });
          await legada.put(copia);
          await tabela.delete(copia[pk]);
          resultado.movidas++;
        }
      }
    });
  }
  return resultado;
}
