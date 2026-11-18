const ITERACOES_PBKDF2 = 600_000;
const IV_BYTES = 12;

export const PREFIXO_META_PIN = "prontuario:pinCriptografia:";

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

let chaveAtual: CryptoKey | null = null;

export function getChave(): CryptoKey | null {
  return chaveAtual;
}

export function setChave(k: CryptoKey | null): void {
  chaveAtual = k;
}

function hexParaBytes(hex: string) {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("Salt inválido");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function base64ParaBytes(b64: string) {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function derivarChave(pin: string, saltHex: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", codificador.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: hexParaBytes(saltHex), iterations: ITERACOES_PBKDF2 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function cifrar(chave: CryptoKey, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, codificador.encode(texto)));
  const saida = new Uint8Array(IV_BYTES + cifrado.length);
  saida.set(iv, 0);
  saida.set(cifrado, IV_BYTES);
  return bytesParaBase64(saida);
}

export async function decifrar(chave: CryptoKey, b64: string): Promise<string> {
  const bytes = base64ParaBytes(b64);
  if (bytes.length <= IV_BYTES) throw new Error("Conteúdo cifrado inválido");
  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
    chave,
    bytes.slice(IV_BYTES),
  );
  return decodificador.decode(claro);
}

const PREFIXO_CAMPO_CIFRADO = "enc:";

export interface CamposPaciente {
  pacienteNome: string;
  pacienteDataNascimento?: string;
}

export function campoPacienteCifrado(valor: string | undefined): boolean {
  return valor?.startsWith(PREFIXO_CAMPO_CIFRADO) ?? false;
}

export function pacientePrecisaCifrar(p: CamposPaciente): boolean {
  return (
    (Boolean(p.pacienteNome) && !campoPacienteCifrado(p.pacienteNome)) ||
    (Boolean(p.pacienteDataNascimento) && !campoPacienteCifrado(p.pacienteDataNascimento))
  );
}

async function cifrarCampo(chave: CryptoKey, valor: string): Promise<string> {
  if (!valor || campoPacienteCifrado(valor)) return valor;
  return PREFIXO_CAMPO_CIFRADO + (await cifrar(chave, valor));
}

async function decifrarCampo(chave: CryptoKey, valor: string): Promise<string> {
  return valor && campoPacienteCifrado(valor) ? decifrar(chave, valor.slice(PREFIXO_CAMPO_CIFRADO.length)) : valor;
}

export async function cifrarCamposPaciente<T extends CamposPaciente>(chave: CryptoKey, prontuario: T): Promise<T> {
  const nascimento = prontuario.pacienteDataNascimento;
  const [pacienteNome, pacienteDataNascimento] = await Promise.all([
    cifrarCampo(chave, prontuario.pacienteNome),
    nascimento ? cifrarCampo(chave, nascimento) : Promise.resolve(nascimento),
  ]);
  return { ...prontuario, pacienteNome, pacienteDataNascimento };
}

export async function decifrarCamposPaciente<T extends CamposPaciente>(chave: CryptoKey, prontuario: T): Promise<T> {
  const nascimento = prontuario.pacienteDataNascimento;
  const [pacienteNome, pacienteDataNascimento] = await Promise.all([
    decifrarCampo(chave, prontuario.pacienteNome),
    nascimento ? decifrarCampo(chave, nascimento) : Promise.resolve(nascimento),
  ]);
  return { ...prontuario, pacienteNome, pacienteDataNascimento };
}

export function ocultarCamposPaciente<T extends CamposPaciente>(prontuario: T): T {
  return {
    ...prontuario,
    pacienteNome: campoPacienteCifrado(prontuario.pacienteNome) ? "" : prontuario.pacienteNome,
    pacienteDataNascimento: campoPacienteCifrado(prontuario.pacienteDataNascimento) ? undefined : prontuario.pacienteDataNascimento,
  };
}