import { z } from "zod";

export const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(3, "O nome precisa ter no mínimo 3 caracteres").optional(),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido").optional(),
});

export const alterarSenhaBaseSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha precisa ter no mínimo 8 caracteres"),
});

export const alterarSenhaSchema = alterarSenhaBaseSchema.refine((d) => d.senhaAtual !== d.novaSenha, {
  message: "A nova senha deve ser diferente da atual",
  path: ["novaSenha"],
});

export const alterarMatriculaSchema = z.object({
  matricula: z.string().trim().min(6, "A matrícula precisa ter no mínimo 6 caracteres"),
});

export const excluirContaSchema = z.object({
  senha: z.string().min(1, "Informe sua senha"),
});

export type AtualizarPerfilInput = z.infer<typeof atualizarPerfilSchema>;
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
export type AlterarMatriculaInput = z.infer<typeof alterarMatriculaSchema>;
export type ExcluirContaInput = z.infer<typeof excluirContaSchema>;

export interface UsuarioMe {
  id: string;
  nome: string;
  email: string;
  perfil: "aluno" | "professor";
  matricula: string | null;
  criadoEm: string;
}
