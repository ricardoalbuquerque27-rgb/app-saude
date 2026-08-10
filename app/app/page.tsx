import Link from "next/link";
import {
  Dumbbell,
  Flame,
  Scale,
  ArrowRight,
  LineChart as LineIcon,
  BarChart3,
  Camera,
  CalendarDays,
  Trophy,
  Syringe,
  Target,
  HeartPulse,
  Bell,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard, formatDate } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { getGamification } from "@/lib/gamification";
import OpenChatButton from "@/components/OpenChatButton";
import { ProgressRing } from "@/components/ProgressRing";
import { CHALLENGES, weekStartISO } from "@/lib/challenges";
import { todayISO, addDaysISO } from "@/lib/date";
import { computeHealthScore } from "@/lib/healthScore";
import { getPending } from "@/lib/pending";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const today = todayISO();
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
    challengesRes,
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
      .select("sport, title")
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
      .from("challenge_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("week_start", weekStartISO()),
  ]);

  const profile = profileRes.data;
  const firstName = (profile?.full_name || "Atleta").split(" ")[0];
  const initials = (profile?.full_name || "Atleta")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

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
    measurements.length > 0 ? measurements[measurements.length - 1].weight_kg : null;
  const waterToday = dailyTodayRes.data?.water_ml ?? 0;
  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const calorieGoal = profile?.daily_calorie_goal ?? null;
  const proteinGoal = profile?.protein_goal_g ?? null;
  const recentWorkouts = recentWorkoutsRes.data ?? [];
  const todayPlan = todayPlanRes.data ?? [];

  // Score de Saúde do dia (usa só dados que o app já coleta).
  const health = computeHealthScore({
    sleepHours: dailyTodayRes.data?.sleep_hours ?? null,
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
  const healthBadge =
    health.color === "brand"
      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
      : health.color === "amber"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

  // Anéis do dia
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

  const game = await getGamification(supabase, uid);
  const pending = await getPending(supabase, uid);

  const challengesDone = challengesRes.count ?? 0;
  const challengesTotal = CHALLENGES.length;

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

  const actions = [
    { href: "/app/treinos", icon: Dumbbell, label: "Registrar treino" },
    { href: "/app/dieta", icon: Camera, label: "Analisar foto do prato" },
    { href: "/app/relatorios", icon: BarChart3, label: "Gerar relatório" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur ring-1 ring-white/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm capitalize text-brand-50/80">{dataLonga}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Olá, {firstName} 👋
            </h1>
          </div>
        </div>

        {/* Nível, sequência e plano */}
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/app/conquistas"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/15 backdrop-blur transition hover:bg-white/25"
          >
            <Trophy className="h-3.5 w-3.5" /> Nível {game.level}
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/15 backdrop-blur">
            <Flame className="h-3.5 w-3.5" /> {game.current}{" "}
            {game.current === 1 ? "dia" : "dias"}
          </span>
          {todayPlan.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/15 backdrop-blur"
            >
              {p.sport}
              {p.title ? ` · ${p.title}` : ""}
            </span>
          ))}
        </div>

        {/* Barra de nível */}
        <div className="relative mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-brand-50/80">
            <span>Progresso de nível</span>
            <span>
              {game.xpPerLevel - game.xpIntoLevel} XP p/ nível {game.level + 1}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white/90 transition-all"
              style={{ width: `${Math.round(game.progress * 100)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Pendências — o que falta preencher/fazer */}
      {pending.items.length > 0 && (
        <div className="card border-l-4 border-l-amber-400 dark:border-l-amber-500/70">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Bell className="h-4 w-4" />
            </span>
            <h2 className="font-semibold text-slate-900 dark:text-white">Para você</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {pending.items.length}
            </span>
          </div>
          <div className="space-y-2">
            {pending.items.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-white/[0.06] dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
              >
                <span
                  className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    it.urgent ? "bg-rose-500" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {it.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {it.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Score de Saúde do dia */}
      <div className="card">
        {health.hasData ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4 sm:block sm:shrink-0 sm:text-center">
              <ProgressRing
                pct={health.score / 100}
                centerMain={`${health.score}`}
                centerSub="/ 100"
                label="Score de Saúde"
                colorClass={healthColor}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Seu dia hoje
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${healthBadge}`}
                >
                  {health.label}
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                {health.topTip}
              </p>
              <div className="space-y-2">
                {health.pillars.map((p) => (
                  <div key={p.key}>
                    <div className="mb-0.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{p.label}</span>
                      <span className="tabular font-medium text-slate-600 dark:text-slate-300">
                        {p.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          p.value >= 70
                            ? "bg-brand-500"
                            : p.value >= 55
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${p.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Seu Score de Saúde aparece aqui
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Comece registrando água, sono, uma refeição ou um treino — a Gaia
                também pode fazer isso por você.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Resumo do dia — anéis */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Resumo de hoje
          </h2>
          {(!calorieGoal || !proteinGoal) && (
            <Link
              href="/app/perfil"
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Definir metas
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
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

      {/* Mini-stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Treinos (7 dias)"
          value={workoutsWeek}
          icon={<Dumbbell className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Peso atual"
          value={currentWeight ?? "—"}
          unit={currentWeight ? "kg" : ""}
          icon={<Scale className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      {/* Tratamento + Desafios */}
      <div className="grid gap-3 sm:grid-cols-2">
        {treatment && doseLabel && (
          <Link
            href="/app/tratamento"
            className={`card group flex items-center gap-4 transition duration-200 hover:-translate-y-0.5 ${
              doseUrgent
                ? "border-brand-300 bg-brand-50/60 dark:border-brand-800/60 dark:bg-brand-950/20"
                : ""
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              <Syringe className="h-6 w-6" />
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
          href="/app/desafios"
          className="card group flex items-center gap-4 transition duration-200 hover:-translate-y-0.5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            <Target className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Desafios da semana
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {challengesDone > 0
                ? `${challengesDone}/${challengesTotal} concluídos — resgate mais XP!`
                : "Complete metas e ganhe XP extra."}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </Link>
      </div>

      {/* Gráfico + Plano de hoje */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Evolução do peso
            </h2>
            <Link
              href="/app/medidas"
              className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Ver mais
            </Link>
          </div>
          {chartData.length > 1 ? (
            <TrendChart data={chartData} unit="kg" color="#18b85e" />
          ) : (
            <div className="flex h-[240px] flex-col items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
              <LineIcon className="mb-2 h-8 w-8 text-slate-300" />
              Registre seu peso em Medidas para ver o gráfico.
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Plano de hoje
            </h2>
          </div>
          {todayPlan.length > 0 ? (
            <ul className="space-y-2">
              {todayPlan.map((p, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/[0.05] dark:bg-slate-800/40"
                >
                  <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    {p.sport}
                  </span>
                  {p.title && (
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {p.title}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nada planejado para hoje.
            </p>
          )}
          <Link
            href="/app/treinos"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Ver plano semanal <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Treinos recentes + Ações rápidas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">
            Treinos recentes
          </h2>
          {recentWorkouts.length > 0 ? (
            <ul className="space-y-3">
              {recentWorkouts.map((w) => (
                <li key={w.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
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
              Nenhum treino ainda.
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
            Ações rápidas
          </h2>
          <div className="space-y-2">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/[0.06] dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  <a.icon className="h-4 w-4" />
                </div>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {a.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            ))}
            <OpenChatButton />
          </div>
        </div>
      </div>
    </div>
  );
}
