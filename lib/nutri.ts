import { todayISO, addDaysISO, diasNaJanela, naJanela } from "@/lib/date";
import { computeAdherence } from "@/lib/planCheckIn";

// Camada de dados do lado do nutricionista. Todas as consultas rodam com o
// cliente autenticado do nutri — a RLS ("nutri reads patient") é quem libera
// as linhas dos pacientes vinculados. Nada aqui usa service role.

export type PatientSummary = {
  id: string;
  name: string;
  /** Último dia com QUALQUER registro (refeição, treino, log diário, medida). */
  lastActivity: string | null;
  /** Dias distintos com registro nos últimos 7 dias (0–7). */
  daysLogged7: number;
  caloriesToday: number;
  proteinToday: number;
  waterToday: number;
  workouts7: number;
  weightLast: number | null;
  weightDelta30: number | null;
  alteredExams: number;
  nextDose: string | null;
  doseOverdue: boolean;
  /** Adesão ao plano de treino nos últimos 7 dias (só dias já vencidos). */
  planPrevistas7: number;
  planConfirmadas7: number;
  planFaltas7: number;
  planSemResposta7: number;
  /** Divergências abertas entre o prescrito e o que está valendo. */
  desvios: number;
  /** Motivos de atenção, já em texto pronto para exibir. */
  alerts: string[];
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((da - db) / 86400000);
}

/** Quantos dias sem registrar nada. null = nunca registrou. */
export function idleDays(s: PatientSummary, today = todayISO()): number | null {
  if (!s.lastActivity) return null;
  return Math.max(0, daysBetween(today, s.lastActivity));
}

/**
 * Resumo de vários pacientes de uma vez. Faz 9 consultas no total,
 * independente da quantidade de pacientes (usa .in(user_id, ids)), mais 4
 * por paciente sem registro nos últimos 30 dias. A conta em si fica em
 * `montarResumos`.
 */
export async function getPatientsSummary(
  supabase: any,
  ids: string[],
  names: Record<string, string> = {}
): Promise<PatientSummary[]> {
  if (ids.length === 0) return [];

  const today = todayISO();
  // -6, não -7: a comparação é >=, então de hoje-6 até hoje dá 7 dias.
  // Com -7 a janela pegava 8 e o painel mostrava "8 de 7 dias", 114% de
  // adesão. O dias28 logo abaixo já era montado certo, o que mostra que
  // isto era engano e não convenção.
  const d7 = addDaysISO(today, -6);
  const d30 = addDaysISO(today, -30);
  const d180 = addDaysISO(today, -180);

  const [
    mealsRes, wkRes, logsRes, bodyRes, examsRes, treatRes, planRes, checksRes, desviosRes,
  ] = await Promise.all([
      supabase
        .from("meals")
        .select("user_id, date, calories, protein_g")
        .in("user_id", ids)
        .gte("date", d30),
      supabase
        .from("workouts")
        .select("user_id, date")
        .in("user_id", ids)
        .gte("date", d30),
      supabase
        .from("daily_logs")
        .select("user_id, date, water_ml")
        .in("user_id", ids)
        .gte("date", d30),
      supabase
        .from("body_measurements")
        .select("user_id, date, weight_kg")
        .in("user_id", ids)
        .not("weight_kg", "is", null)
        .gte("date", d30)
        .order("date", { ascending: true }),
      supabase
        .from("exams")
        .select("user_id, status")
        .in("user_id", ids)
        .neq("status", "normal")
        .gte("date", d180),
      supabase
        .from("treatments")
        .select("user_id, next_dose_date")
        .in("user_id", ids)
        .eq("active", true),
      supabase
        .from("workout_plan")
        .select("id, user_id, day_of_week, sport")
        .in("user_id", ids),
      supabase
        .from("plan_completions")
        .select("user_id, plan_id, date, status")
        .in("user_id", ids)
        .gte("date", d7),
      supabase
        .from("prescription_deviations")
        .select("patient_id")
        .in("patient_id", ids)
        .is("acknowledged_at", null),
    ]);

  const dados: DadosResumo = {
    meals: mealsRes.data ?? [],
    workouts: wkRes.data ?? [],
    logs: logsRes.data ?? [],
    body: bodyRes.data ?? [],
    exams: examsRes.data ?? [],
    treatments: treatRes.data ?? [],
    plan: planRes.data ?? [],
    checks: checksRes.data ?? [],
    desvios: desviosRes.data ?? [],
  };
  const resumos = montarResumos(dados, ids, names, today);

  // Quem não tem nada nos 30 dias pode ter parado há 45 ou nunca ter
  // começado. Só para esses vai uma consulta a mais por tabela; quem está
  // ativo não paga nada.
  const parados = resumos.filter((r) => r.lastActivity == null).map((r) => r.id);
  if (parados.length === 0) return resumos;
  dados.ultimoRegistro = await ultimosRegistros(supabase, parados, today);
  return montarResumos(dados, ids, names, today);
}

