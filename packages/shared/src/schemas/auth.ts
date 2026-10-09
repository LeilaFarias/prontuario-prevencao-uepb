import { z } from "zod";

export const perfilSchema = z.enum(["aluno", "professor"]);

const emailSchema = z
  .string({ required_error: "Informe seu e-mail" })
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail")
  .email("Informe um e-mail válido");

export const signupSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe seu nome completo"),
    email: emailSchema,
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
  email: emailSchema,
  senha: z.string().min(1, "Informe sua senha"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  novaSenha: z.string().min(8, "A senha precisa ter no mínimo 8 caracteres"),
});

export const resetPasswordSchema = resetPasswordBodySchema
  .extend({
    confirmarSenha: z.string().min(8, "A senha precisa ter no mínimo 8 caracteres"),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: "As senhas não batem",
    path: ["confirmarSenha"],
  });

export const MENSAGEM_FORGOT_PASSWORD =
  "Se este e-mail estiver cadastrado, você receberá um link em alguns minutos.";

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
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
