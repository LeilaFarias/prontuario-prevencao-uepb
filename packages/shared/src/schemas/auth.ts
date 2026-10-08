import { z } from "zod";

export const perfilSchema = z.enum(["aluno", "professor"]);

const emailOuUsuario = z
  .string({ required_error: "Informe seu e-mail ou usuário" })
  .trim()
  .toLowerCase()
  .min(3, "Informe seu e-mail ou usuário");

export const signupSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe seu nome completo"),
    email: emailOuUsuario,
    senha: z.string().min(8, "A senha precisa ter no mínimo 8 caracteres"),
    perfil: perfilSchema,
    matricula: z.string().trim().optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.perfil === "professor" && !dados.matricula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matricula"],
        message: "Informe sua matrícula",
      });
    }
  });

export const loginSchema = z.object({
  email: emailOuUsuario,
  senha: z.string().min(1, "Informe sua senha"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  perfil: "aluno" | "professor";
  matricula: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}
