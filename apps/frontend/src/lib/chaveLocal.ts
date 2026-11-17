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
