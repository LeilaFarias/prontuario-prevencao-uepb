import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "./env";
import { descriptografarBackup } from "./lib/backup";

const entrada = process.argv[2];
if (!entrada) {
  console.error("Uso: pnpm --filter @prontuario/backend restore <caminho-do-backup.db.enc>");
  process.exit(1);
}

const origem = path.resolve(process.env.INIT_CWD ?? process.cwd(), entrada);
const destino = path.resolve(process.cwd(), env.DATABASE_URL.replace(/^file:/, ""));
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const copiaSeguranca = `${destino}.bak-${timestamp}`;
const havia = existsSync(destino);

const removerWal = (): void => {
  for (const sufixo of ["-wal", "-shm"]) rmSync(`${destino}${sufixo}`, { force: true });
};

function contarRegistros(arquivo: string): Record<string, number> {
  const db = new DatabaseSync(arquivo);
  try {
    const tabelas = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as unknown as { name: string }[];
    const contagens: Record<string, number> = {};
    for (const { name } of tabelas) {
      const linha = db.prepare(`SELECT COUNT(*) AS total FROM "${name}"`).get() as unknown as { total: number };
      contagens[name] = Number(linha.total);
    }
    if (!contagens.Usuario) throw new Error("Banco restaurado inválido: tabela Usuario ausente ou sem registros");
    return contagens;
  } finally {
    db.close();
  }
}

function desfazer(): void {
  removerWal();
  if (havia) copyFileSync(copiaSeguranca, destino);
  else rmSync(destino, { force: true });
}

try {
  if (!existsSync(origem)) throw new Error(`Arquivo de backup não encontrado: ${origem}`);
  const buffer = readFileSync(origem);

  if (havia) {
    const atual = new DatabaseSync(destino);
    atual.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    atual.close();
    copyFileSync(destino, copiaSeguranca);
  }

  try {
    removerWal();
    descriptografarBackup(buffer, destino);
    const contagens = contarRegistros(destino);
    console.log("Restauração concluída.");
    if (havia) console.log(`Banco anterior preservado em: ${copiaSeguranca}`);
    for (const [tabela, total] of Object.entries(contagens)) console.log(`  ${tabela}: ${total}`);
  } catch (err) {
    desfazer();
    rmSync(copiaSeguranca, { force: true });
    throw err;
  }
} catch (err) {
  console.error(`Falha na restauração: ${err instanceof Error ? err.message : String(err)}`);
  if (havia) console.error("O banco atual foi mantido.");
  process.exit(1);
}
