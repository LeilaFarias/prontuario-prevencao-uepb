# Prontuário Digital — UEPB (Sprint 1)

PWA offline-first para a Clínica de Prevenção em Saúde Bucal da UEPB.
Monorepo pnpm: `apps/frontend` (React + Vite + Dexie), `apps/backend` (Fastify + SQLite nativo do Node), `packages/shared` (schemas Zod).

**Requer Node 22.13 ou superior** (usa `node:sqlite` e `process.loadEnvFile`, sem Prisma nem módulos nativos).

## Como rodar

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env   # ajuste JWT_SECRET (16+ caracteres)
pnpm db:migrate                                   # cria o arquivo SQLite e as tabelas (o servidor também faz isso ao iniciar)
pnpm dev                                          # front em :5173, back em :3333
```

Opcional: `apps/frontend/.env` com `VITE_API_URL="http://localhost:3333"`.

## Testar o offline

1. Crie uma conta, entre e crie um prontuário.
2. DevTools → Network → Offline: a barra mostra "Offline — N alterações na fila"; continue digitando.
3. Volte online: "Sincronizando (N)…" e a barra some quando a fila zera. O backend loga cada operação.

## Observações

- O schema fica em `apps/backend/src/db.ts` (SQL com `CREATE TABLE IF NOT EXISTS`, mesmos nomes de tabelas e campos do modelo original). Não há ORM nem migrations.
- Senhas usam `scrypt` (`node:crypto`) com salt aleatório e comparação em tempo constante.
- O Node imprime um aviso `ExperimentalWarning` do SQLite: é esperado.

- A fila (`syncQueue`) é enviada a cada 30 s, no evento `online` e logo após cada salvamento.
- `LocalProntuario` ganhou o campo opcional `alunoTitularId`: o servidor exige o dono (FK) ao criar o prontuário e a lista filtra por usuário.
- A sessão expira com o refresh token (5 h, RN-14).
- Produção: `pnpm --filter @prontuario/frontend build` (gera o service worker).
