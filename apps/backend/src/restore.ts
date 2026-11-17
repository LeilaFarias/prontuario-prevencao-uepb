import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { criarPool, migrar } from "./db";
import { descriptografarBackup, restaurarBanco } from "./lib/backup";

const entrada = process.argv[2];
if (!entrada) {
  console.error("Uso: pnpm --filter @prontuario/backend restore <caminho-do-backup.json.enc>");
  process.exit(1);
}

const origem = path.resolve(process.env.INIT_CWD ?? process.cwd(), entrada);
const db = criarPool();

try {
  if (!existsSync(origem)) throw new Error(`Arquivo de backup não encontrado: ${origem}`);
  const dados = descriptografarBackup(readFileSync(origem));
  await migrar(db);
  const { contagens, credenciaisARedefinir } = await restaurarBanco(db, dados);
  console.log("Restauração concluída.");
  for (const [tabela, total] of Object.entries(contagens)) console.log(`  ${tabela}: ${total}`);
  if (credenciaisARedefinir > 0) {
    console.warn(
      `Atenção: ${credenciaisARedefinir} usuário(s) estão sem senha válida e precisam usar "Esqueci minha senha". Professores também precisam redefinir o PIN.`,
    );
  }
} catch (err) {
  console.error(`Falha na restauração: ${err instanceof Error ? err.message : String(err)}`);
  console.error("O banco atual foi mantido.");
  process.exitCode = 1;
} finally {
  await db.end();
}