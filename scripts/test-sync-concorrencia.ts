import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const raiz = resolve(dirname(process.argv[1] ?? "."), "..");
for (const caminho of [resolve(process.cwd(), ".env"), resolve(raiz, ".env"), resolve(raiz, "apps/backend/.env")]) {
  try {
    process.loadEnvFile(caminho);
  } catch {}
}

const API_URL = (process.env.API_URL ?? "http://localhost:3333").replace(/\/$/, "");
const SENHA_ALUNOS = "TesteSync123!";
const TOTAL_ALUNOS = 10;
const VALIDAS_POR_ALUNO = 3;
const INVALIDAS_POR_ALUNO = 2;

interface Operacao {
  prontuarioId: string;
  op: "create" | "update" | "enviar";
  entity: "prontuario";
  entityId: string;
  payload: Record<string, unknown>;
  ts: number;
}

interface SyncResposta {
  aplicadas: number;
  descartadas: number;
  serverTime: number;
}

interface LoginResposta {
  accessToken: string;
  user: { id: string };
}

interface Aluno {
  indice: number;
  email: string;
  id: string;
  token: string;
  prontuarioId: string;
}

interface Resultado {
  aluno: Aluno;
  status: number;
  latenciaMs: number;
  aplicadas: number | null;
  descartadas: number | null;
  erro?: string;
}

function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} ausente. Defina-a no .env (veja apps/backend/.env.example).`);
  return valor;
}

async function chamar<T>(caminho: string, corpo: unknown, token?: string) {
  const inicio = performance.now();
  const res = await fetch(`${API_URL}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await res.text();
  const latenciaMs = performance.now() - inicio;
  let dados: unknown = texto;
  try {
    dados = JSON.parse(texto);
  } catch {}
  return { status: res.status, corpo: dados as T, latenciaMs };
}

async function login(email: string, senha: string): Promise<LoginResposta> {
  const r = await chamar<LoginResposta>("/auth/login", { email, senha });
  if (r.status !== 200) throw new Error(`Login falhou para ${email}: HTTP ${r.status} ${JSON.stringify(r.corpo)}`);
  return r.corpo;
}

async function obterAluno(indice: number, rodada: number): Promise<Omit<Aluno, "prontuarioId">> {
  const email = `teste-sync-${rodada}-${indice}@aluno.uepb.edu.br`;
  const r = await chamar<{ id: string }>("/auth/signup", {
    nome: `Aluno Teste Sync ${indice}`,
    email,
    senha: SENHA_ALUNOS,
    perfil: "aluno",
  });
  if (r.status === 201 || r.status === 200 || r.status === 409) {
    const l = await login(email, SENHA_ALUNOS);
    return { indice, email, id: l.user.id, token: l.accessToken };
  }
  throw new Error(`Signup falhou para ${email}: HTTP ${r.status} ${JSON.stringify(r.corpo)}`);
}

async function criarProntuario(aluno: Omit<Aluno, "prontuarioId">): Promise<Aluno> {
  const prontuarioId = randomUUID();
  const r = await chamar<SyncResposta>(
    "/sync",
    {
      operations: [
        {
          prontuarioId,
          op: "create",
          entity: "prontuario",
          entityId: prontuarioId,
          payload: { pacienteNome: `Paciente ${aluno.indice}`, alunoTitularId: aluno.id },
          ts: Date.now(),
        },
      ],
    },
    aluno.token,
  );
  if (r.status !== 200 || r.corpo.aplicadas !== 1 || r.corpo.descartadas !== 0) {
    throw new Error(`Criação do prontuário falhou para ${aluno.email}: HTTP ${r.status} ${JSON.stringify(r.corpo)}`);
  }
  return { ...aluno, prontuarioId };
}

function montarLote(aluno: Aluno, alvo: Aluno): Operacao[] {
  const base = Date.now();
  const validas: Operacao[] = Array.from({ length: VALIDAS_POR_ALUNO }, (_, n) => ({
    prontuarioId: aluno.prontuarioId,
    op: "update",
    entity: "prontuario",
    entityId: aluno.prontuarioId,
    payload: { pacienteNome: `Atualizado ${aluno.indice}-${n}` },
    ts: base + n,
  }));
  const invalidas: Operacao[] = [
    {
      prontuarioId: alvo.prontuarioId,
      op: "update",
      entity: "prontuario",
      entityId: alvo.prontuarioId,
      payload: { pacienteNome: `Invasor ${aluno.indice}` },
      ts: base + VALIDAS_POR_ALUNO,
    },
    {
      prontuarioId: alvo.prontuarioId,
      op: "enviar",
      entity: "prontuario",
      entityId: alvo.prontuarioId,
      payload: {},
      ts: base + VALIDAS_POR_ALUNO + 1,
    },
  ];
  return [...validas, ...invalidas].reverse();
}

