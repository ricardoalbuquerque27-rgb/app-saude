import Link from "next/link";
import {
  ArrowLeft,
  Scale,
  Flame,
  Droplets,
  Dumbbell,
  FileText,
  Syringe,
  Activity,
  Utensils,
  Ruler,
  Target,
  CalendarCheck,
  AlertTriangle,
  HeartPulse,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/date";
import { computeHealthScore } from "@/lib/healthScore";
import { formatDate } from "@/components/ui";
import { TrendChart, BarsChart } from "@/components/charts";
import {
  getPatientsSummary,
  getPatientActivity,
  getPatientSeries,
  idleDays,
  type ActivityItem,
} from "@/lib/nutri";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "geral", label: "Visão geral" },
  { key: "atividade", label: "Atividade" },
  { key: "nutricao", label: "Nutrição" },
  { key: "treino", label: "Treino" },
  { key: "corpo", label: "Corpo" },
  { key: "clinico", label: "Clínico" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ageFrom(birth?: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const a = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return a >= 0 && a < 130 ? a : null;
}

function dayLabel(iso: string) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

function Card({
  title,
  icon,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card mb-4 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="text-slate-400">{icon}</div>
      <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
          {sub}
        </p>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-2 text-sm text-slate-500 dark:text-slate-400">{children}</p>
  );
}

const ACTIVITY_STYLE: Record<
  ActivityItem["kind"],
  { icon: React.ReactNode; cls: string }
> = {
  refeicao: {
    icon: <Utensils className="h-3.5 w-3.5" />,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  treino: {
    icon: <Dumbbell className="h-3.5 w-3.5" />,
    cls: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  },
  peso: {
    icon: <Scale className="h-3.5 w-3.5" />,
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  },
  diario: {
    icon: <Droplets className="h-3.5 w-3.5" />,
    cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  exame: {
    icon: <FileText className="h-3.5 w-3.5" />,
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  dose: {
    icon: <Syringe className="h-3.5 w-3.5" />,
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
  efeito: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
};

export default async function PacienteDetalhe({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const supabase = await createClient();
  const uid = params.id;
  const today = todayISO();
  const tab: TabKey = (TABS.find((t) => t.key === searchParams?.t)?.key ??
    "geral") as TabKey;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, sex, birth_date, height_cm, weight_goal_kg, daily_calorie_goal, protein_goal_g, daily_water_goal_ml, created_at"
    )
    .eq("id", uid)
    .maybeSingle();

  // Sem vínculo ativo → a RLS devolve nulo.
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

  const name = profile.full_name || "Paciente";
  const age = ageFrom(profile.birth_date);
  const sexo =
    profile.sex === "F" ? "Feminino" : profile.sex === "M" ? "Masculino" : null;

  const [summary] = await getPatientsSummary(supabase, [uid], { [uid]: name });
  const idle = idleDays(summary, today);

  return (
    <div className="max-w-3xl">
      <Link
        href="/app/pacientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Pacientes
      </Link>

      {/* Cabeçalho do paciente */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white shadow">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[
              sexo,
              age ? `${age} anos` : null,
              profile.height_cm ? `${profile.height_cm} cm` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Perfil incompleto"}
          </p>
        </div>
      </div>

      {summary.alerts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.alerts.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertTriangle className="h-3 w-3" /> {a}
            </span>
          ))}
        </div>
      )}

      {/* Abas */}
      <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/pacientes/${uid}?t=${t.key}`}
            scroll={false}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "geral" && (
        <TabGeral
          supabase={supabase}
          uid={uid}
          profile={profile}
          summary={summary}
          idle={idle}
          today={today}
        />
      )}
      {tab === "atividade" && <TabAtividade supabase={supabase} uid={uid} />}
      {tab === "nutricao" && (
        <TabNutricao supabase={supabase} uid={uid} profile={profile} />
      )}
      {tab === "treino" && <TabTreino supabase={supabase} uid={uid} />}
      {tab === "corpo" && (
        <TabCorpo supabase={supabase} uid={uid} profile={profile} />
      )}
      {tab === "clinico" && <TabClinico supabase={supabase} uid={uid} />}

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        Painel somente leitura. Prescrição de plano/metas e comentários chegam na
        próxima fase.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

async function TabGeral({
  supabase,
  uid,
  profile,
  summary,
  idle,
  today,
}: any) {
  const [series, dailyRes, mealsTodayRes] = await Promise.all([
    getPatientSeries(supabase, uid, 14),
    supabase
      .from("daily_logs")
      .select("sleep_hours, mood, energy")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("calories, protein_g")
      .eq("user_id", uid)
      .eq("date", today),
  ]);

  const health = computeHealthScore({
    sleepHours: dailyRes.data?.sleep_hours ?? null,
    trainedToday: (series[series.length - 1]?.workouts ?? 0) > 0,
    workoutsWeek: summary.workouts7,
    mealsLoggedToday: (mealsTodayRes.data ?? []).length,
    proteinToday: summary.proteinToday,
    proteinGoal: profile.protein_goal_g,
    caloriesToday: summary.caloriesToday,
    calorieGoal: profile.daily_calorie_goal,
    waterToday: summary.waterToday,
    waterGoal: profile.daily_water_goal_ml ?? 2500,
    mood: (dailyRes.data as any)?.mood ?? null,
    energy: (dailyRes.data as any)?.energy ?? null,
  });

  const weightPoints = series
    .filter((s: any) => s.weight != null)
    .map((s: any) => ({ label: dayLabel(s.date), value: s.weight }));

  const adherence = Math.round((summary.daysLogged7 / 7) * 100);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Peso atual"
          value={summary.weightLast != null ? `${summary.weightLast} kg` : "—"}
          sub={
            summary.weightDelta30 != null
              ? `${summary.weightDelta30 > 0 ? "+" : ""}${summary.weightDelta30} kg em 30d`
              : undefined
          }
          icon={<Scale className="h-4 w-4" />}
        />
        <Stat
          label="Adesão (7 dias)"
          value={`${adherence}%`}
          sub={`${summary.daysLogged7} de 7 dias`}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <Stat
          label="Treinos (7 dias)"
          value={`${summary.workouts7}`}
          icon={<Dumbbell className="h-4 w-4" />}
        />
        <Stat
          label="Último registro"
          value={idle == null ? "—" : idle === 0 ? "Hoje" : `${idle} d`}
          sub={summary.lastActivity ? formatDate(summary.lastActivity) : "Nunca"}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {health.hasData && (
        <Card
          title="Score de Saúde de hoje"
          icon={<HeartPulse className="h-4 w-4 text-brand-600" />}
        >
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                {health.score}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {health.label}
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {health.topTip}
            </p>
          </div>
        </Card>
      )}

      <Card
        title="Perfil e metas"
        icon={<Target className="h-4 w-4 text-brand-600" />}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ["Sexo", sexLabel(profile.sex)],
            ["Idade", age2(profile.birth_date)],
            ["Altura", profile.height_cm ? `${profile.height_cm} cm` : "—"],
            [
              "Peso alvo",
              profile.weight_goal_kg ? `${profile.weight_goal_kg} kg` : "—",
            ],
            [
              "Calorias/dia",
              profile.daily_calorie_goal
                ? `${profile.daily_calorie_goal} kcal`
                : "—",
            ],
            [
              "Proteína/dia",
              profile.protein_goal_g ? `${profile.protein_goal_g} g` : "—",
            ],
            [
              "Água/dia",
              profile.daily_water_goal_ml
                ? `${(profile.daily_water_goal_ml / 1000).toFixed(1)} L`
                : "—",
            ],
            ["No app desde", profile.created_at ? formatDate(profile.created_at.slice(0, 10)) : "—"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-slate-400 dark:text-slate-500">{k}</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {weightPoints.length > 1 && (
        <Card
          title="Peso (14 dias)"
          icon={<Scale className="h-4 w-4 text-brand-600" />}
        >
          <TrendChart data={weightPoints} unit=" kg" />
        </Card>
      )}

      <Card
        title="Registros por dia (14 dias)"
        icon={<CalendarCheck className="h-4 w-4 text-brand-600" />}
      >
        <div className="flex items-end gap-1">
          {series.map((s: any) => {
            const has =
              s.calories > 0 || s.water > 0 || s.workouts > 0 || s.weight != null;
            return (
              <div key={s.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-10 w-full rounded ${
                    has
                      ? "bg-brand-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  title={`${s.date}: ${has ? "registrou" : "sem registro"}`}
                />
                <span className="text-[9px] text-slate-400">
                  {s.date.slice(8, 10)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Verde = houve algum registro no dia.
        </p>
      </Card>
    </>
  );
}

function sexLabel(s?: string | null) {
  return s === "F" ? "Feminino" : s === "M" ? "Masculino" : "—";
}
function age2(b?: string | null) {
  const a = ageFrom(b);
  return a != null ? `${a} anos` : "—";
}

// ---------------------------------------------------------------------------
// Atividade (linha do tempo)
// ---------------------------------------------------------------------------

async function TabAtividade({ supabase, uid }: any) {
  const items = await getPatientActivity(supabase, uid, 30, 80);

  if (items.length === 0) {
    return (
      <Card title="Atividade" icon={<Activity className="h-4 w-4 text-brand-600" />}>
        <Empty>Nenhum registro nos últimos 30 dias.</Empty>
      </Card>
    );
  }

  // Agrupa por dia, preservando a ordem (mais recente primeiro).
  const byDay: { date: string; items: ActivityItem[] }[] = [];
  for (const it of items) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else byDay.push({ date: it.date, items: [it] });
  }

  return (
    <Card
      title="Linha do tempo (30 dias)"
      icon={<Activity className="h-4 w-4 text-brand-600" />}
    >
      <div className="space-y-5">
        {byDay.map((g) => (
          <div key={g.date}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {formatDate(g.date)}
            </p>
            <ul className="space-y-2">
              {g.items.map((it, i) => {
                const st = ACTIVITY_STYLE[it.kind];
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${st.cls}`}
                    >
                      {st.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {it.title}
                      </p>
                      {it.detail && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {it.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Nutrição
// ---------------------------------------------------------------------------

async function TabNutricao({ supabase, uid, profile }: any) {
  const series = await getPatientSeries(supabase, uid, 14);
  const since = addDaysISO(todayISO(), -14);
  const { data: meals } = await supabase
    .from("meals")
    .select("date, meal_type, description, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", uid)
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(60);

  const withData = series.filter((s: any) => s.calories > 0);
  const avgCal = withData.length
    ? Math.round(
        withData.reduce((s: number, d: any) => s + d.calories, 0) / withData.length
      )
    : 0;
  const avgProt = withData.length
    ? Math.round(
        withData.reduce((s: number, d: any) => s + d.protein, 0) / withData.length
      )
    : 0;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Média de calorias"
          value={avgCal ? `${avgCal}` : "—"}
          sub={
            profile.daily_calorie_goal
              ? `meta ${profile.daily_calorie_goal} kcal`
              : "sem meta definida"
          }
          icon={<Flame className="h-4 w-4" />}
        />
        <Stat
          label="Média de proteína"
          value={avgProt ? `${avgProt} g` : "—"}
          sub={
            profile.protein_goal_g
              ? `meta ${profile.protein_goal_g} g`
              : "sem meta definida"
          }
          icon={<Utensils className="h-4 w-4" />}
        />
        <Stat
          label="Dias com registro"
          value={`${withData.length}/14`}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <Stat
          label="Refeições (14d)"
          value={`${(meals ?? []).length}`}
          icon={<Utensils className="h-4 w-4" />}
        />
      </div>

      {withData.length > 0 && (
        <>
          <Card title="Calorias por dia (14 dias)" icon={<Flame className="h-4 w-4 text-brand-600" />}>
            <BarsChart
              data={series.map((s: any) => ({
                label: dayLabel(s.date),
                value: s.calories || null,
              }))}
              unit=" kcal"
            />
          </Card>
          <Card title="Proteína por dia (14 dias)" icon={<Utensils className="h-4 w-4 text-brand-600" />}>
            <BarsChart
              data={series.map((s: any) => ({
                label: dayLabel(s.date),
                value: s.protein || null,
              }))}
              color="#7c3aed"
              unit=" g"
            />
          </Card>
        </>
      )}

      <Card title="Refeições recentes" icon={<Utensils className="h-4 w-4 text-brand-600" />}>
        {(meals ?? []).length === 0 ? (
          <Empty>Nenhuma refeição registrada nos últimos 14 dias.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(meals ?? []).map((m: any, i: number) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {m.description || m.meal_type || "Refeição"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(m.date)}
                    {m.meal_type ? ` · ${m.meal_type}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {m.calories ? `${Math.round(Number(m.calories))} kcal` : "—"}
                  </p>
                  <p className="text-slate-400">
                    {[
                      m.protein_g ? `P ${Math.round(Number(m.protein_g))}` : null,
                      m.carbs_g ? `C ${Math.round(Number(m.carbs_g))}` : null,
                      m.fat_g ? `G ${Math.round(Number(m.fat_g))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Treino
// ---------------------------------------------------------------------------

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

async function TabTreino({ supabase, uid }: any) {
  const since = addDaysISO(todayISO(), -30);
  const [wkRes, planRes, routinesRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, date, name, category, duration_min")
      .eq("user_id", uid)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("workout_plan")
      .select("day_of_week, sport, title")
      .eq("user_id", uid)
      .order("day_of_week", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("routines")
      .select("id, name, notes")
      .eq("user_id", uid)
      .order("position", { ascending: true }),
  ]);

  const workouts = (wkRes.data ?? []) as any[];
  const plan = (planRes.data ?? []) as any[];
  const routines = (routinesRes.data ?? []) as any[];

  // Exercícios dos treinos listados, numa única consulta.
  let exByWorkout: Record<string, any[]> = {};
  if (workouts.length) {
    const { data: exs } = await supabase
      .from("exercises")
      .select("workout_id, name, sets, reps, weight_kg")
      .in(
        "workout_id",
        workouts.map((w) => w.id)
      )
      .order("position", { ascending: true });
    for (const e of (exs ?? []) as any[]) {
      (exByWorkout[e.workout_id] ||= []).push(e);
    }
  }

  return (
    <>
      <Card title="Plano semanal" icon={<CalendarCheck className="h-4 w-4 text-brand-600" />}>
        {plan.length === 0 ? (
          <Empty>Sem plano semanal montado.</Empty>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {DOW.map((d, i) => {
              const items = plan.filter((p) => p.day_of_week === i);
              return (
                <div key={d} className="text-center">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                    {d}
                  </p>
                  {items.length === 0 ? (
                    <div className="rounded-lg bg-slate-100 py-2 text-[10px] text-slate-400 dark:bg-slate-800">
                      —
                    </div>
                  ) : (
                    items.map((p, k) => (
                      <div
                        key={k}
                        className="mb-1 rounded-lg bg-brand-100 px-1 py-1.5 text-[10px] font-medium leading-tight text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"
                        title={p.title || p.sport}
                      >
                        {p.sport || p.title}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {routines.length > 0 && (
        <Card title="Rotinas salvas" icon={<Dumbbell className="h-4 w-4 text-brand-600" />}>
          <ul className="space-y-1.5">
            {routines.map((r) => (
              <li key={r.id} className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">{r.name}</span>
                {r.notes && (
                  <span className="text-slate-400"> — {r.notes}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Treinos (30 dias)" icon={<Dumbbell className="h-4 w-4 text-brand-600" />}>
        {workouts.length === 0 ? (
          <Empty>Nenhum treino registrado nos últimos 30 dias.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {workouts.map((w) => (
              <li key={w.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {w.name || "Treino"}
                  </p>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatDate(w.date)}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[w.category, w.duration_min ? `${w.duration_min} min` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(exByWorkout[w.id] ?? []).length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {exByWorkout[w.id].map((e: any, i: number) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="shrink-0 font-mono">
                          {[
                            e.sets && e.reps ? `${e.sets}×${e.reps}` : null,
                            e.weight_kg ? `${e.weight_kg} kg` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Corpo
// ---------------------------------------------------------------------------

async function TabCorpo({ supabase, uid, profile }: any) {
  const { data } = await supabase
    .from("body_measurements")
    .select(
      "date, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm"
    )
    .eq("user_id", uid)
    .order("date", { ascending: false })
    .limit(60);
  const rows = (data ?? []) as any[];
  const withWeight = [...rows]
    .filter((r) => r.weight_kg != null)
    .reverse();

  return (
    <>
      {withWeight.length > 1 && (
        <Card title="Evolução do peso" icon={<Scale className="h-4 w-4 text-brand-600" />}>
          <TrendChart
            data={withWeight.map((r) => ({
              label: dayLabel(r.date),
              value: Number(r.weight_kg),
            }))}
            unit=" kg"
          />
          {profile.weight_goal_kg && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Meta: {profile.weight_goal_kg} kg · faltam{" "}
              {Math.abs(
                Number(withWeight[withWeight.length - 1].weight_kg) -
                  Number(profile.weight_goal_kg)
              ).toFixed(1)}{" "}
              kg
            </p>
          )}
        </Card>
      )}

      <Card title="Medidas registradas" icon={<Ruler className="h-4 w-4 text-brand-600" />}>
        {rows.length === 0 ? (
          <Empty>Nenhuma medida registrada.</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-2 pb-2 font-medium">Data</th>
                  <th className="px-2 pb-2 font-medium">Peso</th>
                  <th className="px-2 pb-2 font-medium">%GC</th>
                  <th className="px-2 pb-2 font-medium">Cintura</th>
                  <th className="px-2 pb-2 font-medium">Quadril</th>
                  <th className="px-2 pb-2 font-medium">Peito</th>
                  <th className="px-2 pb-2 font-medium">Braço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={i} className="text-slate-700 dark:text-slate-300">
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-500">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-2 py-1.5">{r.weight_kg ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.body_fat_pct ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.waist_cm ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.hip_cm ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.chest_cm ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.arm_cm ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Clínico (exames + tratamento)
// ---------------------------------------------------------------------------

const STATUS_CLS: Record<string, string> = {
  alterado: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  atencao: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  atenção: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  normal:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

async function TabClinico({ supabase, uid }: any) {
  const [examsRes, treatRes, dosesRes, effectsRes] = await Promise.all([
    supabase
      .from("exams")
      .select("date, title, result_value, unit, reference_range, status, notes")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(40),
    supabase
      .from("treatments")
      .select("medication, dose, frequency_days, start_date, next_dose_date, notes")
      .eq("user_id", uid)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("dose_logs")
      .select("date, dose")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(12),
    supabase
      .from("side_effects")
      .select("date, nausea, appetite, fatigue, other, notes")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(12),
  ]);

  const exams = (examsRes.data ?? []) as any[];
  const treat = treatRes.data as any;
  const doses = (dosesRes.data ?? []) as any[];
  const effects = (effectsRes.data ?? []) as any[];

  return (
    <>
      <Card title="Tratamento" icon={<Syringe className="h-4 w-4 text-brand-600" />}>
        {!treat ? (
          <Empty>Nenhum tratamento ativo cadastrado.</Empty>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {treat.medication}
              {treat.dose ? ` · ${treat.dose}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {[
                treat.frequency_days ? `a cada ${treat.frequency_days} dias` : null,
                treat.start_date ? `início ${formatDate(treat.start_date)}` : null,
                treat.next_dose_date
                  ? `próxima dose ${formatDate(treat.next_dose_date)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {treat.notes && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {treat.notes}
              </p>
            )}
            {doses.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Últimas aplicações
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {doses.map((d, i) => (
                    <li
                      key={i}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {formatDate(d.date)}
                      {d.dose ? ` · ${d.dose}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      {effects.length > 0 && (
        <Card
          title="Efeitos colaterais relatados"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {effects.map((e, i) => (
              <li key={i} className="py-2">
                <p className="text-xs text-slate-400">{formatDate(e.date)}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {[
                    e.nausea ? `náusea ${e.nausea}/5` : null,
                    e.appetite ? `apetite ${e.appetite}/5` : null,
                    e.fatigue ? `cansaço ${e.fatigue}/5` : null,
                    e.other || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem detalhes"}
                </p>
                {e.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {e.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Exames" icon={<FileText className="h-4 w-4 text-brand-600" />}>
        {exams.length === 0 ? (
          <Empty>Nenhum exame registrado.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {exams.map((e, i) => (
              <li key={i} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {e.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(e.date)}
                      {e.reference_range ? ` · ref. ${e.reference_range}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      STATUS_CLS[e.status] ??
                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {e.result_value ?? ""}
                    {e.unit ? ` ${e.unit}` : ""}
                  </span>
                </div>
                {e.notes && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {e.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
