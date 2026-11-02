import type { SecaoId } from "@prontuario/shared";
import { formatarDataBR } from "../../../lib/data";

const pad = (n: number) => String(n).padStart(2, "0");

export function lerSecao<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false }; parse: (v: unknown) => T },
  bruto: unknown,
): T {
  const r = schema.safeParse(bruto ?? {});
  return r.success ? r.data : schema.parse({});
}

export function rotuloDe(valor: string | null | undefined, opcoes: ReadonlyArray<{ value: string; label: string }>): string {
  if (!valor) return "";
  return opcoes.find((o) => o.value === valor)?.label ?? valor;
}

export function rotulosDe(
  valores: ReadonlyArray<string>,
  opcoes: ReadonlyArray<{ value: string; label: string }>,
): string[] {
  return valores.map((v) => rotuloDe(v, opcoes));
}

export function dataOuVazio(iso: string | null | undefined): string {
  return formatarDataBR(iso) || "";
}

export function formatarDataHoraCompleta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function capitalizar(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type { SecaoId };
