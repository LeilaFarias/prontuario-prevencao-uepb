import { abrirBanco } from "./db";

const db = abrirBanco();
db.close();
console.log("Banco pronto.");
