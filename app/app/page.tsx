import Link from "next/link";
import {
  Dumbbell,
  Flame,
  Scale,
  Droplets,
  ArrowRight,
  Salad,
  FileText,
  LineChart as LineIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard, formatDate } from "@/components/ui";
import { TrendChart } from "@/components/charts";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const today = todayISO();
  const weekAgo = isoDaysAgo(7);

  const [
    profileRes,
    workoutsWeekRes,
    mealsTodayRes,
    measurementsRes,
    dailyTodayRes,
    recentWorkoutsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("date", weekAgo),
    supabase.from("meals").select("calories").eq("user_id", uid).eq("date", today),
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
  ]);

  const profile = profileRes.data;
  const firstName = (profile?.full_name || "Atleta").split(" ")[0];

  const workoutsWeek = workoutsWeekRes.count ?? 0;
  const caloriesToday = (mealsTodayRes.data ?? []).reduce(
    (s, m) => s + (Number(m.calories) || 0),
    0
  );
  const measurements = measurementsRes.data ?? [];
  const currentWeight =
    measurements.length > 0
      ? measurements[measurements.length - 1].weight_kg
      : null;
  const waterToday = dailyTodayRes.data?.water_ml ?? 0;
  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const recentWorkouts = recentWorkoutsRes.data ?? [];

  const chartData = measurements.map((m) => ({
    label: formatDate(m.date).slice(0, 5),
    value: m.weight_kg,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Olá, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Aqui está o resumo da sua jornada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Treinos (7 dias)"
          value={workoutsWeek}
          icon={<Dumbbell className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Calorias hoje"
          value={Math.round(caloriesToday)}
          unit="kcal"
          icon={<Flame className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Peso atual"
          value={currentWeight ?? "—"}
          unit={currentWeight ? "kg" : ""}
          icon={<Scale className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Água hoje"
          value={`${(waterToday / 1000).toFixed(1)}/${(waterGoal / 1000).toFixed(1)}`}
          unit="L"
          icon={<Droplets className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
            <TrendChart data={chartData} unit="kg" color="#8b5cf6" />
          ) : (
            <div className="flex h-[240px] flex-col items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
              <LineIcon className="mb-2 h-8 w-8 text-slate-300" />
              Registre seu peso em Medidas para ver o gráfico.
            </div>
          )}
        </div>

        <div className="card">
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
          <Link
            href="/app/treinos"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Registrar treino <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/app/treinos" icon={<Dumbbell className="h-5 w-5" />} label="Treino" />
        <QuickLink href="/app/dieta" icon={<Salad className="h-5 w-5" />} label="Refeição" />
        <QuickLink href="/app/habitos" icon={<Droplets className="h-5 w-5" />} label="Hábitos" />
        <QuickLink href="/app/exames" icon={<FileText className="h-5 w-5" />} label="Exame" />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 py-4 text-center transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
    </Link>
  );
}
