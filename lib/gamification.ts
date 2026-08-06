// Sistema de gamificação — tudo calculado a partir dos registros existentes.

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  icon: string; // nome do ícone lucide (mapeado na página)
  unlocked: boolean;
};

export type Gamification = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  progress: number; // 0..1
  current: number; // sequência atual (dias)
  best: number; // melhor sequência
  totalRecords: number;
  counts: {
    workouts: number;
    meals: number;
    dailyLogs: number;
    measurements: number;
    exams: number;
    reports: number;
    plan: number;
  };
  achievements: Achievement[];
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const XP_PER_LEVEL = 250;

export async function getGamification(
  supabase: any,
  uid: string
): Promise<Gamification> {
  const headCount = (table: string) =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);

  const [
    wCount,
    mCount,
    dCount,
    bCount,
    eCount,
    rCount,
    pCount,
    mealDates,
    workoutDates,
    logRows,
    measDates,
    profileRes,
  ] = await Promise.all([
    headCount("workouts"),
    headCount("meals"),
    headCount("daily_logs"),
    headCount("body_measurements"),
    headCount("exams"),
    headCount("reports"),
    headCount("workout_plan"),
    supabase.from("meals").select("date").eq("user_id", uid).limit(500),
    supabase.from("workouts").select("date").eq("user_id", uid).limit(500),
    supabase
      .from("daily_logs")
      .select("date, water_ml")
      .eq("user_id", uid)
      .limit(500),
    supabase.from("body_measurements").select("date").eq("user_id", uid).limit(500),
    supabase
      .from("profiles")
      .select("daily_water_goal_ml")
      .eq("id", uid)
      .maybeSingle(),
  ]);

  const counts = {
    workouts: wCount.count ?? 0,
    meals: mCount.count ?? 0,
    dailyLogs: dCount.count ?? 0,
    measurements: bCount.count ?? 0,
    exams: eCount.count ?? 0,
    reports: rCount.count ?? 0,
    plan: pCount.count ?? 0,
  };

  // Conjunto de datas com qualquer registro
  const dateSet = new Set<string>();
  const addDates = (rows: any[] | null) =>
    (rows ?? []).forEach((r) => r?.date && dateSet.add(r.date));
  addDates(mealDates.data);
  addDates(workoutDates.data);
  addDates(logRows.data);
  addDates(measDates.data);

  // Sequência atual (permite terminar em ontem, para não zerar durante o dia)
  let day = new Date();
  if (!dateSet.has(iso(day))) day.setDate(day.getDate() - 1);
  let current = 0;
  while (dateSet.has(iso(day))) {
    current++;
    day.setDate(day.getDate() - 1);
  }

  // Melhor sequência
  const sorted = Array.from(dateSet).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const s of sorted) {
    if (prev) {
      const diff =
        (new Date(s + "T00:00:00").getTime() -
          new Date(prev + "T00:00:00").getTime()) /
        86400000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = s;
  }

  const waterGoal = profileRes.data?.daily_water_goal_ml ?? 2500;
  const waterGoalHit = (logRows.data ?? []).some(
    (l: any) => (Number(l.water_ml) || 0) >= waterGoal
  );

  const xp =
    counts.workouts * 15 +
    counts.meals * 6 +
    counts.dailyLogs * 5 +
    counts.measurements * 10 +
    counts.exams * 12 +
    counts.reports * 20 +
    counts.plan * 4;

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const progress = xpIntoLevel / XP_PER_LEVEL;

  const totalRecords =
    counts.workouts +
    counts.meals +
    counts.dailyLogs +
    counts.measurements +
    counts.exams;

  const s = { ...counts, current, best, totalRecords, waterGoalHit };

  const raw: (Omit<Achievement, "unlocked"> & { test: (x: typeof s) => boolean })[] = [
    { id: "inicio", title: "Primeiro passo", desc: "Fez seu primeiro registro", icon: "Footprints", test: (x) => x.totalRecords >= 1 },
    { id: "treino1", title: "Bora treinar", desc: "Registrou o primeiro treino", icon: "Dumbbell", test: (x) => x.workouts >= 1 },
    { id: "treino10", title: "Dedicado", desc: "10 treinos registrados", icon: "Dumbbell", test: (x) => x.workouts >= 10 },
    { id: "treino50", title: "Atleta", desc: "50 treinos registrados", icon: "Medal", test: (x) => x.workouts >= 50 },
    { id: "dieta10", title: "Nutrição em dia", desc: "10 refeições registradas", icon: "Salad", test: (x) => x.meals >= 10 },
    { id: "agua", title: "Hidratado", desc: "Bateu a meta de água em um dia", icon: "Droplets", test: (x) => x.waterGoalHit },
    { id: "streak7", title: "Constância", desc: "7 dias seguidos registrando", icon: "Flame", test: (x) => x.best >= 7 },
    { id: "streak30", title: "Imparável", desc: "30 dias seguidos registrando", icon: "Zap", test: (x) => x.best >= 30 },
    { id: "medidas5", title: "Em evolução", desc: "5 medições corporais", icon: "Scale", test: (x) => x.measurements >= 5 },
    { id: "exame", title: "De olho na saúde", desc: "Registrou um exame", icon: "FileText", test: (x) => x.exams >= 1 },
    { id: "relatorio", title: "Analista", desc: "Gerou um relatório", icon: "BarChart3", test: (x) => x.reports >= 1 },
    { id: "plano", title: "Planejador", desc: "Montou o plano semanal", icon: "CalendarDays", test: (x) => x.plan >= 1 },
  ];

  const achievements: Achievement[] = raw.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    icon: a.icon,
    unlocked: a.test(s),
  }));

  return {
    xp,
    level,
    xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    progress,
    current,
    best,
    totalRecords,
    counts,
    achievements,
  };
}
