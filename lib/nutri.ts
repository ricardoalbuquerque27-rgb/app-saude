import { todayISO, addDaysISO, diasNaJanela, naJanela } from "@/lib/date";
import { computeAdherence } from "@/lib/planCheckIn";

// Camada de dados do lado do nutricionista. Todas as consultas rodam com o
// cliente autenticado do nutri — a RLS ("nutri reads patient") é quem libera
// as linhas dos pacientes vinculados. Nada aqui usa service role.

/**
 * Tipo de cada alerta. A tela liga uma ação a cada um (abrir a dose, a
 * prescrição, a aba de treino...), então o tipo não pode ser lido do texto.
 */
export type TipoAlerta = "dose" | "prescricao" | "parado" | "treino" | "exame";

export type Alerta = { tipo: TipoAlerta; nivel: number; texto: string };

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
  /**
   * Os mesmos alertas de `alerts`, na mesma ordem, com tipo e nível. `alerts`
   * continua só texto porque NutriHome e PacientesClient só exibem.
   */
  alertas: Alerta[];
  /**
   * Nível do alerta mais grave, de 1 (dose atrasada) a 5 (exame fora).
   * null = nenhum alerta. Mora aqui, e não é deduzido dos campos acima,
   * para os limiares (3 dias, 2 treinos) existirem num lugar só.
   */
  gravidade: number | null;
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
 * Resumo de vários pacientes de uma vez, para a Início e a lista de
 * pacientes. Consulta que falha vira lista vazia, como sempre foi ali; quem
 * precisa saber da falha usa `resumirPacientes`.
 */
export async function getPatientsSummary(
  supabase: any,
  ids: string[],
  names: Record<string, string> = {}
): Promise<PatientSummary[]> {
  return (await resumirPacientes(supabase, ids, names)).resumos;
}

/**
 * O resumo e se alguma consulta falhou. Faz 9 consultas no total,
 * independente da quantidade de pacientes (usa .in(user_id, ids)), mais 4
 * por paciente sem registro nos últimos 30 dias. A conta em si fica em
 * `montarResumos`.
 *
 * `falhou` existe porque, sem ele, uma leitura que falha vira dado falso: sem
 * as refeições o paciente aparece como "Nunca registrou nada", e sem os
 * exames o alerta de exame some calado. O detalhe do paciente mostra "Não foi
 * possível carregar" no lugar.
 */
export async function resumirPacientes(
  supabase: any,
  ids: string[],
  names: Record<string, string> = {}
): Promise<{ resumos: PatientSummary[]; falhou: boolean }> {
  if (ids.length === 0) return { resumos: [], falhou: false };

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
      // Mais recente primeiro: o `.find` de montarResumos fica com o primeiro
      // tratamento ativo de cada paciente, e com dois ativos o mais antigo
      // podia acusar "Dose atrasada" de uma dose que já não vale. É a mesma
      // regra do Clínico no detalhe do paciente.
      supabase
        .from("treatments")
        .select("user_id, next_dose_date")
        .in("user_id", ids)
        .eq("active", true)
        .order("created_at", { ascending: false }),
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

  const respostas = [
    mealsRes, wkRes, logsRes, bodyRes, examsRes, treatRes, planRes, checksRes, desviosRes,
  ];
  let falhou = respostas.some((r) => r.error);
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
  if (parados.length === 0) return { resumos, falhou };
  const ultimos = await ultimosRegistros(supabase, parados, today);
  falhou ||= ultimos.falhou;
  dados.ultimoRegistro = ultimos.datas;
  return { resumos: montarResumos(dados, ids, names, today), falhou };
}

