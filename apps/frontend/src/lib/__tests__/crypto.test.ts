import { describe, expect, it } from "vitest";
import {
  DecryptError,
  LockedError,
  PBKDF2_ITERATIONS,
  decryptField,
  deriveKey,
  encryptField,
  fromBase64,
  randomBytes,
  toBase64,
} from "../crypto";

const segredo = new TextEncoder().encode("segredo-de-teste");

describe("crypto", () => {
  it("round-trip: decryptField devolve o texto cifrado por encryptField", async () => {
    const key = await deriveKey(segredo, randomBytes(16));
    const textoOriginal = "Paciente: José da Silva — sangramento gengival 🦷";
    const campo = await encryptField(key, textoOriginal);

    expect(campo.ct).not.toContain("José");
    expect(fromBase64(campo.iv).length).toBe(12);
    expect(await decryptField(key, campo)).toBe(textoOriginal);
  });

  it("usa um IV novo a cada cifragem do mesmo texto", async () => {
    const key = await deriveKey(segredo, randomBytes(16));
    const a = await encryptField(key, "igual");
    const b = await encryptField(key, "igual");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("decryptField falha com ct adulterado", async () => {
    const key = await deriveKey(segredo, randomBytes(16));
    const campo = await encryptField(key, "dado clínico");
    const bytes = fromBase64(campo.ct);
    bytes[0] = bytes[0]! ^ 0xff;

    await expect(decryptField(key, { iv: campo.iv, ct: toBase64(bytes) })).rejects.toBeInstanceOf(DecryptError);
  });

  it("decryptField falha com chave diferente", async () => {
    const campo = await encryptField(await deriveKey(segredo, randomBytes(16)), "dado clínico");
    const outraChave = await deriveKey(segredo, randomBytes(16));
    await expect(decryptField(outraChave, campo)).rejects.toBeInstanceOf(DecryptError);
  });

  it("deriveKey com o mesmo salt e segredo decifra o que cifrou", async () => {
    const salt = randomBytes(16);
    const campo = await encryptField(await deriveKey(segredo, salt), "mesma chave");
    const outraInstancia = await deriveKey(new TextEncoder().encode("segredo-de-teste"), new Uint8Array(salt));
    expect(await decryptField(outraInstancia, campo)).toBe("mesma chave");
  });

  it("deriveKey com salt diferente não decifra", async () => {
    const campo = await encryptField(await deriveKey(segredo, randomBytes(16)), "x");
    await expect(decryptField(await deriveKey(segredo, randomBytes(16)), campo)).rejects.toBeInstanceOf(DecryptError);
  });

  it("parâmetros: PBKDF2 com 210000 iterações; LockedError é exportado", () => {
    expect(PBKDF2_ITERATIONS).toBe(210_000);
    expect(new LockedError()).toBeInstanceOf(Error);
    expect(new LockedError().name).toBe("LockedError");
  });
});
