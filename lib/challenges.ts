// Definições dos desafios semanais (compartilhado pela página e pelo dashboard).
export { weekStartISO } from "./date";

export type ChallengeMetric =
  | "workouts"
  | "meals"
  | "waterGoalDays"
  | "activeDays"
  | "measurements";

export type Challenge = {
  id: string;
  title: string;
  desc: string;
  icon: string; // nome do ícone lucide (mapeado na página)
  target: number;
  xp: number;
  metric: ChallengeMetric;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "treinos4",
    title: "Guerreiro dos treinos",
    desc: "Faça 4 treinos nesta semana",
    icon: "Dumbbell",
    target: 4,
    xp: 60,
    metric: "workouts",
  },
  {
    id: "refeicoes12",
    title: "Nutrição em dia",
    desc: "Registre 12 refeições",
    icon: "Salad",
    target: 12,
    xp: 50,
    metric: "meals",
  },
  {
    id: "agua4",
    title: "Hidratação",
    desc: "Bata a meta de água em 4 dias",
    icon: "Droplets",
    target: 4,
    xp: 40,
    metric: "waterGoalDays",
  },
  {
    id: "constancia5",
    title: "Constância",
    desc: "Registre algo em 5 dias diferentes",
    icon: "Flame",
    target: 5,
    xp: 50,
    metric: "activeDays",
  },
  {
    id: "medida1",
    title: "Medida certa",
    desc: "Faça 1 medição corporal",
    icon: "Scale",
    target: 1,
    xp: 30,
    metric: "measurements",
  },
];

