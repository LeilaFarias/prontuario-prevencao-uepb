import type { UsuarioMe } from "@prontuario/shared";
import { db, limparDexieLocal, recifrarDadosLocais } from "../db/dexie";
import { sincronizarParaBaixo } from "../sync/down";
import { api } from "./api";
import {
  PREFIXO_META_PIN,
  cifrar,
  cifrarCamposPaciente,
  decifrar,
  derivarChave,
  getChave,
  pacientePrecisaCifrar,
  setChave,
} from "./chaveLocal";
import { getSession } from "./session";

export interface MetaPin {
  tem: boolean;
  salt: string | null;
  canario: string | null;
}

const CANARIO = "prontuario-pin-ok";
const MARCADOR_MIGRACAO_NOMES = "migracaoNomesCifrados";
const VERSAO_MIGRACAO_NOMES = "v1";

const chaveMeta = (userId: string) => `${PREFIXO_META_PIN}${userId}`;

export function lerMetaPin(userId: string): MetaPin | null {
  try {
    const bruto = localStorage.getItem(chaveMeta(userId));
    return bruto ? (JSON.parse(bruto) as MetaPin) : null;
  } catch {
    return null;
  }
}

function gravarMeta(userId: string, meta: MetaPin): void {
  try {
    localStorage.setItem(chaveMeta(userId), JSON.stringify(meta));
  } catch {
  }
}

function limparMetaPin(userId: string): void {
  try {
    localStorage.removeItem(chaveMeta(userId));
  } catch {
  }
}

export async function atualizarMetaPin(userId: string): Promise<MetaPin> {
  const u = await api.get<UsuarioMe>("/users/me");
  const anterior = lerMetaPin(userId);
  const meta: MetaPin = {
    tem: u.temPinCriptografia,
    salt: u.saltCriptografia,
    canario: u.temPinCriptografia && anterior?.salt === u.saltCriptografia ? anterior.canario : null,
  };
  gravarMeta(userId, meta);
  return meta;
}

async function obterMeta(userId: string): Promise<MetaPin> {
  if (navigator.onLine) {
    try {
      return await atualizarMetaPin(userId);
    } catch {
    }
  }
  const cache = lerMetaPin(userId);
  if (cache) return cache;
  throw new Error("Conecte-se à internet para desbloquear neste aparelho.");
}

async function validarChave(chave: CryptoKey, meta: MetaPin): Promise<boolean | null> {
  const comSecao = await db.prontuarios
    .filter((p) => Object.values(p.secoes).some((v) => typeof v === "string"))
    .first();
  const cifrado =
    (comSecao && Object.values(comSecao.secoes).find((v): v is string => typeof v === "string")) ?? meta.canario;
  if (!cifrado) return null;
  try {
    await decifrar(chave, cifrado);
    return true;
  } catch {
    return false;
  }
}

export async function desbloquear(userId: string, pin: string): Promise<boolean> {
  const meta = await obterMeta(userId);
  if (!meta.tem || !meta.salt) throw new Error("PIN de criptografia não definido.");
  const chave = await derivarChave(pin, meta.salt);
  const referencia = await validarChave(chave, meta);
  if (referencia === false) return false;
  if (referencia === null) {
    if (!navigator.onLine) throw new Error("Conecte-se à internet para o primeiro desbloqueio neste aparelho.");
    const { valido } = await api.post<{ valido: boolean }>("/users/me/pin-criptografia/verificar", { pin });
    if (!valido) return false;
  }
  if (!meta.canario) gravarMeta(userId, { ...meta, canario: await cifrar(chave, CANARIO) });
  setChave(chave);
  return true;
}

function migracaoNomesConcluida(): boolean {
  try {
    return sessionStorage.getItem(MARCADOR_MIGRACAO_NOMES) === VERSAO_MIGRACAO_NOMES;
  } catch {
    return false;
  }
}

