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
- [Política de Retenção de Dados](#política-de-retenção-de-dados)
- [Backup e Restauração](#backup-e-restauração)
- [Conformidade com a LGPD](#conformidade-com-a-lgpd)

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
- Node.js 22.13+ (usa `process.loadEnvFile`)
- Fastify
- PostgreSQL (Supabase) com `pg` e SQL puro (sem ORM)
- `scrypt` (`node:crypto`) para hash de senha
- JWT (`@fastify/jwt`)
- Zod para validação
- Brevo (API HTTP, via `fetch`) para o e-mail de recuperação de senha

**Monorepo**
- pnpm workspaces

## Requisitos

- **Node.js 22.13 ou superior** — o backend usa `process.loadEnvFile`, nativo.
- **pnpm 9+**
- **Um banco PostgreSQL** — projeto no Supabase (recomendado) ou Postgres local.

Não há dependências nativas, Prisma ou Docker.

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp apps/backend/.env.example apps/backend/.env
# edite o arquivo e defina:
#   DATABASE_URL         (pooler de sessão do Supabase, veja "Deploy")
#   JWT_SECRET           (16+ caracteres)
#   RESET_TOKEN_SECRET   (32+ caracteres)
#   BACKUP_KEY           (32+ caracteres)

# 3. Criar as tabelas
pnpm db:migrate

# 4. Subir tudo
pnpm dev
```

Para rodar cada parte separadamente (em dois terminais):

```bash
pnpm --filter @prontuario/backend dev
pnpm --filter @prontuario/frontend dev
```

O frontend sobe em `http://localhost:5173` e o proxy do Vite encaminha as rotas da API para `http://localhost:3333`. Em dev, mantenha `CORS_ORIGIN=http://localhost:5173` no `apps/backend/.env`.

## Deploy

O deploy é único, no **Railway**: o Fastify serve o frontend compilado (`apps/frontend/dist`) e a API na mesma origem.

- **Build** (na raiz): `pnpm build` compila o frontend (`tsc` + `vite build`, gerando `apps/frontend/dist`) e faz o typecheck do backend.
- **Start**: `pnpm --filter @prontuario/backend start`. O `railway.json` na raiz já define build e start.
- **Mesma origem**: deixe `CORS_ORIGIN` vazio em produção e não defina `VITE_API_URL`, a menos que o build precise apontar para outro host.
- **SPA fallback**: requisições `GET` com `Accept: text/html` e sem `Authorization` que não casem com uma rota da API recebem o `index.html`. Isso permite que rotas do SPA com o mesmo nome de rotas da API (`/prontuarios`, `/acessos`, `/encaminhamentos`) funcionem ao recarregar a página.

O banco é um PostgreSQL no **Supabase**. O backend se conecta pelo **pooler de sessão**:

1. No painel do Supabase, abra **Connect** e copie a string do **Session pooler** (porta `5432`).
2. Defina `DATABASE_URL` no formato `postgresql://postgres.<project-ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`.
3. Não use a conexão direta (`db.<project-ref>.supabase.co`, apenas IPv6) nem o modo transação (porta `6543`): o backend usa transações explícitas e `SAVEPOINT`, que dependem de uma sessão estável.
4. Codifique na URL caracteres especiais da senha (`@` vira `%40`) e não inclua `?sslmode=`: o SSL é controlado por `DATABASE_SSL` (padrão `true`; use `false` só em Postgres local sem SSL).
5. `DATABASE_POOL_MAX` (padrão 10) limita as conexões do backend. Mantenha-o abaixo do limite de conexões do pooler do seu plano, somando todas as instâncias.

As tabelas são criadas automaticamente na subida do servidor, e também por `pnpm db:migrate`. A migração é idempotente e ativa o Row Level Security em todas as tabelas, sem políticas, de modo que a API REST pública do Supabase (chaves `anon` e `authenticated`) não enxerga os dados. O backend se conecta como o dono do banco e não é afetado.

No Railway, o volume em `/data` deixou de ser necessário: o backend não grava mais nada em disco. Defina as variáveis de ambiente do serviço, incluindo `DATABASE_URL`, `JWT_SECRET`, `RESET_TOKEN_SECRET` e `BACKUP_KEY`.

## Política de Retenção de Dados

- Os prontuários são retidos por tempo indeterminado (RN-18).
- A exclusão de conta é *soft delete*: o usuário é marcado como inativo (`ativo = false`) e o motivo, quando informado, fica em `Usuario.motivoExclusao`. Os dados permanecem para fins de auditoria e histórico clínico, e a ação é registrada no `AuditLog` como `conta-desativada`.
- A exclusão definitiva de dados só pode ser solicitada formalmente e é decisão do professor responsável.
- Backups são criptografados e retidos pelo mesmo período do banco principal.
- Base legal: Art. 16 da LGPD (retenção para cumprimento de obrigação legal ou regulatória e para estudos por órgão de pesquisa).

## Backup e Restauração

O backup é uma exportação lógica de todas as tabelas (JSON gerado por consultas, em uma transação de leitura consistente), criptografada com **AES-256-GCM** (chave de 32 bytes derivada de `BACKUP_KEY` via scrypt). O formato do arquivo `.json.enc` é `[IV: 12 bytes][AUTH_TAG: 16 bytes][dados cifrados]`. Não depende do `pg_dump` nem de acesso direto ao servidor do banco.

### Configurar a chave

Gere a `BACKUP_KEY` e defina-a no `.env` (e nas variáveis do servidor de produção):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde a `BACKUP_KEY` em um cofre de senhas **separado do servidor**. Sem ela, nenhum backup pode ser restaurado. Trocar a chave torna os backups antigos ilegíveis.

### Fazer backup

Pelo endpoint administrativo, disponível apenas para professores:

```bash
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"professor@uepb.edu.br","senha":"SUA_SENHA"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

curl -f -H "Authorization: Bearer $TOKEN" \
  -o "backup-$(date +%Y-%m-%d-%H-%M-%S).json.enc" \
  "$API_URL/admin/backup"
```

Cada download é registrado no `AuditLog` como `backup-baixado`. Alunos recebem `403`.

O Supabase também mantém backups automáticos do banco conforme o plano contratado. Eles complementam, mas não substituem, o backup criptografado acima.

### Restaurar

Com o servidor parado:

```bash
pnpm --filter @prontuario/backend restore ./backup-2026-01-01-03-00-00.json.enc
```

O script:

1. Descriptografa o backup. Com `BACKUP_KEY` errada ou arquivo corrompido, falha com "Backup corrompido ou chave incorreta" e o banco não é alterado.
2. Garante que as tabelas existem e confirma que o backup contém ao menos 1 registro em `Usuario`.
3. Em uma única transação, esvazia todas as tabelas e reinsere os dados do backup. Qualquer falha desfaz a transação e mantém o banco atual intacto.
4. Exibe a contagem de registros de cada tabela.

A restauração **substitui todos os dados** do banco apontado por `DATABASE_URL`. Para testar um backup sem tocar nos dados reais (teste de restauração periódico), aponte `DATABASE_URL` para outro banco ou projeto Supabase:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @prontuario/backend restore ./backup.json.enc
```

### Frequência recomendada

- Backup manual antes de cada deploy em produção.
- Backup automático diário. O agendamento não faz parte do código; configure no servidor ou em um serviço externo (Railway Cron, GitHub Actions). Exemplo de crontab, rodando todo dia às 03:00 um script que executa os comandos de login e download acima:

```cron
0 3 * * * /usr/local/bin/backup-prontuario.sh >> /var/log/backup-prontuario.log 2>&1
```

O login tem limite de 5 tentativas a cada 15 minutos por IP, o que comporta uma rotina diária.

Faça periodicamente um teste de restauração, como descrito acima.

## Conformidade com a LGPD

**Dados tratados:** identificação, saúde e imagens. Dados de saúde são dados pessoais sensíveis (Art. 5º, II).

**Base legal:** consentimento (Termo de Consentimento) e obrigação legal (prontuário médico).

**Direitos do titular:** acesso, correção, exclusão (*soft delete*) e portabilidade.

**Medidas de segurança:**
- Criptografia em trânsito (HTTPS)
- Criptografia do backup (AES-256-GCM)
- Hash de senha (scrypt)
- JWT com invalidação após troca de senha
- Rate limiting
- Log de auditoria

**Responsável pelo tratamento:** coordenação da clínica.

**Contato para exercer direitos:** e-mail institucional da coordenação da clínica.
