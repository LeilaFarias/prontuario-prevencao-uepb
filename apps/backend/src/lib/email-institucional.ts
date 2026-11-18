const SUFIXO_ALUNO = "@aluno.uepb.edu.br";
const SUFIXO_PROFESSOR = "@servidor.uepb.edu.br";

export function emailPermitidoParaSignup(
  email: string,
  perfil: "aluno" | "professor",
  emailsConvidados: string[] = [],
): boolean {
  const normalizado = email.trim().toLowerCase();
  if (perfil === "aluno") return normalizado.endsWith(SUFIXO_ALUNO);
  return normalizado.endsWith(SUFIXO_PROFESSOR) || emailsConvidados.includes(normalizado);
}

export function emailTemBypassConfirmacao(email: string, emailsConvidados: string[]): boolean {
  return emailsConvidados.includes(email.trim().toLowerCase());
}
