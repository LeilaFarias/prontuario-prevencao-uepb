import { dirname, resolve } from "node:path";

process.env.DATABASE_POOL_MAX = "2";

const raiz = resolve(dirname(process.argv[1] ?? "."), "..");
for (const caminho of [resolve(process.cwd(), ".env"), resolve(raiz, ".env"), resolve(raiz, "apps/backend/.env")]) {
  try {
    process.loadEnvFile(caminho);
  } catch {}
}

const TOTAL_ALUNOS = 10;
const ULTIMA_VALIDA = 2;
const DESCARTADAS_ESPERADAS = 20;
const PADRAO_EMAIL = /^teste-sync-(\d+)-(\d+)@uepb\.edu\.br$/;

interface UsuarioRow {
  id: string;
  email: string;
}

interface ProntuarioRow {
  id: string;
  alunoTitularId: string;
  pacienteNome: string;
}

async function main(): Promise<void> {
  const { criarPool, todas } = await import("../apps/backend/src/db");
  const pool = criarPool();

  try {
    const usuarios = await todas<UsuarioRow>(
      pool,
      `SELECT "id", "email" FROM "Usuario" WHERE "email" ~ $1`,
      ["^teste-sync-[0-9]+-[0-9]+@uepb\\.edu\\.br$"],
    );

    const rodadas = new Map<number, Map<number, UsuarioRow>>();
    for (const u of usuarios) {
      const m = PADRAO_EMAIL.exec(u.email);
      if (!m) continue;
      const rodada = Number(m[1]);
      const indice = Number(m[2]);
      if (!rodadas.has(rodada)) rodadas.set(rodada, new Map());
      rodadas.get(rodada)!.set(indice, u);
    }

    const rodada = process.argv[2] ? Number(process.argv[2]) : Math.max(...rodadas.keys());
    const alunos = rodadas.get(rodada);
    if (!alunos) throw new Error(`Nenhum aluno de teste encontrado para a rodada ${process.argv[2] ?? "(mais recente)"}.`);

    const ids = [...alunos.values()].map((u) => u.id);
    const prontuarios = await todas<ProntuarioRow>(
      pool,
      `SELECT "id", "alunoTitularId", "pacienteNome" FROM "Prontuario" WHERE "alunoTitularId" = ANY($1::text[])`,
      [ids],
    );
    const porAluno = new Map<string, ProntuarioRow[]>();
    for (const p of prontuarios) porAluno.set(p.alunoTitularId, [...(porAluno.get(p.alunoTitularId) ?? []), p]);

    const linhas = Array.from({ length: TOTAL_ALUNOS }, (_, i) => {
      const usuario = alunos.get(i);
      const lista = usuario ? (porAluno.get(usuario.id) ?? []) : [];
      const esperado = `Atualizado ${i}-${ULTIMA_VALIDA}`;
      const encontrado = lista.length === 1 ? (lista[0] as ProntuarioRow).pacienteNome : `${lista.length} prontuários`;
      return { Aluno: usuario?.email ?? `(ausente ${i})`, Esperado: esperado, Encontrado: encontrado, OK: encontrado === esperado };
    });

    const prontuarioIds = prontuarios.map((p) => p.id);
    const [{ total }] = await todas<{ total: number }>(
      pool,
      `SELECT COUNT(*)::int AS total FROM "SyncOperationLog" WHERE "descartada" = TRUE AND "prontuarioId" = ANY($1::text[])`,
      [prontuarioIds],
    ) as [{ total: number }];

    const nomesCorretos = linhas.filter((l) => l.OK).length;
    const prontuariosOk = prontuarios.length === TOTAL_ALUNOS;
    const ok = prontuariosOk && nomesCorretos === TOTAL_ALUNOS && total === DESCARTADAS_ESPERADAS;

    console.table(linhas);
    console.log(`Rodada: ${rodada}`);
    console.log(`Prontuários encontrados: ${prontuarios.length}/${TOTAL_ALUNOS}`);
    console.log(`Nomes corretos (última operação válida por ts): ${nomesCorretos}/${TOTAL_ALUNOS}`);
    console.log(`Operações descartadas no log: ${total} (esperado ${DESCARTADAS_ESPERADAS})`);
    console.log(`Veredito: ${ok ? "OK" : "FALHA"}`);
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error(`ERRO: ${err.message}`);
  process.exitCode = 1;
});
