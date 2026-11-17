export const VERSAO_TERMOS_INICIAL = "1.0";

export const SQL_VERSAO_ATUAL = `(SELECT "versao" FROM "TermosVersao" ORDER BY "publicadaEm" DESC LIMIT 1)`;

export const CONTEUDO_TERMOS_V1 = `# Termos de Uso e Política de Privacidade - Prontuário Digital UEPB

**Versão 1.0 - 16/11/2026**

## 1. Quem somos

Este sistema foi desenvolvido como Trabalho de Conclusão de Curso (TCC) do curso de **Ciência da Computação da Universidade Federal de Campina Grande (UFCG)**, e é aplicado na **Clínica de Prevenção em Saúde Bucal do Departamento de Odontologia da Universidade Estadual da Paraíba (UEPB)**. O sistema digitaliza o prontuário odontológico dos pacientes atendidos na clínica.

Para fins da LGPD:
- A UEPB, por meio da coordenação da clínica, é a controladora dos dados de pacientes.
- A autora do TCC (UFCG) atua como **operadora** durante o período de demonstração, tratando os dados conforme as normas da LGPD.
- A infraestrutura técnica do sistema (banco de dados, hospedagem, envio de e-mail) é mantida pela autora do TCC durante o período de demonstração.

## 2. Quais dados são tratados e em quais condições

Durante o período de demonstração do TCC, o sistema pode operar em dois modos:

**Modo A - Dados reais**
O sistema pode conter:
- Dados de identificação: nome, data de nascimento, matrícula, contato.
- Dados de saúde (sensíveis, LGPD art. 5º, II): história médica e odontológica, exames, procedimentos, evolução clínica, imagens.

**Modo B - Dados fictícios**
Para testes, treinamento de alunos e demonstrações acadêmicas, o sistema utiliza apenas dados fictícios ou sintéticos, que não correspondem a pessoas reais e não são dados pessoais nos termos da LGPD.

Em ambos os modos, os alunos e professores que acessam o sistema têm seus dados de identificação tratados: nome, e-mail institucional, matrícula e perfil de acesso.

## 3. Para que os dados são usados
- Prestação de cuidado odontológico ao paciente (finalidade principal, no Modo A).
- Ensino e supervisão de alunos de Odontologia.
- Pesquisa acadêmica, sempre com dados agregados e anonimizados.
- Cumprimento de obrigações legais e regulatórias.

## 4. Base legal (LGPD)
- Dados de saúde (Modo A): tutela da saúde (art. 11, II, "f") e obrigação legal (art. 11, II, "a").
- Dados de identificação: execução de contrato e legítimo interesse.
- Uso em pesquisa: consentimento específico do paciente.
- Dados fictícios (Modo B): não são dados pessoais, a LGPD não se aplica.

## 5. Como os dados são protegidos {#seguranca}
- Criptografia em trânsito (HTTPS).
- Criptografia em repouso (AES-256 no banco de dados).
- Backup criptografado (AES-256-GCM).
- Controle de acesso por perfil (aluno acessa apenas seus próprios prontuários; professores supervisores acessam o acervo clínico da clínica para fins de ensino e supervisão).
- Auditoria de acessos e operações (toda leitura é registrada).
- Senhas armazenadas com hash (scrypt).

## 6. Responsabilidades do aluno/professor que usa o sistema
- Sigilo profissional: os dados de pacientes só podem ser acessados para fins de atendimento, ensino e pesquisa autorizada.
- Não compartilhar credenciais de acesso.
- Não fotografar ou copiar dados de pacientes para dispositivos pessoais fora do sistema.
- Reportar imediatamente à coordenação qualquer suspeita de vazamento ou acesso indevido.
- Usar apenas dados reais de pacientes durante atendimentos autorizados. Para testes e demonstrações, usar exclusivamente dados fictícios ou sintéticos.

## 7. Direitos do paciente (titular dos dados)
No Modo A, o paciente pode, a qualquer momento, solicitar à coordenação da clínica:
- Confirmação de tratamento e acesso aos dados.
- Correção de dados incompletos ou desatualizados.
- Informações sobre compartilhamento.
- Revogação do consentimento para pesquisa (sem prejuízo do atendimento).

## 8. Natureza do sistema, retenção e ciclo de vida

Este é um sistema de demonstração desenvolvido como Trabalho de Conclusão de Curso (TCC) do Departamento de Odontologia da UEPB.

**Retenção conforme o modo de operação:**
- **Modo A (dados reais ):** os dados de pacientes são mantidos pela clínica em prontuário físico, que é a responsável legal pela guarda do prontuário pelo prazo mínimo de 20 anos (Lei nº 13.787/2018 e Resolução CFO nº 118/2012). Após a defesa do TCC, os dados serão transferidos para o sistema oficial da clínica ou excluídos, conforme decisão da coordenação.
- **Modo B (dados fictícios):** não há obrigação legal de retenção, pois não são dados pessoais. Os dados fictícios são excluídos ao final do período de testes.

A exclusão de conta de alunos e professores é feita por desativação (soft delete), preservando o histórico de auditoria.

## 9. Transferência internacional

O sistema utiliza serviços de nuvem: Supabase (banco de dados, hospedado nos Estados Unidos, região Leste – North Virginia), Render (hospedagem, EUA) e Brevo (envio de e-mail, França).

- **Modo A (dados reais):** a transferência internacional observa os arts. 33 a 36 da LGPD. O Supabase oferece garantias contratuais (cláusulas-padrão) para a proteção dos dados.
- **Modo B (dados fictícios):** não há transferência de dados pessoais, pois os dados não correspondem a pessoas reais.

## 10. Contato

- **Sobre dados de pacientes e a clínica:** Coordenação da Clínica de Prevenção em Saúde Bucal - Departamento de Odontologia - UEPB.
- **Sobre o sistema (aspectos técnicos):** autora do TCC - curso de Ciência da Computação - UFCG.

## 11. Alterações
Estes Termos podem ser atualizados. Ao publicar uma nova versão, o usuário será novamente solicitado a aceitar.

**Ao clicar em "Aceitar e continuar", você declara que leu, compreendeu e concorda com estes Termos.**
`;
