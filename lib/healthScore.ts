// Score de Saúde diário (0–100) — um resumo simples e explicável do dia,
// somando sono, movimento, nutrição e hidratação/bem-estar. Usa só dados
// que o app já coleta (sem wearable), ideal para o público brasileiro no PWA.
//
// Módulo PURO (sem dependências) para usar no dashboard e no contexto da IA.

export type ScoreInput = {
  sleepHours: number | null;
  trainedToday: boolean;
  workoutsWeek: number;
  mealsLoggedToday: number;
  proteinToday: number;
  proteinGoal: number | null;
  caloriesToday: number;
  calorieGoal: number | null;
  waterToday: number;
  waterGoal: number;
  mood: string | null; // otimo|bem|neutro|cansado|mal
  energy: number | null; // 1..5
};

export type ScorePillar = {
  key: "sono" | "movimento" | "nutricao" | "bemestar";
  label: string;
  value: number; // 0..100
  tip: string;
};

export type HealthScore = {
  score: number;
  label: string;
  color: "brand" | "amber" | "rose";
  pillars: ScorePillar[];
  topTip: string;
  hasData: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function scoreSono(h: number | null): { value: number; tip: string } {
  if (h == null) return { value: 60, tip: "Registre seu sono na aba Hábitos." };
  if (h >= 7 && h <= 9) return { value: 100, tip: "Sono em dia. Continue assim!" };
  if ((h >= 6 && h < 7) || (h > 9 && h <= 10))
    return { value: 80, tip: "Quase lá — mire 7 a 9 horas." };
  if (h >= 5 && h < 6) return { value: 60, tip: "Durma um pouco mais hoje." };
  return { value: 40, tip: "Priorize o sono: mire 7 a 9 horas." };
}

function scoreMovimento(week: number, today: boolean): { value: number; tip: string } {
  const base =
    week >= 4 ? 100 : week === 3 ? 80 : week === 2 ? 60 : week === 1 ? 40 : 15;
  const value = today ? Math.max(base, 85) : base;
  const tip =
    value >= 80
      ? "Ótima constância de treino!"
      : today
        ? "Boa, você treinou hoje!"
        : "Que tal treinar hoje? 🌱";
  return { value, tip };
}

function scoreNutricao(i: ScoreInput): { value: number; tip: string } {
  if (i.mealsLoggedToday === 0) {
    return { value: 40, tip: "Registre suas refeições de hoje." };
  }
  let value = 60;
  let tip = "Alimentação registrada — mande ver na proteína.";
  if (i.proteinGoal && i.proteinGoal > 0) {
    const pf = Math.min(1, i.proteinToday / i.proteinGoal);
    value += 40 * pf;
    if (pf < 1) {
      const faltam = Math.max(0, Math.round(i.proteinGoal - i.proteinToday));
      tip = `Faltam ${faltam} g de proteína para a meta.`;
    } else {
      tip = "Meta de proteína batida! 💪";
    }
  } else {
    value += 40 * Math.min(1, i.mealsLoggedToday / 3);
    tip = "Defina sua meta de proteína para afinar o score.";
  }
  return { value: clamp(value), tip };
}

function scoreBemEstar(i: ScoreInput): { value: number; tip: string } {
  const goal = i.waterGoal || 2500;
  const waterScore = Math.min(1, i.waterToday / goal) * 100;
  let wellbeing = 60;
  if (i.mood === "otimo" || i.mood === "bem" || (i.energy ?? 0) >= 4) wellbeing = 100;
  else if (i.mood === "neutro" || i.energy === 3) wellbeing = 60;
  else if (i.mood === "cansado" || i.mood === "mal" || (i.energy ?? 9) <= 2)
    wellbeing = 30;
  else if (i.mood == null && i.energy == null) wellbeing = 60;

  const value = clamp(0.6 * waterScore + 0.4 * wellbeing);
  let tip = "Hidratação e humor em dia!";
  if (waterScore < 70) {
    const faltam = Math.max(0, Math.round(goal - i.waterToday));
    tip = `Beba mais água — faltam ${faltam} ml para a meta.`;
  } else if (wellbeing <= 30) {
    tip = "Dia puxado? Caprichar no descanso ajuda.";
  }
  return { value, tip };
}

export function computeHealthScore(i: ScoreInput): HealthScore {
  const sono = scoreSono(i.sleepHours);
  const mov = scoreMovimento(i.workoutsWeek, i.trainedToday);
  const nut = scoreNutricao(i);
  const bem = scoreBemEstar(i);

  const pillars: ScorePillar[] = [
    { key: "sono", label: "Sono", value: sono.value, tip: sono.tip },
    { key: "movimento", label: "Movimento", value: mov.value, tip: mov.tip },
    { key: "nutricao", label: "Nutrição", value: nut.value, tip: nut.tip },
    { key: "bemestar", label: "Hidratação e bem-estar", value: bem.value, tip: bem.tip },
  ];

  const score = clamp(
    pillars.reduce((s, p) => s + p.value, 0) / pillars.length
  );

  const label =
    score >= 85 ? "Excelente" : score >= 70 ? "Bom" : score >= 55 ? "Regular" : "Pode melhorar";
  const color: HealthScore["color"] =
    score >= 70 ? "brand" : score >= 55 ? "amber" : "rose";

  // Dica principal = pilar mais fraco.
  const weakest = [...pillars].sort((a, b) => a.value - b.value)[0];

  const hasData =
    i.sleepHours != null ||
    i.mealsLoggedToday > 0 ||
    i.waterToday > 0 ||
    i.workoutsWeek > 0 ||
    i.mood != null ||
    i.energy != null;

  return { score, label, color, pillars, topTip: weakest.tip, hasData };
}
