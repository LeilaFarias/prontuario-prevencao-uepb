# Prontuário Digital — UEPB

Sistema de prontuário digital para a **Clínica de Prevenção em Saúde Bucal** 
do Departamento de Odontologia da Universidade Estadual da Paraíba. 
Digitaliza a ficha clínica em papel, com funcionamento offline-first, 
permitindo que alunos registrem atendimentos e professores revisem e assinem.

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Como rodar](#como-rodar)
- [Deploy](#deploy)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [A ficha do prontuário](#a-ficha-do-prontuário)
- [API](#api)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Recuperação de senha](#recuperação-de-senha)
- [Sincronização offline](#sincronização-offline)
- [Testar o modo offline](#testar-o-modo-offline)
- [O que ainda não está implementado](#o-que-ainda-não-está-implementado)
- [Notas de desenvolvimento](#notas-de-desenvolvimento)

## Visão geral

O sistema é uma **PWA offline-first**. A ficha pode ser preenchida sem 
conexão — os dados são gravados localmente no dispositivo (IndexedDB) e 
enfileirados para sincronização. Assim que a internet volta, a fila é 
enviada automaticamente para o servidor.

A sincronização é **bidirecional**: o aparelho envia alterações locais ao 
servidor e busca os dados mais recentes ao abrir o app, garantindo que 
prontuários criados em um dispositivo apareçam em outro.

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

- **Node.js 22.13 ou superior** — o backend usa `node:sqlite` e 
  `process.loadEnvFile`, ambos nativos.
- **pnpm 9+**

Não há dependências nativas, Prisma, Docker ou banco externo. O banco é 
um arquivo SQLite no disco.

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp apps/backend/.env.example apps/backend/.env
# edite o arquivo e defina:
#   JWT_SECRET           (16+ caracteres)
#   RESET_TOKEN_SECRET   (32+ caracteres)

# 3. Criar o banco
pnpm db:migrate

# 4. Subir tudo
pnpm dev