/** Último dia com registro de cada paciente, sem limite de janela. */
async function ultimosRegistros(
  supabase: any,
  ids: string[],
  today: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const tabelas = ["meals", "workouts", "daily_logs", "body_measurements"];
  await Promise.all(
    ids.flatMap((id) =>
      tabelas.map(async (tabela) => {
        const { data } = await supabase
          .from(tabela)
          .select("date")
          .eq("user_id", id)
          .lte("date", today)
          .order("date", { ascending: false })
          .limit(1);
        const d = (data as any[] | null)?.[0]?.date as string | undefined;
        if (d && (!out[id] || d > out[id])) out[id] = d;
      })
    )
  );
  return out;
}

/** As linhas que `getPatientsSummary` busca, já de todos os pacientes juntos. */
export type DadosResumo = {
  meals: any[];
  workouts: any[];
  logs: any[];
  /** Só medidas com peso, em ordem crescente de data. */
  body: any[];
  /** Só exames fora do normal. */
  exams: any[];
  /** Só tratamentos ativos. */
  treatments: any[];
  plan: any[];
  checks: any[];
  desvios: any[];
  /**
   * Último dia com registro de quem não tem nenhum nos 30 dias que as
   * consultas trazem. Sem isto, quem parou há 45 dias virava "Nunca
   * registrou nada".
   */
  ultimoRegistro?: Record<string, string>;
};

/**
 * A conta do resumo, separada das consultas para poder ser testada sem
 * banco. `today` entra como parâmetro pelo mesmo motivo.
 */
export function montarResumos(
  dados: DadosResumo,
  ids: string[],
  names: Record<string, string>,
  today: string
): PatientSummary[] {
  const { meals, workouts, logs, body, exams, treatments, plan, checks, desvios } =
    dados;

  // Datas dos últimos 7 dias já vencidos (inclui hoje), para cruzar o plano
  // — que é um molde por dia da semana — com os check-ins reais.
  const janela7: string[] = [];
  for (let i = 6; i >= 0; i--) janela7.push(addDaysISO(today, -i));

  return ids.map((id) => {
    const myMeals = meals.filter((m) => m.user_id === id);
    const myWk = workouts.filter((w) => w.user_id === id);
    const myLogs = logs.filter((l) => l.user_id === id);
    const myBody = body.filter((b) => b.user_id === id);

    // Dias com atividade — união das quatro fontes. Data futura fica de
    // fora: com ela, quem está parado aparecia como "Registrou hoje".
    const activeDays = new Set<string>();
    for (const r of [...myMeals, ...myWk, ...myLogs, ...myBody]) {
      if (r.date && r.date <= today) activeDays.add(r.date as string);
    }
    const sortedDays = Array.from(activeDays).sort();
    const lastActivity = sortedDays.length
      ? sortedDays[sortedDays.length - 1]
      : dados.ultimoRegistro?.[id] ?? null;
    // A janela mora em lib/date.ts e tem teste. Escrita à mão aqui, ela já
    // errou de duas formas: abrangendo oito dias e deixando entrar data
    // futura.
    const daysLogged7 = diasNaJanela(sortedDays, today, 7);

    const todayMeals = myMeals.filter((m) => m.date === today);
    const caloriesToday = todayMeals.reduce(
      (s, m) => s + (Number(m.calories) || 0),
      0
    );
    const proteinToday = todayMeals.reduce(
      (s, m) => s + (Number(m.protein_g) || 0),
      0
    );
    const waterToday = myLogs
      .filter((l) => l.date === today)
      .reduce((s, l) => s + (Number(l.water_ml) || 0), 0);

    const weightLast = myBody.length
      ? Number(myBody[myBody.length - 1].weight_kg)
      : null;
    const weightFirst = myBody.length ? Number(myBody[0].weight_kg) : null;
    const weightDelta30 =
      weightLast != null && weightFirst != null && myBody.length > 1
        ? Number((weightLast - weightFirst).toFixed(1))
        : null;

    // Adesão ao plano nos últimos 7 dias. A mesma conta da aba do
    // paciente: era uma cópia à mão do computeAdherence, e duas cópias da
    // mesma regra acabam discordando entre a lista e o detalhe.
    const adesao = computeAdherence(
      plan.filter(
        (x) =>
          x.user_id === id &&
          !String(x.sport ?? "").toLowerCase().includes("descanso")
      ),
      checks.filter((c) => c.user_id === id),
      janela7,
      today
    );

    const nextDose = treatments.find((t) => t.user_id === id)?.next_dose_date ?? null;
    const doseOverdue = !!nextDose && nextDose < today;

    const summary: PatientSummary = {
      id,
      name: names[id] || "Paciente",
      lastActivity,
      daysLogged7,
      caloriesToday,
      proteinToday,
      waterToday,
      workouts7: myWk.filter((w) => naJanela(w.date, today, 7)).length,
      weightLast,
      weightDelta30,
      alteredExams: exams.filter((e) => e.user_id === id).length,
      nextDose,
      doseOverdue,
      planPrevistas7: adesao.previstas,
      planConfirmadas7: adesao.confirmadas,
      planFaltas7: adesao.faltas,
      planSemResposta7: adesao.semResposta,
      desvios: desvios.filter((d) => d.patient_id === id).length,
      alerts: [],
    };

    if (summary.desvios > 0)
      summary.alerts.push(
        `${summary.desvios} ${summary.desvios > 1 ? "mudanças" : "mudança"} na sua prescrição`
      );

    const idle = idleDays(summary, today);
    if (idle == null) summary.alerts.push("Nunca registrou nada");
    else if (idle >= 3) summary.alerts.push(`${idle} dias sem registrar`);
    if (doseOverdue) summary.alerts.push("Dose atrasada");
    if (summary.planFaltas7 > 0)
      summary.alerts.push(
        `Faltou a ${summary.planFaltas7} treino${summary.planFaltas7 > 1 ? "s" : ""} (7d)`
      );
    if (summary.planSemResposta7 >= 2)
      summary.alerts.push(
        `${summary.planSemResposta7} treinos sem confirmação (7d)`
      );
    if (summary.alteredExams > 0)
      summary.alerts.push(
        `${summary.alteredExams} exame${summary.alteredExams > 1 ? "s" : ""} fora da referência`
      );

    return summary;
  });
}