/** Último dia com registro de cada paciente, sem limite de janela. */
async function ultimosRegistros(
  supabase: any,
  ids: string[],
  today: string
): Promise<{ datas: Record<string, string>; falhou: boolean }> {
  const datas: Record<string, string> = {};
  let falhou = false;
  const tabelas = ["meals", "workouts", "daily_logs", "body_measurements"];
  await Promise.all(
    ids.flatMap((id) =>
      tabelas.map(async (tabela) => {
        const { data, error } = await supabase
          .from(tabela)
          .select("date")
          .eq("user_id", id)
          .lte("date", today)
          .order("date", { ascending: false })
          .limit(1);
        if (error) falhou = true;
        const d = (data as any[] | null)?.[0]?.date as string | undefined;
        if (d && (!datas[id] || d > datas[id])) datas[id] = d;
      })
    )
  );
  return { datas, falhou };
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

    // Peso de 30 dias contados com naJanela: a consulta traz `>= hoje-30`
    // (31 dias) e sem teto, e uma medida lançada com data futura virava o
    // "peso atual" e a ponta da variação.
    const pesos30 = myBody.filter((b) => naJanela(b.date, today, 30));
    const weightLast = pesos30.length
      ? Number(pesos30[pesos30.length - 1].weight_kg)
      : null;
    const weightFirst = pesos30.length ? Number(pesos30[0].weight_kg) : null;
    const weightDelta30 =
      weightLast != null && weightFirst != null && pesos30.length > 1
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
      alertas: [],
      gravidade: null,
    };
    const alertar = (tipo: TipoAlerta, nivel: number, texto: string) => {
      summary.alerts.push(texto);
      summary.alertas.push({ tipo, nivel, texto });
      summary.gravidade = Math.min(summary.gravidade ?? nivel, nivel);
    };

    // Do mais grave para o menos grave: a Início e a lista de pacientes só
    // mostram os dois primeiros. Exame fica por último porque o alerta dura
    // 180 dias e não some quando o exame é refeito.
    if (doseOverdue) alertar("dose", 1, "Dose atrasada");
    if (summary.desvios > 0)
      alertar(
        "prescricao",
        2,
        `${summary.desvios} ${summary.desvios > 1 ? "mudanças" : "mudança"} na sua prescrição`
      );

    const idle = idleDays(summary, today);
    if (idle == null) alertar("parado", 3, "Nunca registrou nada");
    else if (idle >= 3) alertar("parado", 3, `${idle} dias sem registrar`);
    if (summary.planFaltas7 > 0)
      alertar(
        "treino",
        4,
        `Faltou a ${summary.planFaltas7} treino${summary.planFaltas7 > 1 ? "s" : ""} (7d)`
      );
    if (summary.planSemResposta7 >= 2)
      alertar("treino", 4, `${summary.planSemResposta7} treinos sem confirmação (7d)`);
    if (summary.alteredExams > 0)
      alertar(
        "exame",
        5,
        `${summary.alteredExams} exame${summary.alteredExams > 1 ? "s" : ""} fora da referência`
      );

    return summary;
  });
}

/**
 * A fila da Início do nutricionista: só quem tem alerta, do mais grave para
 * o menos grave. A ordem antiga, por quantidade de alertas, punha "exame
 * fora + 3 dias parado" acima de "dose atrasada".
 *
 * Desempate: mais alertas, depois mais dias parado, depois o nome, para a
 * fila não embaralhar entre uma visita e outra. Quem nunca registrou fica
 * depois de quem parou: pode ter sido convidado ontem.
 */
