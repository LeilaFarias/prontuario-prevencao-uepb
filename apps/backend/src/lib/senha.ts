import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

function derivar(senha: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(senha, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivar(senha, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, salt, key] = armazenado.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const esperado = Buffer.from(key, "base64");
  const obtido = await derivar(senha, Buffer.from(salt, "base64"));
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}