function percentil(ordenado: number[], p: number): number {
  const posicao = Math.ceil((p / 100) * ordenado.length) - 1;
  return ordenado[Math.min(ordenado.length - 1, Math.max(0, posicao))] as number;
}

async function main(): Promise<void> {
  const emailProfessor = exigirEnv("TEST_PROFESSOR_EMAIL");
  const senhaProfessor = exigirEnv("TEST_PROFESSOR_SENHA");
  const limiteLogin = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5);
  if (!(limiteLogin >= 20)) {
    throw new Error(
      "Defina LOGIN_RATE_LIMIT_MAX >= 20 no apps/backend/.env antes de rodar (o teste precisa de 11 logins no primeiro run completo e de N logins em re-runs).",
    );
  }

  const professor = await login(emailProfessor, senhaProfessor);
  console.log(`Professor autenticado: ${emailProfessor} (${professor.user.id})`);

  const rodada = Date.now();
  const semProntuario = await Promise.all(
    Array.from({ length: TOTAL_ALUNOS }, (_, i) => obterAluno(i, rodada)),
  );
  const alunos = await Promise.all(semProntuario.map(criarProntuario));
  console.log(`${alunos.length} alunos e prontuários criados (rodada ${rodada})`);

  const lotes = alunos.map((aluno, i) => montarLote(aluno, alunos[(i + 1) % alunos.length] as Aluno));

  const inicioTotal = performance.now();
  const resultados: Resultado[] = await Promise.all(
    alunos.map(async (aluno, i): Promise<Resultado> => {
      try {
        const r = await chamar<SyncResposta>("/sync", { operations: lotes[i] }, aluno.token);
        const ok = r.status === 200;
        return {
          aluno,
          status: r.status,
          latenciaMs: r.latenciaMs,
          aplicadas: ok ? r.corpo.aplicadas : null,
          descartadas: ok ? r.corpo.descartadas : null,
          erro: ok ? undefined : JSON.stringify(r.corpo),
        };
      } catch (err) {
        return { aluno, status: 0, latenciaMs: 0, aplicadas: null, descartadas: null, erro: (err as Error).message };
      }
    }),
  );
  const totalMs = performance.now() - inicioTotal;

  console.table(
    resultados.map((r) => ({
      Aluno: r.aluno.email,
      HTTP: r.status,
      "Latência (ms)": Math.round(r.latenciaMs),
      Aplicadas: r.aplicadas,
      Descartadas: r.descartadas,
    })),
  );

  const latencias = resultados.map((r) => r.latenciaMs).sort((a, b) => a - b);
  console.log(
    `Latência p50=${Math.round(percentil(latencias, 50))}ms p95=${Math.round(percentil(latencias, 95))}ms ` +
      `max=${Math.round(latencias[latencias.length - 1] as number)}ms total=${Math.round(totalMs)}ms`,
  );

  const falhas = resultados.filter(
    (r) => r.status !== 200 || r.aplicadas !== VALIDAS_POR_ALUNO || r.descartadas !== INVALIDAS_POR_ALUNO,
  );
  if (falhas.length > 0) {
    console.error(`\nFALHA: ${falhas.length} de ${resultados.length} lotes fora do esperado (${VALIDAS_POR_ALUNO} aplicadas, ${INVALIDAS_POR_ALUNO} descartadas):`);
    for (const f of falhas) {
      console.error(
        `- ${f.aluno.email}: HTTP ${f.status}, aplicadas=${f.aplicadas}, descartadas=${f.descartadas}${f.erro ? `, erro=${f.erro}` : ""}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nOK: todos os lotes retornaram ${VALIDAS_POR_ALUNO} aplicadas e ${INVALIDAS_POR_ALUNO} descartadas.`);
  console.log(`Verificação: pnpm --filter @prontuario/backend exec tsx ../../scripts/test-sync-verify.ts ${rodada}`);
}

main().catch((err: Error) => {
  console.error(`ERRO: ${err.message}`);
  process.exitCode = 1;
});
