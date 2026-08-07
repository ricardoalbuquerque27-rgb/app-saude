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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard, formatDate } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { getGamification } from "@/lib/gamification";
import OpenChatButton from "@/components/OpenChatButton";
import { ProgressRing } from "@/components/ProgressRing";
import { CHALLENGES, weekStartISO } from "@/lib/challenges";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function todayDow() {
  return (new Date().getDay() + 6) % 7; // 0 = Segunda
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const today = todayISO();
  const weekAgo = isoDaysAgo(7);
  const dow = todayDow();

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
      .select("water_ml")
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
