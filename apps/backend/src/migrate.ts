import { criarPool, migrar } from "./db";

const db = criarPool();
try {
  await migrar(db);
  console.log("Banco pronto.");
} finally {
  await db.end();
}
