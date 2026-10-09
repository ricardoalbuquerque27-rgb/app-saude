// Formas das linhas que a página do paciente lê do banco e passa para os
// editores. Moram aqui, e não em PrescricaoClient.tsx, para os componentes
// de components/clinico/ não dependerem de um arquivo que a Tarefa 8 apaga.

export type ExercicioRotina = {
  id: string;
  routine_id: string;
  name: string;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  position: number | null;
};

export type Rotina = {
  id: string;
  name: string;
  notes: string | null;
  prescribed_by: string | null;
};

export type PlanoItem = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  routine_id: string | null;
  prescribed_by: string | null;
};

export type Desvio = {
  id: string;
  kind: string;
  field: string;
  prescribed: string | null;
  current_value: string | null;
  created_at: string;
};

export type Mensagem = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_id: string;
  visibility: string;
};
