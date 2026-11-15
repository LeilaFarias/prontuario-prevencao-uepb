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
```

## Política de Retenção de Dados

- Os prontuários são retidos por tempo indeterminado (RN-18).
- A exclusão de conta é *soft delete*: o usuário é marcado como inativo (`ativo = 0`) e o motivo, quando informado, fica em `Usuario.motivoExclusao`. Os dados permanecem para fins de auditoria e histórico clínico, e a ação é registrada no `AuditLog` como `conta-desativada`.
- A exclusão definitiva de dados só pode ser solicitada formalmente e é decisão do professor responsável.
- Backups são criptografados e retidos pelo mesmo período do banco principal.
- Base legal: Art. 16 da LGPD (retenção para cumprimento de obrigação legal ou regulatória e para estudos por órgão de pesquisa).

## Backup e Restauração

O backup é do arquivo SQLite inteiro (`.db`), criptografado com **AES-256-GCM** (chave de 32 bytes derivada de `BACKUP_KEY` via scrypt). O formato do arquivo `.db.enc` é `[IV: 12 bytes][AUTH_TAG: 16 bytes][dados cifrados]`.

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
  -o "backup-$(date +%Y-%m-%d-%H-%M-%S).db.enc" \
  "$API_URL/admin/backup"
```

Cada download é registrado no `AuditLog` como `backup-baixado`. Alunos recebem `403`.

Também é possível copiar diretamente o arquivo `.db` do servidor (com o servidor parado, ou incluindo os arquivos `-wal` e `-shm`). Essa cópia **não é criptografada** e deve ser armazenada com o mesmo cuidado do banco.

### Restaurar

Com o servidor parado:

```bash
pnpm --filter @prontuario/backend restore ./backup-2026-01-01-03-00-00.db.enc
```

O script:

1. Guarda uma cópia do banco atual em `<banco>.bak-<timestamp>`.
2. Descriptografa o backup sobre o banco atual. Com `BACKUP_KEY` errada ou arquivo corrompido, falha com "Backup corrompido ou chave incorreta" e o banco atual não é alterado.
3. Confirma que a tabela `Usuario` existe e tem ao menos 1 registro. Se a verificação falhar, o banco anterior é restaurado automaticamente.
4. Exibe a contagem de registros de cada tabela.

Para testar um backup sem tocar no banco real (teste de restauração periódico), aponte para um banco temporário:

```bash
DATABASE_URL="file:./teste-restore.db" pnpm --filter @prontuario/backend restore ./backup.db.enc
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
