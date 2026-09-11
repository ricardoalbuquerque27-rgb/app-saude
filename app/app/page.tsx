import Link from "next/link";
import {
  Dumbbell,
  Flame,
  Scale,
  ArrowRight,
  Camera,
  CalendarDays,
  Syringe,
  HeartPulse,
  ChevronRight,
  MessageCircle,
  BarChart3,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrendChart } from "@/components/charts";
import OpenChatButton from "@/components/OpenChatButton";
import { ProgressRing } from "@/components/ProgressRing";
import { todayISO, addDaysISO, formatDate } from "@/lib/date";
import { computeHealthScore } from "@/lib/healthScore";
import { getPending } from "@/lib/pending";
import NutriHome from "@/components/NutriHome";
import PlanCheckIn from "@/components/PlanCheckIn";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const today = todayISO();

  // Nutricionista tem uma home própria (visão macro da carteira); nada do
  // dashboard de paciente abaixo é carregado para ele.
  const { data: roleRow } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", uid)
    .maybeSingle();
  if ((roleRow as any)?.role === "nutritionist") {
    return (
      <NutriHome
        firstName={((roleRow as any)?.full_name || "Nutri").split(" ")[0]}
        today={today}
      />
    );
  }

  const weekAgo = addDaysISO(today, -7);
  const dow = (new Date(today + "T12:00:00").getDay() + 6) % 7; // 0 = Segunda

  const [
    profileRes,
    workoutsWeekRes,
    mealsTodayRes,
    measurementsRes,
    dailyTodayRes,
    recentWorkoutsRes,
    todayPlanRes,
    treatmentRes,
    todayCompletionsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("date", weekAgo),
    supabase
      .from("meals")
      .select("calories, protein_g")
      .eq("user_id", uid)
      .eq("date", today),
    supabase
      .from("body_measurements")
      .select("date, weight_kg")
      .eq("user_id", uid)
      .not("weight_kg", "is", null)
      .order("date", { ascending: true })
      .limit(60),
    supabase
      .from("daily_logs")
      .select("water_ml, sleep_hours, mood, energy")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, date, name, category")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("workout_plan")
      .select("id, sport, title, day_of_week")
      .eq("user_id", uid)
      .eq("day_of_week", dow)
      .order("position", { ascending: true }),
    supabase
      .from("treatments")
      .select("medication, dose, next_dose_date")
      .eq("user_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("plan_completions")
      .select("id, plan_id, date, status, workout_id")
      .eq("user_id", uid)
      .eq("date", today),
  ]);

  const profile = profileRes.data;
  const firstName = (profile?.full_name || "Atleta").split(" ")[0];

  const workoutsWeek = workoutsWeekRes.count ?? 0;
  const caloriesToday = (mealsTodayRes.data ?? []).reduce(
    (s, m) => s + (Number(m.calories) || 0),
    0
  );
  const proteinToday = (mealsTodayRes.data ?? []).reduce(
    (s, m) => s + (Number(m.protein_g) || 0),
    0
  );
  const measurements = measurementsRes.data ?? [];
  const currentWeight =
    measurements.length > 0
      ? measurements[measurements.length - 1].weight_kg
      : null;
  const waterToday = dailyTodayRes.data?.water_ml ?? 0;
  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const calorieGoal = profile?.daily_calorie_goal ?? null;
  const proteinGoal = profile?.protein_goal_g ?? null;
  const sleepToday = dailyTodayRes.data?.sleep_hours ?? null;
  const recentWorkouts = recentWorkoutsRes.data ?? [];
  const todayPlan = todayPlanRes.data ?? [];
  const todayCompletions = todayCompletionsRes.data ?? [];

  const health = computeHealthScore({
    sleepHours: sleepToday,
    trainedToday: recentWorkouts.some((w) => w.date === today),
    workoutsWeek,
    mealsLoggedToday: (mealsTodayRes.data ?? []).length,
    proteinToday,
    proteinGoal,
    caloriesToday,
    calorieGoal,
    waterToday,
    waterGoal,
    mood: (dailyTodayRes.data as any)?.mood ?? null,
    energy: (dailyTodayRes.data as any)?.energy ?? null,
  });
  const healthColor =
    health.color === "brand"
      ? "text-brand-500"
      : health.color === "amber"
        ? "text-amber-500"
        : "text-rose-500";

  // Um único conjunto de números do dia. Antes o mesmo dado aparecia em três
  // blocos seguidos: pilares do Score, anéis e mini-stats.
  const rings = [
    {
      label: "Calorias",
      colorClass: "text-amber-500",
      pct: calorieGoal ? caloriesToday / calorieGoal : 0,
      centerMain: `${Math.round(caloriesToday)}`,
      centerSub: calorieGoal ? `/ ${calorieGoal}` : "kcal",
    },
    {
      label: "Água",
      colorClass: "text-blue-500",
      pct: waterGoal ? waterToday / waterGoal : 0,
      centerMain: `${(waterToday / 1000).toFixed(1)}`,
      centerSub: `/ ${(waterGoal / 1000).toFixed(1)} L`,
    },
    {
      label: "Proteína",
      colorClass: "text-rose-500",
      pct: proteinGoal ? proteinToday / proteinGoal : 0,
      centerMain: `${Math.round(proteinToday)}`,
      centerSub: proteinGoal ? `/ ${proteinGoal} g` : "g",
    },
  ];

  const pending = await getPending(supabase, uid);

  const treatment = treatmentRes.data;
  let doseLabel: string | null = null;
  let doseUrgent = false;
  if (treatment?.next_dose_date) {
    const diff = Math.round(
      (new Date(treatment.next_dose_date + "T00:00:00").getTime() -
        new Date(today + "T00:00:00").getTime()) /
        86400000
    );
    if (diff < 0) {
      doseLabel = "Aplicação atrasada";
      doseUrgent = true;
    } else if (diff === 0) {
      doseLabel = "Hoje é dia da aplicação";
      doseUrgent = true;
    } else if (diff === 1) {
      doseLabel = "Aplicação amanhã";
    } else {
      doseLabel = `Aplicação em ${diff} dias`;
    }
  }

  const chartData = measurements.map((m) => ({
    label: formatDate(m.date).slice(0, 5),
    value: m.weight_kg,
  }));

  const dataLonga = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // O dia só está resolvido quando não há treino previsto sem check-in, nem
  // pendência de cadastro, nem dose vencendo.
  const checkinPendente = todayPlan.filter(
    (p: any) => !todayCompletions.some((c: any) => c.plan_id === p.id)
  ).length;
  const tudoEmDia =
    checkinPendente === 0 && pending.items.length === 0 && !doseUrgent;

  const atalhos = [
    { href: "/app/dieta", icon: Flame, label: "Refeição" },
    { href: "/app/treinos", icon: Dumbbell, label: "Treino" },
    { href: "/app/medidas", icon: Scale, label: "Peso" },
    { href: "/app/dieta", icon: Camera, label: "Foto do prato" },
  ];

  return (
    <div className="space-y-5">
      {/* Saudação enxuta — o espaço nobre é do bloco "Hoje", logo abaixo. */}
      <div>
        <p className="text-sm capitalize text-slate-500 dark:text-slate-400">
          {dataLonga}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Olá, {firstName} 👋
        </h1>
      </div>

      {/* ----------------------------------------------------------------
          1. HOJE — o que precisa da ação da pessoa agora
      ---------------------------------------------------------------- */}
      <section className="card border-brand-200 bg-gradient-to-b from-brand-50/70 to-white dark:border-brand-900/40 dark:from-brand-950/20 dark:to-slate-900/40">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Hoje</h2>
        </div>

        {tudoEmDia ? (
          <div className="flex items-center gap-3 py-1">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-600 dark:text-brand-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {todayPlan.length > 0
                ? "Treino de hoje já confirmado. Siga registrando o resto do dia."
                : "Dia de descanso no plano. Siga registrando o resto do dia."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayPlan.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Treino de hoje
                </p>
                <PlanCheckIn
                  sessions={todayPlan as any}
                  date={today}
                  completions={todayCompletions as any}
                />
              </div>
            )}

            {treatment && doseLabel && doseUrgent && (
              <Link
                href="/app/tratamento"
                className="group flex items-center gap-3 rounded-xl border border-brand-200 bg-white/70 p-3 transition hover:border-brand-300 dark:border-brand-900/50 dark:bg-slate-900/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  <Syringe className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {doseLabel}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {treatment.medication}
                    {treatment.dose ? ` · ${treatment.dose}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            )}

            {pending.items.length > 0 && (
              <ul className="space-y-1.5">
                {pending.items.map((it) => (
                  <li key={it.key}>
                    <Link
                      href={it.href}
                      className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white/70 p-2.5 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          it.urgent ? "bg-rose-500" : "bg-amber-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {it.label}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {it.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Registrar algo — atalhos junto da ação, não numa caixa separada */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-100 pt-3 dark:border-brand-900/30">
          {atalhos.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------
          2. SEU DIA — Score e números num bloco só
      ---------------------------------------------------------------- */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Seu dia
            </h2>
          </div>
          {(!calorieGoal || !proteinGoal) && (
            <Link
              href="/app/perfil"
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Definir metas
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {health.hasData && (
            <div className="shrink-0 sm:w-40">
              <p className={`text-4xl font-bold leading-none ${healthColor}`}>
                {health.score}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                Score de Saúde · {health.label}
              </p>
            </div>
          )}

          <div className="grid flex-1 grid-cols-3 gap-2">
            {rings.map((r) => (
              <ProgressRing
                key={r.label}
                pct={r.pct}
                centerMain={r.centerMain}
                centerSub={r.centerSub}
                label={r.label}
                colorClass={r.colorClass}
              />
            ))}
          </div>
        </div>

        {health.hasData && health.topTip ? (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {health.topTip}
          </p>
        ) : !health.hasData ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Registre uma refeição, a água ou o sono para o Score do dia
            aparecer.
          </p>
        ) : null}
      </section>

      {/* ----------------------------------------------------------------
          3. PROGRESSO — peso e números da semana
      ---------------------------------------------------------------- */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Progresso
            </h2>
          </div>
          <Link
            href="/app/medidas"
            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Ver medidas
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {currentWeight ?? "—"}
              {currentWeight ? (
                <span className="text-sm font-medium text-slate-400"> kg</span>
              ) : null}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Peso atual
            </p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {workoutsWeek}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Treinos (7 dias)
            </p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {sleepToday != null ? sleepToday : "—"}
              {sleepToday != null ? (
                <span className="text-sm font-medium text-slate-400"> h</span>
              ) : null}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sono hoje
            </p>
          </div>
        </div>

        {chartData.length > 1 ? (
          <TrendChart data={chartData as any} unit=" kg" />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <Scale className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Registre seu peso algumas vezes para ver a evolução aqui.
            </p>
            <Link
              href="/app/medidas"
              className="btn-primary mx-auto mt-3 w-fit px-4 py-1.5 text-xs"
            >
              Registrar peso
            </Link>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------
          4. Histórico recente e atalhos secundários
      ---------------------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Treinos recentes
            </h2>
            <Link
              href="/app/treinos"
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Ver todos
            </Link>
          </div>
          {recentWorkouts.length > 0 ? (
            <ul className="space-y-3">
              {recentWorkouts.map((w) => (
                <li key={w.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    <Dumbbell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {w.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(w.date)}
                      {w.category ? ` · ${w.category}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum treino registrado ainda.
            </p>
          )}
        </section>

        <section className="space-y-3">
          {treatment && doseLabel && !doseUrgent && (
            <Link
              href="/app/tratamento"
              className="card group flex items-center gap-4 transition duration-200 hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Syringe className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {doseLabel}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {treatment.medication}
                  {treatment.dose ? ` · ${treatment.dose}` : ""}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>
          )}

          <Link
            href="/app/relatorios"
            className="card group flex items-center gap-4 transition duration-200 hover:-translate-y-0.5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Relatório com IA
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Um resumo do seu período para levar à consulta.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </Link>

          <div className="card">
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Fale com a Gaia
              </p>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Ela registra treino, refeição, água e peso por você — é só pedir.
            </p>
            <OpenChatButton />
          </div>
        </section>
      </div>
    </div>
  );
}
