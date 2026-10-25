import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, Check, ChevronDown, ChevronUp, Clock } from "lucide-react";
import {
  consentimentoSchema,
  type Consentimento as ConsentimentoValores,
  type DadosPessoais as DadosPessoaisValores,
} from "@prontuario/shared";
import { db, type LocalProntuario } from "../../db/dexie";
import { useSecao } from "../../hooks/useSecao";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { hojeISO, formatarDataHora } from "../../lib/data";
import CampoData from "./CampoData";
import CampoTexto, { type CampoTextoProps } from "./CampoTexto";
import GrupoFicha from "./GrupoFicha";
import UploadAssinatura from "./UploadAssinatura";

type ChaveTexto = "semestreLetivo" | "professorSupervisor" | "alunoOperador" | "alunoAuxiliar";

type ExtraTexto = Partial<Pick<CampoTextoProps, "placeholder" | "inputMode" | "autoComplete" | "maxLength" | "type">>;

const PARAGRAFOS_TERMO: ReadonlyArray<string> = [
  "Como responsável pelo(a) menor {IDADE}, concordo com o seu atendimento pelos acadêmicos, monitores, alunos de pós-graduação e professores vinculados à Clínica de Prevenção em Saúde Bucal do Departamento de Odontologia da Universidade Estadual da Paraíba. Sei que ocorre o apoio de outros funcionários (quadro técnico) e que poderá existir a participação de outros pesquisadores autorizados previamente.",
  "Também aceito a documentação do caso (imagens, radiografias, modelos e outros meios) com a finalidade exclusivamente acadêmica (apresentação em eventos científicos da área e publicação em periódicos científicos), se respeitada a idade da criança/adolescente em questão.",
  "Estou certo(a) de que durante as consultas serão utilizados materiais e técnicas objetivando promover melhor qualidade de saúde bucal, assim como medidas para reduzir a possibilidade de riscos ou danos durante a prática clínica. Fui informado(a) de que a minha colaboração é muito importante para o sucesso no tratamento desse paciente. Desse modo, aceito participar das palestras ou atividades de orientação sobre saúde bucal a fim de esclarecer as dúvidas que possuo e apresentar sugestões sobre o tema/assunto.",
  "Procurarei cumprir a pontualidade no horário agendado para a consulta, pois recebi o comunicado que, após 20 (vinte) minutos do início das atividades, caso o paciente não tenha chegado, um paciente novo será encaminhado para o atendimento do dia. Declaro estar ciente de que se tiver duas faltas, sem avisar com antecedência, este paciente será substituído por outro, seguindo uma lista de triagem efetuada anteriormente.",
  "Comunicaram-me ainda que existe a possibilidade de choro ou dificuldade de cooperação por parte da criança/adolescente. Em caso de necessidade e com a certeza de que serei avisado(a) previamente, aceito os procedimentos para controle de comportamento do(a) paciente adotados na clínica. Somado a isso estou de acordo com as normas de atendimento da clínica (incluindo os exames ou laudos solicitados), sabendo que a criança/adolescente pelo(a) qual sou responsável poderá ser retirada do atendimento a qualquer momento (se for da minha vontade e após a assinatura na ficha, de um termo de interrupção do tratamento).",
  "Por último, da mesma forma assumo, com a assinatura deste documento, a responsabilidade pelas informações quanto à identificação, à história médica e à história buco-dental deste(a) paciente.",
];

function preencher(v: ConsentimentoValores, p: LocalProntuario): ConsentimentoValores {
  return {
    ...v,
    dataAssinatura: v.dataAssinatura || (p.status === "assinado" ? "" : hojeISO()),
  };
}

function DadoLeitura({ rotulo, principal, secundario }: { rotulo: string; principal: string; secundario?: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{rotulo}</p>
      {principal ? (
        <p className="mt-1 text-[14px] leading-snug text-ink">
          <span className="font-medium">{principal}</span>
          {secundario && <span className="text-ink-soft"> · {secundario}</span>}
        </p>
      ) : secundario ? (
        <p className="mt-1 text-[14px] leading-snug text-ink-soft">{secundario}</p>
      ) : (
        <p className="mt-1 text-[14px] leading-snug text-ink-faint">Não informado</p>
      )}
    </div>
  );
}

function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

