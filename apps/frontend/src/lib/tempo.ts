const pad = (n: number) => String(n).padStart(2, "0");

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "agora", "há 12 min", "há 2h", "ontem", "há 3 dias" ou "em 15/09" (a partir de 7 dias). */
export function tempoRelativo(ts: number, agora: number = Date.now()): string {
  const minutos = Math.floor((agora - ts) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;

  const data = new Date(ts);
  const dias = Math.round((inicioDoDia(new Date(agora)) - inicioDoDia(data)) / 86_400_000);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return `em ${pad(data.getDate())}/${pad(data.getMonth() + 1)}`;
}

/** Idade em anos completos a partir de uma data ISO (AAAA-MM-DD); null se ausente ou inválida. */
export function calcularIdade(dataNascimento?: string, agora: Date = new Date()): number | null {
  if (!dataNascimento) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataNascimento);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let idade = agora.getFullYear() - ano;
  if (agora.getMonth() + 1 < mes || (agora.getMonth() + 1 === mes && agora.getDate() < dia)) idade -= 1;
  return idade >= 0 && idade < 150 ? idade : null;
}
