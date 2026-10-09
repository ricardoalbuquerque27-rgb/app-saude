// Formas das linhas que a página do paciente lê do banco e passa para os
// editores e para as seções (app/app/pacientes/[id]/secoes/).

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

export type Mensagem = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_id: string;
  visibility: string;
};
