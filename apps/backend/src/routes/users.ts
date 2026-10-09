import type { FastifyPluginAsync } from "fastify";
import {
  alterarMatriculaSchema,
  alterarSenhaSchema,
  atualizarPerfilSchema,
  excluirContaSchema,
  type UsuarioMe,
} from "@prontuario/shared";
import { hashSenha, verificarSenha } from "../lib/senha";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  matricula: string | null;
  criadoEm: string;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;
  const protegida = { preHandler: app.autenticar };

  const buscarMe = (id: string): UsuarioMe => {
    const u = db
      .prepare("SELECT id, nome, email, perfil, matricula, criadoEm FROM Usuario WHERE id = ?")
      .get(id) as unknown as UsuarioRow;
    return { ...u, perfil: u.perfil.toLowerCase() as UsuarioMe["perfil"] };
  };

  const buscarHash = (id: string): string | undefined =>
    (db.prepare("SELECT senhaHash FROM Usuario WHERE id = ?").get(id) as unknown as
      | { senhaHash: string }
      | undefined)?.senhaHash;

  app.get("/users/me", protegida, async (req) => buscarMe(req.user.sub));

  app.put("/users/me", protegida, async (req, reply) => {
    const id = req.user.sub;
    const dados = atualizarPerfilSchema.parse(req.body);

    if (dados.email && db.prepare("SELECT id FROM Usuario WHERE email = ? AND id != ?").get(dados.email, id)) {
      return reply.status(409).send({ message: "Este e-mail já está em uso." });
    }

    const campos: string[] = [];
    const valores: string[] = [];
    if (dados.nome) {
      campos.push("nome = ?");
      valores.push(dados.nome);
    }
    if (dados.email) {
      campos.push("email = ?");
      valores.push(dados.email);
    }
    if (campos.length > 0) {
      db.prepare(`UPDATE Usuario SET ${campos.join(", ")} WHERE id = ?`).run(...valores, id);
    }
    return buscarMe(id);
  });

  app.put("/users/me/password", protegida, async (req, reply) => {
    const id = req.user.sub;
    const dados = alterarSenhaSchema.parse(req.body);

    const hashAtual = buscarHash(id);
    if (!hashAtual || !(await verificarSenha(dados.senhaAtual, hashAtual))) {
      return reply.status(401).send({ message: "Senha atual incorreta." });
    }

    db.prepare("UPDATE Usuario SET senhaHash = ? WHERE id = ?").run(await hashSenha(dados.novaSenha), id);
    return { ok: true };
  });

  app.put("/users/me/matricula", protegida, async (req, reply) => {
    const id = req.user.sub;
    const atual = buscarMe(id);
    if (atual.perfil !== "professor") {
      return reply.status(403).send({ message: "Apenas professores possuem matrícula." });
    }

    const { matricula } = alterarMatriculaSchema.parse(req.body);
    if (db.prepare("SELECT id FROM Usuario WHERE matricula = ? AND id != ?").get(matricula, id)) {
      return reply.status(409).send({ message: "Esta matrícula já está cadastrada." });
    }

    db.prepare("UPDATE Usuario SET matricula = ? WHERE id = ?").run(matricula, id);
    return buscarMe(id);
  });

  app.delete("/users/me", protegida, async (req, reply) => {
    const id = req.user.sub;
    const { senha } = excluirContaSchema.parse(req.body);

    const hash = buscarHash(id);
    if (!hash || !(await verificarSenha(senha, hash))) {
      return reply.status(401).send({ message: "Senha incorreta." });
    }

    db.prepare("UPDATE Usuario SET ativo = 0 WHERE id = ?").run(id);
    return { ok: true };
  });
};
