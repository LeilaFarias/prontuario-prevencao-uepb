import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
}

const booleano = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL deve ser uma URL postgresql://"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_SSL: booleano,
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter 16+ caracteres"),
  JWT_ACCESS_TTL: z.string().default("5h"),
  JWT_REFRESH_TTL: z.string().default("5h"), 
  PORT: z.coerce.number().default(3333),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  
  BREVO_API_KEY: z.string().optional(),
  MAIL_FROM_EMAIL: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().default("Prontuário Digital"),
  RESET_TOKEN_SECRET: z.string().min(32, "RESET_TOKEN_SECRET precisa ter 32+ caracteres"),
  BACKUP_KEY: z.string().min(32, "BACKUP_KEY deve ter 32+ caracteres"),
  APP_URL: z.string().default("http://localhost:5173"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