// ---------------------------------------------------------------------------
// Linha do tempo de um paciente
// ---------------------------------------------------------------------------

export type ActivityKind =
  | "refeicao"
  | "treino"
  | "peso"
  | "diario"
  | "exame"
  | "dose"
  | "efeito"
  | "checkin";

export type ActivityItem = {
  kind: ActivityKind;
  date: string;
  at: string; // created_at, para ordenar dentro do dia
  title: string;
  detail?: string;
};

/** Une todos os registros do paciente numa linha do tempo, mais recente primeiro. */
export async function getPatientActivity(
  supabase: any,
  uid: string,
  sinceDays = 30,
  limit = 80
): Promise<ActivityItem[]> {
  const since = addDaysISO(todayISO(), -sinceDays);

  const [meals, workouts, body, logs, exams, doses, effects, checkins, planRows] =
    await Promise.all([
      supabase
        .from("meals")
        .select("date, created_at, meal_type, description, calories, protein_g")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("workouts")
        .select("date, created_at, name, category, duration_min")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("body_measurements")
        .select("date, created_at, weight_kg, body_fat_pct, waist_cm")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("daily_logs")
        .select("date, created_at, water_ml, sleep_hours, mood, energy, steps")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("exams")
        .select("date, created_at, title, result_value, unit, status")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("dose_logs")
        .select("date, created_at, dose")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("side_effects")
        .select("date, created_at, nausea, appetite, fatigue, other")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("plan_completions")
        .select("date, created_at, status, plan_id")
        .eq("user_id", uid)
        .gte("date", since),
      // Nomes das sessões do plano, para rotular os check-ins. Consulta à
      // parte de propósito: um select aninhado dependeria do PostgREST
      // resolver a FK, e o plano é pequeno o bastante para não valer o risco.
      supabase
        .from("workout_plan")
        .select("id, sport, title")
        .eq("user_id", uid),
    ]);

  const items: ActivityItem[] = [];
  const push = (
    kind: ActivityKind,
    r: any,
    title: string,
    detail?: string
  ) => {
    items.push({
      kind,
      date: r.date,
      at: r.created_at ?? r.date,
      title,
      detail,
    });
  };

  for (const m of meals.data ?? []) {
    const macros = [
      m.calories ? `${Math.round(Number(m.calories))} kcal` : null,
      m.protein_g ? `${Math.round(Number(m.protein_g))} g proteína` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    push("refeicao", m, m.description || m.meal_type || "Refeição", macros);
  }
  for (const w of workouts.data ?? []) {
    const d = [w.category, w.duration_min ? `${w.duration_min} min` : null]
      .filter(Boolean)
      .join(" · ");
    push("treino", w, w.name || "Treino", d);
  }
  for (const b of body.data ?? []) {
    const d = [
      b.body_fat_pct ? `${b.body_fat_pct}% gordura` : null,
      b.waist_cm ? `cintura ${b.waist_cm} cm` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    push("peso", b, b.weight_kg ? `Peso ${b.weight_kg} kg` : "Medidas", d);
  }
  for (const l of logs.data ?? []) {
    const parts = [
      l.water_ml ? `${(Number(l.water_ml) / 1000).toFixed(1)} L de água` : null,
      l.sleep_hours ? `${l.sleep_hours} h de sono` : null,
      l.steps ? `${l.steps} passos` : null,
      l.mood ? `humor: ${l.mood}` : null,
    ].filter(Boolean);
    if (parts.length) push("diario", l, "Registro do dia", parts.join(" · "));
  }
  for (const e of exams.data ?? []) {
    push(
      "exame",
      e,
      `Exame: ${e.title}`,
      [
        e.result_value ? `${e.result_value}${e.unit ? ` ${e.unit}` : ""}` : null,
        e.status,
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }
  for (const d of doses.data ?? []) {
    push("dose", d, "Dose aplicada", d.dose || undefined);
  }
  for (const s of effects.data ?? []) {
    const parts = [
      s.nausea ? `náusea ${s.nausea}/5` : null,
      s.appetite ? `apetite ${s.appetite}/5` : null,
      s.fatigue ? `cansaço ${s.fatigue}/5` : null,
      s.other || null,
    ].filter(Boolean);
    push("efeito", s, "Efeitos colaterais", parts.join(" · "));
  }

  const planNames = new Map<string, string>();
  for (const p of (planRows.data ?? []) as any[]) {
    planNames.set(p.id, p.title || p.sport || "treino do plano");
  }
  for (const c of checkins.data ?? []) {
    const nome = planNames.get((c as any).plan_id) || "treino do plano";
    push(
      "checkin",
      c,
      c.status === "done"
        ? `Confirmou o ${nome}`
        : `Avisou que não foi ao ${nome}`
    );
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items.slice(0, limit);
}

/** Série diária dos últimos N dias — para os mini-gráficos do painel. */
export type DailySeries = {
  date: string;
  calories: number;
  protein: number;
  water: number;
  sleep: number | null;
  workouts: number;
  weight: number | null;
};

export async function getPatientSeries(
  supabase: any,
  uid: string,
  days = 14
): Promise<DailySeries[]> {
  const today = todayISO();
  const since = addDaysISO(today, -(days - 1));

  const [meals, logs, workouts, body] = await Promise.all([
    supabase
      .from("meals")
      .select("date, calories, protein_g")
      .eq("user_id", uid)
      .gte("date", since),
    supabase
      .from("daily_logs")
      .select("date, water_ml, sleep_hours")
      .eq("user_id", uid)
      .gte("date", since),
    supabase
      .from("workouts")
      .select("date")
      .eq("user_id", uid)
      .gte("date", since),
    supabase
      .from("body_measurements")
      .select("date, weight_kg")
      .eq("user_id", uid)
      .not("weight_kg", "is", null)
      .gte("date", since),
  ]);

  const out: DailySeries[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(today, -i);
    const dayMeals = (meals.data ?? []).filter((m: any) => m.date === date);
    const dayLog = (logs.data ?? []).find((l: any) => l.date === date);
    const dayBody = (body.data ?? []).filter((b: any) => b.date === date);
    out.push({
      date,
      calories: dayMeals.reduce(
        (s: number, m: any) => s + (Number(m.calories) || 0),
        0
      ),
      protein: dayMeals.reduce(
        (s: number, m: any) => s + (Number(m.protein_g) || 0),
        0
      ),
      water: Number(dayLog?.water_ml) || 0,
      sleep: dayLog?.sleep_hours != null ? Number(dayLog.sleep_hours) : null,
      workouts: (workouts.data ?? []).filter((w: any) => w.date === date).length,
      weight: dayBody.length ? Number(dayBody[dayBody.length - 1].weight_kg) : null,
    });
  }
  return out;
}
