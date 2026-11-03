export const ACESSO_TEMPORARIO_HORAS = 4;

export interface AcessoPendente {
  prontuarioId: string;
  pacienteNome: string;
  alunoNome: string;
  solicitadoEm: string;
  tempoEspera: string;
}

export interface AcessoVigente {
  prontuarioId: string;
  pacienteNome: string;
  alunoNome: string;
  acessoExpiraEm: string;
  segundosRestantes: number;
}

export interface AcessosResponse {
  pendentes: AcessoPendente[];
  vigentes: AcessoVigente[];
}

export interface SolicitarAcessoResponse {
  ok: true;
  jaSolicitado?: boolean;
  jaTemAcesso?: boolean;
}

export interface AprovarAcessoResponse {
  ok: true;
  acessoExpiraEm: string;
}

export const ERRO_ACESSO_EXPIRADO = "acesso_expirado";
