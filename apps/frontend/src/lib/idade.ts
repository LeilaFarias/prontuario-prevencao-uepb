import { calcularIdade } from "./tempo";

export function formatarIdade(dataNascimento: string, agora: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
  if (!m) return "";

  const anos = calcularIdade(dataNascimento, agora);
  if (anos === null) return "";
  if (anos >= 1) return anos === 1 ? "1 ano" : `${anos} anos`;

  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let meses = (agora.getFullYear() - ano) * 12 + (agora.getMonth() + 1 - mes);
  if (agora.getDate() < dia) meses -= 1;
  if (meses < 1) return "Menos de 1 mês";
  return meses === 1 ? "1 mês" : `${meses} meses`;
}