function marcarMigracaoNomes(): void {
  try {
    sessionStorage.setItem(MARCADOR_MIGRACAO_NOMES, VERSAO_MIGRACAO_NOMES);
  } catch {
  }
}

export async function migrarNomesCifrados(): Promise<void> {
  const userId = getSession()?.user.id;
  const chave = getChave();
  if (!userId || !chave || !lerMetaPin(userId)?.tem || migracaoNomesConcluida()) return;

  const legados = await db.prontuarios.filter(pacientePrecisaCifrar).toArray();
  for (const p of legados) {
    const { pacienteNome, pacienteDataNascimento } = await cifrarCamposPaciente(chave, p);
    await db.transaction("rw", db.prontuarios, async () => {
      const atual = await db.prontuarios.get(p.id);
      if (!atual || atual.pacienteNome !== p.pacienteNome || atual.pacienteDataNascimento !== p.pacienteDataNascimento) {
        return;
      }
      await db.prontuarios.update(p.id, { pacienteNome, pacienteDataNascimento });
    });
  }

  const opsLegadas = await db.syncQueue
    .filter(
      (o) =>
        o.entity === "prontuario" &&
        o.payloadCifrado === undefined &&
        pacientePrecisaCifrar({
          pacienteNome: String(o.payload?.pacienteNome ?? ""),
          pacienteDataNascimento: o.payload?.pacienteDataNascimento as string | undefined,
        }),
    )
    .toArray();
  for (const op of opsLegadas) {
    if (op.id === undefined) continue;
    const payloadCifrado = await cifrar(chave, JSON.stringify(op.payload));
    await db.transaction("rw", db.syncQueue, async () => {
      const atual = await db.syncQueue.get(op.id!);
      if (!atual || atual.payloadCifrado !== undefined) return;
      await db.syncQueue.update(op.id!, { payloadCifrado, payload: undefined });
    });
  }

  marcarMigracaoNomes();
}

export async function definirPin(userId: string, pin: string, opcoes: { limparLocal: boolean }): Promise<void> {
  await api.put<void>("/users/me/pin-criptografia", { pin });
  const meta = await atualizarMetaPin(userId);
  if (!meta.salt) throw new Error("Não foi possível definir o PIN. Tente novamente.");
  const chave = await derivarChave(pin, meta.salt);
  gravarMeta(userId, { ...meta, canario: await cifrar(chave, CANARIO) });
  if (opcoes.limparLocal) await limparDexieLocal();
  setChave(chave);
  if (opcoes.limparLocal) await sincronizarParaBaixo().catch(() => undefined);
  else await migrarNomesCifrados().catch(() => undefined);
}

export async function alterarPin(userId: string, pinAtual: string, pinNovo: string): Promise<void> {
  const chaveAtual = getChave();
  const salt = lerMetaPin(userId)?.salt;
  if (!chaveAtual || !salt) throw new Error("Desbloqueie o app primeiro.");

  const chaveInformada = await derivarChave(pinAtual, salt);
  const prova = await cifrar(chaveAtual, CANARIO);
  const confere = await decifrar(chaveInformada, prova).then(
    (t) => t === CANARIO,
    () => false,
  );
  if (!confere) throw new Error("PIN atual inválido");

  await api.put<void>("/users/me/pin-criptografia", { pin: pinNovo });
  const meta = await atualizarMetaPin(userId);
  if (!meta.salt) throw new Error("Não foi possível alterar o PIN. Tente novamente.");
  const chaveNova = await derivarChave(pinNovo, meta.salt);
  await recifrarDadosLocais(chaveAtual, chaveNova);
  gravarMeta(userId, { ...meta, canario: await cifrar(chaveNova, CANARIO) });
  setChave(chaveNova);
}

export async function esquecerPin(userId: string, senha: string): Promise<void> {
  await api.post<void>("/users/me/pin-criptografia/reset", { senha });
  await limparDexieLocal();
  setChave(null);
  limparMetaPin(userId);
  window.location.reload();
}
