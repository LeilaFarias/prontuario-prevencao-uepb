import { z } from "zod";

// Node 22+: carrega o .env sem dependência extra
try {
  process.loadEnvFile();
} catch {
  // sem .env: usa apenas as variáveis do ambiente
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter 16+ caracteres"),
  JWT_ACCESS_TTL: z.string().default("5h"),
  JWT_REFRESH_TTL: z.string().default("5h"), 
  PORT: z.coerce.number().default(3333),
  
  BREVO_API_KEY: z.string().optional(), // sem chave: o link é só logado no console
  MAIL_FROM_EMAIL: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().default("Prontuário Digital"),
  RESET_TOKEN_SECRET: z.string().min(32, "RESET_TOKEN_SECRET precisa ter 32+ caracteres"),
  APP_URL: z.string().default("http://localhost:5173"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
