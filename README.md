# Prontuário Digital — UEPB

Sistema de prontuário digital para a **Clínica de Prevenção em Saúde Bucal** do Departamento de Odontologia da Universidade Estadual da Paraíba. Digitaliza a ficha clínica em papel, com funcionamento offline-first, permitindo que alunos registrem atendimentos e professores revisem e assinem.

> O perfil de professor existe no código, mas o cadastro está desativado nesta versão (flag `MOSTRAR_PROFESSOR` em `apps/frontend/src/routes/Cadastro.tsx`).

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Como rodar](#como-rodar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [API](#api)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Recuperação de senha](#recuperação-de-senha)
- [Testar o modo offline](#testar-o-modo-offline)
- [Notas de desenvolvimento](#notas-de-desenvolvimento)

## Visão geral

O sistema é uma **PWA offline-first**. A ficha pode ser preenchida sem conexão — os dados são gravados localmente no dispositivo (IndexedDB) e enfileirados para sincronização. Assim que a internet volta, a fila é enviada automaticamente para o servidor.

É composto por três partes:

| Parte | Papel |
|---|---|
| **Frontend** | Interface do aluno e do professor, PWA instalável, banco local e fila de sincronização |
| **Backend** | API REST, autenticação, persistência, validação |
| **Shared** | Schemas Zod e tipos TypeScript compartilhados entre front e back |

## Stack

**Frontend**
- React 18 + TypeScript + Vite
- React Router DOM
- React Hook Form + Zod
- Dexie (IndexedDB)
- Tailwind CSS
- `vite-plugin-pwa` (Workbox)
- lucide-react

**Backend**
- Node.js 22.13+ (usa `node:sqlite` e `process.loadEnvFile`)
- Fastify
- SQL nativo do Node (sem ORM)
- `scrypt` (`node:crypto`) para hash de senha
- JWT (`@fastify/jwt`)
- Zod para validação
- Brevo (API HTTP, via `fetch`) para o e-mail de recuperação de senha

**Monorepo**
- pnpm workspaces

## Requisitos

- **Node.js 22.13 ou superior** — o backend usa `node:sqlite` e `process.loadEnvFile`, ambos nativos.
- **pnpm 9+**

Não há dependências nativas, Prisma, Docker ou banco externo. O banco é um arquivo SQLite no disco.

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp apps/backend/.env.example apps/backend/.env
# edite o arquivo e defina:
#   JWT_SECRET           (16+ caracteres)
#   RESET_TOKEN_SECRET   (32+ caracteres)
# gere valores seguros com: openssl rand -hex 32

# 3. Criar o banco 
pnpm db:migrate

# 4. Subir tudo
pnpm dev
```

O frontend sobe em `http://localhost:5173` e o backend em `http://localhost:3333`.

## Estrutura do projeto

```
.
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── db.ts            # schema SQL (CREATE TABLE IF NOT EXISTS) e abertura do banco
│   │       ├── env.ts           # leitura e validação das variáveis de ambiente
│   │       ├── server.ts        # inicialização do Fastify
│   │       ├── lib/             # senha.ts (scrypt) e mail.ts (envio de e-mail)
│   │       ├── plugins/         # db e auth (JWT)
│   │       └── routes/          # auth, recuperacao, users, sync, health
│   └── frontend/
│       └── src/
│           ├── routes/          # Login, Cadastro, RecuperarSenha, RedefinirSenha,
│           │                    # ListaProntuarios, Prontuario, Perfil
│           ├── components/      # Topbar, StatusBar, SessaoAviso, BottomSheet, ...
│           ├── sync/            # fila de sincronização offline
│           ├── db/              # Dexie (IndexedDB)
│           └── lib/             # api.ts e session.ts
└── packages/
    └── shared/                  # schemas Zod e tipos compartilhados
```

## Funcionalidades

- **Autenticação por e-mail**: cadastro e login usam somente e-mail e senha.
- **Sessão de 5 horas**: faltando 10 minutos, um aviso com contagem regressiva aparece no topo (e volta aos 2 minutos, mesmo se dispensado). Ao terminar, o app volta ao login.
- **Recuperação de senha** por link enviado ao e-mail (expira em 30 minutos, uso único).
- **Prontuário em seções**: consentimento, dados pessoais, história médica, história odontológica, exames, sangramento, IHOS, CPO-D / ceo-d, plano preventivo, procedimentos e conclusão. Seções ainda sem todos os campos necessários.
- **Offline-first**: edições ficam no dispositivo e são sincronizadas depois, com barra de status mostrando a fila.
- **Perfil do usuário**: alterar nome, e-mail e senha, e desativar a conta (soft delete, o histórico de prontuários é preservado).

## API

Rotas protegidas exigem `Authorization: Bearer <accessToken>`.

| Método | Rota | Função |
|---|---|---|
| GET | `/health` | verificação de status |
| POST | `/auth/signup` | cria conta |
| POST | `/auth/login` | entra com e-mail e senha |
| POST | `/auth/forgot-password` | `{ email }` — pede o link de redefinição; sempre responde `ok: true` (máx. 3 pedidos por hora por e-mail) |
| GET | `/auth/verify-reset-token?token=` | `{ valido: boolean }` |
| POST | `/auth/reset-password` | `{ token, novaSenha }` — redefine a senha |
| POST | `/sync` | recebe a fila de operações do cliente |
| GET | `/users/me` | dados do usuário logado (sem `senhaHash`) |
| PUT | `/users/me` | altera `nome` e/ou `email` |
| PUT | `/users/me/password` | troca a senha (`senhaAtual`, `novaSenha`) |
| PUT | `/users/me/matricula` | altera a matrícula (só professor) |
| DELETE | `/users/me` | desativa a conta (`ativo = 0`) |

## Variáveis de ambiente

Arquivo `apps/backend/.env` (modelo em `.env.example`).

| Variável | Obrigatória | Descrição |
|---|---|---|
| `JWT_SECRET` | sim | segredo do JWT (16+ caracteres) |
| `RESET_TOKEN_SECRET` | sim | chave do HMAC que protege o hash dos tokens de redefinição (32+ caracteres) |
| `DATABASE_URL` | não | arquivo SQLite (padrão `file:./dev.db`) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | não | duração da sessão (padrão `5h`) |
| `PORT` | não | porta do backend (padrão `3333`) |
| `CORS_ORIGIN` | não | origens permitidas, separadas por vírgula |
| `APP_URL` | não | base do link enviado por e-mail (padrão `http://localhost:5173`) |
| `BREVO_API_KEY` | não | chave de API do Brevo (`xkeysib-…`); sem ela, o link é apenas impresso no console do backend |
| `MAIL_FROM_EMAIL` | não | e-mail remetente, verificado no Brevo |
| `MAIL_FROM_NAME` | não | nome do remetente |