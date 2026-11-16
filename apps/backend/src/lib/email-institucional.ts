const SUFIXOS = {
  aluno: "@aluno.uepb.edu.br",
  professor: "@servidor.uepb.edu.br",
} as const;

export function emailPermitidoParaSignup(email: string, perfil: "aluno" | "professor"): boolean {
  return email.toLowerCase().endsWith(SUFIXOS[perfil]);
}
