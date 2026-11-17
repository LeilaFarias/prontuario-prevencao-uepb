const PBKDF2_ITERACOES = 600000;

const paraHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

function iguaisEmTempoConstante(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function verificarPinOffline(pin: string, saltClient: string, pinHashClient: string): Promise<boolean> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltClient), iterations: PBKDF2_ITERACOES, hash: "SHA-256" },
    chave,
    256,
  );
  return iguaisEmTempoConstante(paraHex(bits), pinHashClient);
}
