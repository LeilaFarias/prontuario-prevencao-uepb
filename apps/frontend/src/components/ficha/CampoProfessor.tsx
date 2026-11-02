import { useMemo } from "react";
import { useProfessores } from "../../hooks/useProfessores";
import CampoSelect, { type OpcaoCampo } from "./CampoSelect";

interface Props {
  value: string;
  onChange: (nome: string) => void;
  disabled?: boolean;
}

export default function CampoProfessor({ value, onChange, disabled }: Props) {
  const { professores, carregando, falhou } = useProfessores();
  const atual = value.trim();

  const opcoes = useMemo<OpcaoCampo[]>(() => {
    const repetidos = new Set(
      professores.map((p) => p.nome).filter((nome, i, todos) => todos.indexOf(nome) !== i),
    );
    const lista: OpcaoCampo[] = professores.map((p) => ({
      value: p.nome,
      label: repetidos.has(p.nome) && p.matricula ? `${p.nome} (matrícula ${p.matricula})` : p.nome,
    }));

    if (atual && !professores.some((p) => p.nome === atual)) {
      const semListaConfiavel = carregando || (falhou && professores.length === 0);
      lista.unshift({
        value: atual,
        label: semListaConfiavel ? atual : `⚠ ${atual} (não encontrado) — selecione outro`,
      });
    }
    return lista;
  }, [professores, atual, carregando, falhou]);

  return (
    <div>
      <CampoSelect
        label="Professor supervisor"
        value={atual}
        onChange={onChange}
        options={opcoes}
        disabled={disabled}
        placeholder={carregando ? "Carregando professores…" : "Selecione o professor"}
      />
      {falhou && professores.length === 0 && (
        <p className="hint">Não foi possível carregar a lista de professores. Conecte-se à internet para escolher.</p>
      )}
    </div>
  );
}