export function filaDeTriagem(
  resumos: PatientSummary[],
  today: string
): PatientSummary[] {
  const parado = (r: PatientSummary) => idleDays(r, today) ?? -1;
  return resumos
    .filter((r) => r.gravidade != null)
    .sort(
      (a, b) =>
        a.gravidade! - b.gravidade! ||
        b.alerts.length - a.alerts.length ||
        parado(b) - parado(a) ||
        a.name.localeCompare(b.name, "pt-BR")
    );
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

/**
 * Une todos os registros do paciente numa linha do tempo, mais recente
 * primeiro. `falhou` diz se alguma das consultas falhou: sem ele, a página
 * dizia "Nenhum registro nos últimos 30 dias" de quem tinha registros que só
 * não chegaram.
 */
export async function getPatientActivity(
  supabase: any,
  uid: string,
  sinceDays = 30,
  limit = 80
): Promise<{ itens: ActivityItem[]; falhou: boolean }> {
  const since = addDaysISO(todayISO(), -(sinceDays - 1));

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

  const falhou = [
    meals, workouts, body, logs, exams, doses, effects, checkins, planRows,
  ].some((r) => r.error);
  const itens = montarLinhaDoTempo(
    {
      meals: meals.data ?? [],
      workouts: workouts.data ?? [],
      body: body.data ?? [],
      logs: logs.data ?? [],
      exams: exams.data ?? [],
      doses: doses.data ?? [],
      effects: effects.data ?? [],
      checkins: checkins.data ?? [],
      plan: planRows.data ?? [],
    },
    todayISO(),
    sinceDays,
    limit
  );
  return { itens, falhou };
}

/** As linhas que `getPatientActivity` busca. */
export type DadosAtividade = {
  meals: any[];
  workouts: any[];
  body: any[];
  logs: any[];
  exams: any[];
  doses: any[];
  effects: any[];
  checkins: any[];
  /** Sessões do plano, só para dar nome aos check-ins. */
  plan: any[];
};

/** A linha do tempo a partir das linhas, sem banco. */
export function montarLinhaDoTempo(
  dados: DadosAtividade,
  today: string,
  dias = 30,
  limit = 80
): ActivityItem[] {
  const { meals, workouts, body, logs, exams, doses, effects, checkins, plan } =
    dados;
  const items: ActivityItem[] = [];
  const push = (
    kind: ActivityKind,
    r: any,
    title: string,
    detail?: string
  ) => {
    // A consulta só tem piso. Sem o teto, um registro com data futura
    // iria para o topo da linha do tempo.
    if (!naJanela(r.date, today, dias)) return;
    items.push({
      kind,
      date: r.date,
      at: r.created_at ?? r.date,
      title,
      detail,
    });
  };

  for (const m of meals) {
    const macros = [
      m.calories ? `${Math.round(Number(m.calories))} kcal` : null,
      m.protein_g ? `${Math.round(Number(m.protein_g))} g proteína` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    push("refeicao", m, m.description || m.meal_type || "Refeição", macros);
  }
  for (const w of workouts) {
    const d = [w.category, w.duration_min ? `${w.duration_min} min` : null]
      .filter(Boolean)
      .join(" · ");
    push("treino", w, w.name || "Treino", d);
  }
  for (const b of body) {
    const d = [
      b.body_fat_pct ? `${b.body_fat_pct}% gordura` : null,
      b.waist_cm ? `cintura ${b.waist_cm} cm` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    push("peso", b, b.weight_kg ? `Peso ${b.weight_kg} kg` : "Medidas", d);
  }
  for (const l of logs) {
    const parts = [
      l.water_ml ? `${(Number(l.water_ml) / 1000).toFixed(1)} L de água` : null,
      l.sleep_hours ? `${l.sleep_hours} h de sono` : null,
      l.steps ? `${l.steps} passos` : null,
      l.mood ? `humor: ${l.mood}` : null,
    ].filter(Boolean);
    if (parts.length) push("diario", l, "Registro do dia", parts.join(" · "));
  }
  for (const e of exams) {
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
  for (const d of doses) {
    push("dose", d, "Dose aplicada", d.dose || undefined);
  }
  for (const s of effects) {
    const parts = [
      s.nausea ? `náusea ${s.nausea}/5` : null,
      s.appetite ? `apetite ${s.appetite}/5` : null,
      s.fatigue ? `cansaço ${s.fatigue}/5` : null,
      s.other || null,
    ].filter(Boolean);
    push("efeito", s, "Efeitos colaterais", parts.join(" · "));
  }

  const planNames = new Map<string, string>();
  for (const p of plan) {
    planNames.set(p.id, p.title || p.sport || "treino do plano");
  }
  for (const c of checkins) {
    const nome = planNames.get((c as any).plan_id) || "treino do plano";
    push(
      "checkin",
      c,
      c.status === "done"
        ? `Confirmou o ${nome}`
        : `Avisou que não foi ao ${nome}`
    );
  }

  // Primeiro pelo dia a que o registro se refere, depois pela hora em que
  // foi lançado. Só pela hora, o almoço de terça lançado na quinta subia
  // para o topo, e a tela, que agrupa itens seguidos do mesmo dia,
  // repetia o cabeçalho de terça.
  items.sort((a, b) =>
    a.date !== b.date
      ? a.date < b.date ? 1 : -1
      : a.at < b.at ? 1 : a.at > b.at ? -1 : 0
  );
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

/**
 * `falhou` diz se alguma consulta falhou: sem ele, a falha virava uma série
 * de zeros, e a média da semana dizia "sem registro" de quem registrou.
 */
export async function getPatientSeries(
  supabase: any,
  uid: string,
  days = 14
): Promise<{ serie: DailySeries[]; falhou: boolean }> {
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
  return { serie: out, falhou: [meals, logs, workouts, body].some((r) => r.error) };
}

/** Média de um item na janela. `dias` diz quantos dias entraram na conta. */
export type Media = { valor: number | null; dias: number };
export type MediasDaSemana = { calorias: Media; proteina: Media; agua: Media };

/**
 * Média dos dias com registro daquele item, na janela de 7 dias até hoje.
 *
 * Dia sem registro (valor 0) fica fora da conta: zero aqui quer dizer "não
 * registrou", não "comeu 0 kcal", e puxaria a média para baixo sem motivo.
 * A água sai em ml, a mesma unidade de `water` na série.
 */
export function mediasDaSemana(serie: DailySeries[], hoje: string): MediasDaSemana {
  const janela = serie.filter((d) => naJanela(d.date, hoje, 7));
  return {
    calorias: mediaDe(janela.map((d) => d.calories)),
    proteina: mediaDe(janela.map((d) => d.protein)),
    agua: mediaDe(janela.map((d) => d.water)),
  };
}

function mediaDe(valores: number[]): Media {
  const comRegistro = valores.filter((v) => v > 0);
  if (comRegistro.length === 0) return { valor: null, dias: 0 };
  const soma = comRegistro.reduce((s, v) => s + v, 0);
  return {
    valor: Math.round(soma / comRegistro.length),
    dias: comRegistro.length,
  };
}

export type ItemMeta = "calorias" | "proteina" | "agua";
export type StatusMeta = "ok" | "atencao" | "sem-meta" | "sem-dado";
export type Comparacao = { delta: number | null; status: StatusMeta };

/**
 * Quanto o real pode fugir da meta, em %, antes de virar "atenção". Vem da
 * spec docs/superpowers/specs/2026-10-09-detalhe-paciente-design.md, Seção 4.
 * É palpite de produto, não regra clínica: se um nutricionista discordar, troque
 * os números aqui.
 *
 * Calorias erra para os dois lados, então o limite é em módulo. Proteína e água
 * só preocupam abaixo da meta.
 *
 * O status é decidido sobre o Δ JÁ ARREDONDADO, o mesmo número que a tela mostra.
 * Com o Δ cru, 10,4% sairia como "+10%" na tela e ainda assim em "atenção",
 * e o nutricionista veria um número que não bate com o alerta.
 */
const LIMITE_ATENCAO = {
  calorias: 10, // atenção quando |Δ| > 10
  proteina: -10, // atenção quando Δ < -10
  agua: -10, // atenção quando Δ < -10
};

/**
 * Real contra meta, em porcentagem. Sem meta (nula ou zero) a tela mostra
 * "Definir metas", então ela vence sobre o real ausente.
 */
export function compararComMeta(
  item: ItemMeta,
  real: number | null,
  meta: number | null
): Comparacao {
  if (meta == null || meta <= 0) return { delta: null, status: "sem-meta" };
  if (real == null) return { delta: null, status: "sem-dado" };
  const delta = Math.round((real / meta - 1) * 100);
  const atencao =
    item === "calorias"
      ? Math.abs(delta) > LIMITE_ATENCAO.calorias
      : delta < LIMITE_ATENCAO[item];
  return { delta, status: atencao ? "atencao" : "ok" };
}

/**
 * Variação de peso como a tela mostra: "−1,4 kg", "+0,6 kg", "0,0 kg". Usa o
 * sinal de menos de verdade (U+2212), como o Δ de `textoDelta`: o hífen é
 * mais curto que o "+" e desalinha números `tabular-nums` um embaixo do
 * outro. O que arredonda para zero sai sem sinal: "−0,0 kg" diria que o peso
 * caiu. Sem variação medida (uma medida só, ou nenhuma), "—".
 */
export function textoVariacaoPeso(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const arredondado = Math.round(delta * 10) / 10;
  const numero = Math.abs(arredondado).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (arredondado === 0) return `${numero} kg`;
  return `${arredondado > 0 ? "+" : "−"}${numero} kg`;
}

/**
 * De quantos dias saiu a média de um item (ver `mediasDaSemana`). A tela
 * precisa dizer: "1.650 kcal" de 2 dias e de 7 dias são coisas diferentes, e
 * o dia sem registro não entra na conta.
 */
export function notaMedia(dias: number): string {
  if (dias <= 0) return "sem registro nos últimos 7 dias";
  return `média de ${dias} ${dias === 1 ? "dia" : "dias"} com registro`;
}

/**
 * A mesma nota para a tabela do computador, que tem uma linha por item e
 * nenhum lugar para uma nota por linha. Calorias e proteína vêm das mesmas
 * refeições e quase sempre empatam; a água vem do registro do dia e pode
 * diferir, e aí cada item diz o seu número.
 */
export function notaDasMedias(m: MediasDaSemana): string {
  const { calorias, proteina, agua } = m;
  if (calorias.dias === 0 && proteina.dias === 0 && agua.dias === 0) {
    return "Sem registro nos últimos 7 dias.";
  }
  if (calorias.dias === proteina.dias && proteina.dias === agua.dias) {
    return `Real: ${notaMedia(calorias.dias)}.`;
  }
  return (
    "Real: média dos dias com registro nos últimos 7 dias — " +
    `calorias em ${calorias.dias}, proteína em ${proteina.dias}, água em ${agua.dias}.`
  );
}

/**
 * Um aviso por meta: o mais recente de cada campo, do mais novo para o mais
 * velho. O paciente que muda as calorias duas vezes antes de o nutricionista
 * olhar fica com dois avisos abertos, e só o último diz o que ele está usando
 * agora. Não depende da ordem em que a consulta trouxe as linhas.
 */
export function ultimoDesvioPorCampo<
  T extends { field: string; created_at: string },
>(desvios: T[]): T[] {
  const porCampo = new Map<string, T>();
  for (const d of desvios) {
    const atual = porCampo.get(d.field);
    if (!atual || d.created_at > atual.created_at) porCampo.set(d.field, d);
  }
  return Array.from(porCampo.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );
}

/** As quatro metas de uma prescrição, como `set_patient_goals` as grava. */
export type MetasPrescritas = {
  daily_calorie_goal: number | null;
  protein_goal_g: number | null;
  daily_water_goal_ml: number | null;
  weight_goal_kg: number | null;
};

/**
 * A prescrição mais recente do paciente, ou `data` nulo se o nutricionista
 * nunca definiu metas. Devolve `{ data, error }` sem engolir o erro: a tela
 * precisa separar "não tem" de "falhou". É `async` de propósito: o construtor
 * do supabase-js é um thenable que refaz a consulta a cada `await`, e a
 * página divide esta mesma promessa entre a fila, a Alimentação e o Corpo.
 */
export async function getUltimaPrescricao(
  supabase: any,
  uid: string
): Promise<{ data: MetasPrescritas | null; error: unknown }> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("daily_calorie_goal, protein_goal_g, daily_water_goal_ml, weight_goal_kg")
    .eq("patient_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: (data as MetasPrescritas | null) ?? null, error };
}

/**
 * Os campos de META que `set_patient_goals` grava. A tabela
 * prescription_deviations recebe também avisos do plano de treino (o gatilho
 * de workout_plan), e esses não são metas: mostrá-los em Alimentação poria
 * uma sessão de treino apagada entre as metas, com o nome cru da coluna.
 * Mesmo assim, qualquer `set_patient_goals` (Reaplicar ou Aplicar metas) dá
 * baixa neles também, pelo gatilho prescriptions_ack_deviations. Tudo o que
 * é "desvio de meta" filtra por esta lista.
 */
export const CAMPOS_META = [
  "daily_calorie_goal",
  "protein_goal_g",
  "daily_water_goal_ml",
  "weight_goal_kg",
] as const;
export type CampoMeta = (typeof CAMPOS_META)[number];

/**
 * Uma meta como a tela a mostra: "1.800 kcal", "110 g", "2,5 L", "62,5 kg".
 * A água é gravada em ml e lida em litros, com uma casa, na tabela real ×
 * meta; o aviso de desvio e o editor usam esta mesma função para a mesma
 * meta não aparecer em duas unidades na mesma seção.
 */
export function textoDaMeta(campo: CampoMeta, valor: number): string {
  switch (campo) {
    case "daily_calorie_goal":
      return `${Math.round(valor).toLocaleString("pt-BR")} kcal`;
    case "protein_goal_g":
      return `${Math.round(valor).toLocaleString("pt-BR")} g`;
    case "daily_water_goal_ml":
      return `${(valor / 1000).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} L`;
    case "weight_goal_kg":
      return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
  }
}

/**
 * "ela está usando 2.200 kcal": o que o paciente pôs no lugar da meta
 * prescrita. O gatilho grava o valor como texto ("2200"); sem valor, o
 * paciente apagou a meta. O pronome sai do sexo do perfil, e sem ele a frase
 * não adivinha.
 */
export function textoDoDesvio(
  d: { field: string; current_value: string | null },
  sexo: string | null
): string {
  const quem = pronome(sexo);
  if (d.current_value == null || d.current_value === "") {
    return `${quem} está sem meta`;
  }
  const n = Number(d.current_value);
  const campo = CAMPOS_META.find((c) => c === d.field);
  const valor =
    campo && Number.isFinite(n) ? textoDaMeta(campo, n) : d.current_value;
  return `${quem} está usando ${valor}`;
}

/** "ela", "ele" ou, sem sexo no perfil, "o paciente": a frase não adivinha. */
function pronome(sexo: string | null): string {
  return sexo === "F" ? "ela" : sexo === "M" ? "ele" : "o paciente";
}

/**
 * Um aviso de mudança no plano de treino, como o aviso antigo da Prescrição
 * o escrevia ("você definiu X, está Y"), lendo as mesmas colunas: `prescribed`
 * é a sessão que o nutricionista pôs no plano e `current_value` o que há no
 * lugar dela agora. Sem valor atual, a sessão saiu do plano, do mesmo jeito
 * que meta sem valor é meta apagada (textoDoDesvio). Sem o prescrito, um
 * traço, como no aviso antigo.
 */
export function textoDoDesvioDoPlano(
  d: { prescribed: string | null; current_value: string | null },
  sexo: string | null
): string {
  const quem = pronome(sexo);
  const antes = d.prescribed?.trim() || "—";
  const agora = d.current_value?.trim();
  return agora
    ? `você definiu ${antes}; ${quem} está com ${agora}`
    : `você definiu ${antes}; ${quem} está sem essa sessão`;
}

/** Um aviso aberto em prescription_deviations: de meta ou do plano de treino. */
export type Desvio = {
  id: string;
  field: string;
  prescribed: string | null;
  current_value: string | null;
  created_at: string;
};

const ehCampoMeta = (field: string): field is CampoMeta =>
  (CAMPOS_META as readonly string[]).includes(field);

/**
 * Os avisos abertos, separados: os de META (Alimentação, e o que decide se
 * Reaplicar aparece na fila) e os do PLANO de treino (o Treino os lista, e a
 * fila avisa que Reaplicar também dá baixa neles). O que não é campo de meta
 * vai para o plano: o gatilho do workout_plan é a outra fonte da tabela, e um
 * aviso que não coubesse em nenhum lado sumiria calado.
 */
export function separarDesvios<T extends { field: string }>(
  desvios: T[]
): { meta: (T & { field: CampoMeta })[]; plano: T[] } {
  const meta: (T & { field: CampoMeta })[] = [];
  const plano: T[] = [];
  for (const d of desvios) {
    if (ehCampoMeta(d.field)) meta.push(d as T & { field: CampoMeta });
    else plano.push(d);
  }
  return { meta, plano };
}

/**
 * Os avisos ainda abertos do paciente, de meta e do plano de treino, numa
 * consulta só: quem precisa de um lado filtra com separarDesvios. Devolve
 * `{ data, error }` sem engolir o erro, e é `async` pelo mesmo motivo de
 * getUltimaPrescricao: a página divide a promessa entre a fila, a
 * Alimentação e o Treino.
 */
export async function getDesviosAbertos(
  supabase: any,
  uid: string
): Promise<{ data: Desvio[]; error: unknown }> {
  const { data, error } = await supabase
    .from("prescription_deviations")
    .select("id, field, prescribed, current_value, created_at")
    .eq("patient_id", uid)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false });
  return { data: (data as Desvio[] | null) ?? [], error };
}
