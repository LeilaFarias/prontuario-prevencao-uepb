import { pbkdf2, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const pbkdf2Async = promisify(pbkdf2);

export interface HashesPinCriptografia {
  pinCriptografiaHash: string;
  saltCriptografia: string;
}

export interface HashesPinLiberacao {
  pinHash: string;
  saltServer: string;
  pinHashClient: string;
  saltClient: string;
}

export async function gerarHashesPinCriptografia(pin: string): Promise<HashesPinCriptografia> {
  const saltCriptografia = randomBytes(16).toString("hex");
  const pinCriptografiaHash = ((await scryptAsync(pin, saltCriptografia, 64)) as Buffer).toString("hex");
  return { pinCriptografiaHash, saltCriptografia };
}

export async function gerarHashesPinLiberacao(pin: string): Promise<HashesPinLiberacao> {
  const saltServer = randomBytes(16).toString("hex");
  const saltClient = randomBytes(16).toString("hex");
  const pinHash = ((await scryptAsync(pin, saltServer, 64)) as Buffer).toString("hex");
  const pinHashClient = (await pbkdf2Async(pin, saltClient, 600000, 32, "sha256")).toString("hex");
  return { pinHash, saltServer, pinHashClient, saltClient };
}

export async function verificarPinCriptografia(pin: string, hash: string, salt: string): Promise<boolean> {
  const esperado = Buffer.from(hash, "hex");
  const calculado = (await scryptAsync(pin, salt, 64)) as Buffer;
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}