function IndicadorSalvamento({ salvando, jaSalvou }: { salvando: boolean; jaSalvou: boolean }) {
  const { pendentes, online } = useSyncStatus();

  let texto: string | null = null;
  if (salvando) texto = "Salvando…";
  else if (pendentes > 0) texto = online ? "Salvando…" : "Salvo neste aparelho · será enviado quando houver conexão";
  else if (jaSalvou) texto = "Salvo automaticamente";

  return (
    <p role="status" aria-live="polite" className="min-h-[16px] text-[11px] text-ink-faint">
      {texto}
    </p>
  );
}

function FormularioConsentimento({
  prontuario,
  onIrParaDadosPessoais,
}: {
  prontuario: LocalProntuario;
  onIrParaDadosPessoais: () => void;
}) {
  const { control, setValue, salvando, salvoEm, somenteLeitura } = useSecao(
    prontuario,
    "consentimento",
    consentimentoSchema,
    { preencher },
  );

  const dp = (prontuario.secoes?.["dados-pessoais"] || {}) as Partial<DadosPessoaisValores>;
  const pacienteNome = (dp.nomeCompleto || "").trim();
  const idadeMenor = (dp.idade || "").trim();
  const responsavelNome = (dp.responsavelNome || "").trim();
  const responsavelParentesco = (dp.responsavelParentesco || "").trim();
  const telefone = (dp.telefone || "").trim();

  const faltando = [
    !pacienteNome && "nome do paciente",
    !idadeMenor && "idade (data de nascimento)",
    !responsavelNome && "nome do responsável",
    !responsavelParentesco && "parentesco do responsável",
    !telefone && "telefone",
  ].filter((x): x is string => Boolean(x));
  const dadosCompletos = faltando.length === 0;
  const bloqueado = !dadosCompletos && !somenteLeitura;

  const termoAceito = useWatch({ control, name: "termoAceito" });
  const assinaturaFoto = useWatch({ control, name: "assinaturaFoto" });
  const assinaturaAnexadaEm = useWatch({ control, name: "assinaturaAnexadaEm" });

  const [termoExpandido, setTermoExpandido] = useState(false);

  const texto = (name: ChaveTexto, label: string, extra: ExtraTexto = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CampoTexto
          label={label}
          value={field.value}
          onChange={field.onChange}
          disabled={somenteLeitura}
          {...extra}
        />
      )}
    />
  );

  const idadeNoTermo = idadeMenor || "___ anos";
  const nomeAssinante = responsavelNome;
  const temFoto = Boolean(assinaturaFoto);

  const pillAceito = temFoto && termoAceito;
  const textoPill = temFoto
    ? `Assinatura registrada${nomeAssinante ? ` por ${nomeAssinante}` : ""}, em ${formatarDataHora(assinaturaAnexadaEm)}`
    : "Aguardando anexo da assinatura do responsável";

  return (
    <div className="flex flex-col gap-3 pb-2">
      {bloqueado && (
        <div role="alert" className="flex flex-col gap-3 rounded-card border border-alt/30 bg-alt-tint p-4">
          <div className="flex items-start gap-2.5 text-alt">
            <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[13.5px] font-medium leading-snug">Complete os dados em Dados Pessoais para assinar o termo</p>
              <p className="mt-1 text-[12.5px] leading-snug">Falta preencher: {faltando.join(", ")}.</p>
            </div>
          </div>
          <button type="button" className="btn-ghost !h-10 !text-[13.5px]" onClick={onIrParaDadosPessoais}>
            Ir para Dados Pessoais
          </button>
        </div>
      )}

      <GrupoFicha titulo="Identificação do atendimento">
        <div className="rounded-field bg-paper px-3.5 py-3.5">
          <div className="divide-y divide-line-soft">
            <DadoLeitura rotulo="Paciente" principal={pacienteNome} secundario={idadeMenor} />
            <DadoLeitura rotulo="Responsável legal" principal={responsavelNome} secundario={responsavelParentesco} />
            <DadoLeitura rotulo="Telefone" principal={telefone ? formatarTelefone(telefone) : ""} />
          </div>
          <p className="mt-3 border-t border-line-soft pt-3 text-[11.5px] text-ink-faint">
            Estes dados vêm da seção Dados Pessoais.
          </p>
        </div>

        {texto("semestreLetivo", "Semestre letivo", { placeholder: "2026.2" })}
        {texto("professorSupervisor", "Professor supervisor", { placeholder: "Nome do professor responsável" })}
        {texto("alunoOperador", "Aluno operador")}
        {texto("alunoAuxiliar", "Aluno auxiliar")}
      </GrupoFicha>

      <section aria-labelledby="titulo-termo" className="rounded-card border border-line bg-raised p-4">
        <h3 id="titulo-termo" className="font-display text-[15px] font-medium text-ink">
          Termo de Consentimento Livre e Esclarecido
        </h3>
        <p className="mb-3 mt-1 text-[12px] text-ink-faint">
          Mesmo documento impresso da Clínica de Prevenção em Saúde Bucal — CCBS / UEPB.
        </p>

        <div
          id="texto-termo"
          tabIndex={0}
          role="region"
          aria-label="Texto do termo de consentimento"
          className="overflow-y-auto rounded-field border border-line-soft bg-paper p-[14px] text-[12.5px] leading-[1.62] text-ink-soft transition-[max-height]"
          style={{ maxHeight: termoExpandido ? 1800 : 180 }}
        >
          {PARAGRAFOS_TERMO.map((par, i) => (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {par.replace("{IDADE}", idadeNoTermo)}
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTermoExpandido((x) => !x)}
          aria-expanded={termoExpandido}
          aria-controls="texto-termo"
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary"
        >
          {termoExpandido ? "Recolher termo" : "Ler termo completo"}
          {termoExpandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        <Controller
          control={control}
          name="termoAceito"
          render={({ field }) => (
            <label
              className={`mt-3 flex items-start gap-3 rounded-field border border-line-soft p-3 ${
                somenteLeitura || bloqueado ? "cursor-not-allowed opacity-70" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                disabled={somenteLeitura || bloqueado}
              />
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-ink-faint bg-raised text-white transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary-tint peer-disabled:opacity-60"
              >
                {field.value && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="text-[13px] leading-[1.45] text-ink">
                Declaro que li e concordo com o Termo de Consentimento Livre e Esclarecido e autorizo o atendimento e a
                documentação do caso para fins acadêmicos.
              </span>
            </label>
          )}
        />
      </section>

      <GrupoFicha titulo="Assinatura do responsável">
        <p className="-mt-2 text-[12px] text-ink-faint">
          A assinatura é registrada como anexo de foto do termo assinado à mão.
        </p>

        <UploadAssinatura
          foto={assinaturaFoto}
          anexadaEm={assinaturaAnexadaEm}
          somenteLeitura={somenteLeitura}
          desabilitado={bloqueado}
          onAnexar={(dataUrl, em) => {
            setValue("assinaturaFoto", dataUrl);
            setValue("assinaturaAnexada", true);
            setValue("assinaturaAnexadaEm", em);
          }}
          onRemover={() => {
            setValue("assinaturaFoto", null);
            setValue("assinaturaAnexada", false);
            setValue("assinaturaAnexadaEm", null);
          }}
        >
          <div
            className={`flex items-start gap-2 rounded-field px-3 py-2.5 text-[12.5px] font-medium ${
              pillAceito ? "bg-primary-tint text-primary" : "bg-sync-tint text-sync"
            }`}
          >
            {pillAceito ? (
              <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <Clock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{textoPill}</span>
          </div>
          {temFoto && !termoAceito && (
            <p className="-mt-1 text-[11.5px] text-ink-faint">
              Marque a concordância com o termo para concluir o consentimento.
            </p>
          )}
        </UploadAssinatura>
      </GrupoFicha>

      <GrupoFicha titulo="Data da assinatura">
        <Controller
          control={control}
          name="dataAssinatura"
          render={({ field }) => (
            <CampoData
              label="Data da assinatura"
              value={field.value}
              onChange={(v) => {
                const hoje = hojeISO();
                field.onChange(v > hoje ? hoje : v);
              }}
              max={hojeISO()}
              disabled={somenteLeitura}
            />
          )}
        />
      </GrupoFicha>

      <IndicadorSalvamento salvando={salvando} jaSalvou={salvoEm !== null || Boolean(prontuario.secoes["consentimento"])} />
    </div>
  );
}

export default function Consentimento({
  prontuarioId,
  onIrParaDadosPessoais,
}: {
  prontuarioId: string;
  onIrParaDadosPessoais: () => void;
}) {
  const prontuario = useLiveQuery(() => db.prontuarios.get(prontuarioId), [prontuarioId]);
  if (!prontuario) return null;
  return <FormularioConsentimento prontuario={prontuario} onIrParaDadosPessoais={onIrParaDadosPessoais} />;
}
