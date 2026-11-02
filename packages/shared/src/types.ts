export type Perfil = "aluno" | "professor";

export type ProntuarioStatus = "em_andamento" | "enviado" | "assinado" | "devolvido";

export const SECAO_IDS = [
  "dados-pessoais",
  "consentimento",
  "historia-medica",
  "historia-odontologica",
  "exames",
  "sangramento",
  "ihos",
  "cpod-ceod",
  "plano-preventivo",
  "procedimentos",
  "conclusao",
] as const;

export type SecaoId = (typeof SECAO_IDS)[number];

export const SECOES: ReadonlyArray<{ id: SecaoId; titulo: string }> = [
  { id: "dados-pessoais", titulo: "Dados pessoais" },
  { id: "consentimento", titulo: "Consentimento" },
  { id: "historia-medica", titulo: "História médica" },
  { id: "historia-odontologica", titulo: "História odontológica" },
  { id: "exames", titulo: "Exames" },
  { id: "sangramento", titulo: "Sangramento" },
  { id: "ihos", titulo: "IHOS" },
  { id: "cpod-ceod", titulo: "CPO-D / ceo-d" },
  { id: "plano-preventivo", titulo: "Plano preventivo" },
  { id: "procedimentos", titulo: "Procedimentos" },
  { id: "conclusao", titulo: "Conclusão" },
];
