function normalize(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    const maybe = value as { toJSON?: () => unknown };
    if (typeof maybe.toJSON === "function") return normalize(maybe.toJSON());
    if (Array.isArray(value)) return value.map((v) => normalize(v));
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      if (src[k] === undefined) continue;
      out[k] = normalize(src[k]);
    }
    return out;
  }
  return value;
}

export function canonicalize(payload: unknown): string {
  const result = JSON.stringify(normalize(payload));
  if (result === undefined) throw new Error("Payload não serializável.");
  return result;
}
