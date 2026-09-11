import Link from "next/link";
import { ArrowLeft, Scale, Flame, Droplets, Moon, Dumbbell, FileText, Syringe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/date";
import { computeHealthScore } from "@/lib/healthScore";

export const dynamic = "force-dynamic";

function ageFrom(birth?: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const a = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return a >= 0 && a < 130 ? a : null;
}

export default async function PacienteDetalhe({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const uid = params.id;
  const today = todayISO();
  const weekAgo = addDaysISO(today, -7);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, sex, birth_date, height_cm, weight_goal_kg, daily_calorie_goal, protein_goal_g, daily_water_goal_ml"
    )
    .eq("id", uid)
    .maybeSingle();

  // Sem acesso (não vinculado) → profile volta nulo pela RLS.
  if (!profile) {
    return (
      <div className="max-w-2xl">
        <Link
          href="/app/pacientes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
        <div className="card">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sem acesso a este paciente. O vínculo pode ter sido revogado ou ainda
            não foi aceito.
          </p>
        </div>
      </div>
    );
  }

  const [weightRes, mealsRes, dailyRes, wkRes, examsRes, treatRes] =
    await Promise.all([
      supabase
        .from("body_measurements")
        .select("weight_kg, body_fat_pct, date")
        .eq("user_id", uid)
        .not("weight_kg", "is", null)
        .order("date", { ascending: false })
        .limit(1),
      supabase.from("meals").select("calories, protein_g").eq("user_id", uid).eq("date", today),
      supabase
        .from("daily_logs")
        .select("water_ml, sleep_hours, mood, energy")
        .eq("user_id", uid)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .gte("date", weekAgo),
      supabase
        .from("exams")
        .select("title, result_value, unit, status, date")
        .eq("user_id", uid)
        .neq("status", "normal")
        .order("date", { ascending: false })
        .limit(6),
      supabase
        .from("treatments")
        .select("medication, dose, next_dose_date")
        .eq("user_id", uid)
        .eq("active", true)
        .maybeSingle(),
    ]);

  const weight = (weightRes.data ?? [])[0];
  const caloriesToday = (mealsRes.data ?? []).reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const proteinToday = (mealsRes.data ?? []).reduce((s, m) => s + (Number(m.protein_g) || 0), 0);
  const wkWeek = wkRes.count ?? 0;
  const water = dailyRes.data?.water_ml ?? 0;
  const sleep = dailyRes.data?.sleep_hours ?? null;
  const exams = examsRes.data ?? [];
  const treat = treatRes.data;

  const health = computeHealthScore({
    sleepHours: sleep,
    trainedToday: false,
    workoutsWeek: wkWeek,
    mealsLoggedToday: (mealsRes.data ?? []).length,
    proteinToday,
    proteinGoal: profile.protein_goal_g,
    caloriesToday,
    calorieGoal: profile.daily_calorie_goal,
    waterToday: water,
    waterGoal: profile.daily_water_goal_ml ?? 2500,
    mood: (dailyRes.data as any)?.mood ?? null,
    energy: (dailyRes.data as any)?.energy ?? null,
  });

  const name = profile.full_name || "Paciente";
  const age = ageFrom(profile.birth_date);
  const sexo = profile.sex === "F" ? "Feminino" : profile.sex === "M" ? "Masculino" : null;

  const stat = (label: string, value: string, icon: React.ReactNode) => (
    <div className="card">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <Link
        href="/app/pacientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Pacientes
      </Link>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[sexo, age ? `${age} anos` : null, profile.height_cm ? `${profile.height_cm} cm` : null]
              .filter(Boolean)
              .join(" · ") || "Perfil incompleto"}
          </p>
        </div>
      </div>

      {/* Score + números do dia */}
      {health.hasData && (
        <div className="card mb-4 flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{health.score}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Score hoje</p>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{health.topTip}</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(
          "Peso atual",
          weight?.weight_kg != null ? `${weight.weight_kg} kg` : "—",
          <Scale className="h-4 w-4" />
        )}
        {stat("Calorias hoje", `${Math.round(caloriesToday)}`, <Flame className="h-4 w-4" />)}
        {stat("Água hoje", `${(water / 1000).toFixed(1)} L`, <Droplets className="h-4 w-4" />)}
        {stat("Treinos 7d", `${wkWeek}`, <Dumbbell className="h-4 w-4" />)}
      </div>

      {treat && (
        <div className="card mb-4">
          <div className="flex items-center gap-2">
            <Syringe className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Tratamento (caneta)</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {treat.medication}
            {treat.dose ? ` · ${treat.dose}` : ""}
            {treat.next_dose_date ? ` · próxima dose ${treat.next_dose_date}` : ""}
          </p>
        </div>
      )}

      <div className="card mb-4">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Exames alterados</h2>
        </div>
        {exams.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum exame fora da referência registrado.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {exams.map((e: any, i: number) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{e.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    e.status === "alterado"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  {e.result_value ?? ""}
                  {e.unit ? ` ${e.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Painel somente leitura. Prescrição de plano/metas e comentários chegam na
        próxima fase.
      </p>
    </div>
  );
}
