"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dumbbell,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CalendarDays,
  History,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Workout, Exercise } from "@/lib/types";
import {
  PageHeader,
  Modal,
  Field,
  EmptyState,
  StatCard,
  formatDate,
} from "@/components/ui";
import { TrendChart } from "@/components/charts";

// Segunda = 0 ... Domingo = 6
const DAYS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

const SPORTS = [
  "Musculação",
  "Corrida",
  "Ciclismo",
  "Natação",
  "Crossfit",
  "Funcional",
  "HIIT",
  "Yoga",
  "Pilates",
  "Futebol",
  "Caminhada",
  "Alongamento",
  "Descanso",
];

function sportChip(sport: string) {
  const s = sport.toLowerCase();
  if (s.includes("descanso"))
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (s.includes("corrida") || s.includes("caminh") || s.includes("hiit"))
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (s.includes("ciclismo") || s.includes("natação") || s.includes("nata"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  if (s.includes("yoga") || s.includes("pilates") || s.includes("along"))
    return "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300";
  return "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300";
}

type PlanEntry = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  notes: string | null;
  position: number;
};

type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  weight_kg: string;
  rpe: string;
};

const emptyExercise = (): ExerciseDraft => ({
  name: "",
  sets: "",
  reps: "",
  weight_kg: "",
  rpe: "",
});

function todayIndex() {
  // JS: 0=Domingo..6=Sábado -> nosso: 0=Segunda..6=Domingo
  return (new Date().getDay() + 6) % 7;
}

export default function TreinosPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"plano" | "historico" | "progressao">("plano");
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  // Plano semanal
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [pDay, setPDay] = useState(0);
  const [pSport, setPSport] = useState("Musculação");
  const [pTitle, setPTitle] = useState("");
  const [pNotes, setPNotes] = useState("");

  // Histórico de treinos
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercisesByWorkout, setExercisesByWorkout] = useState<
    Record<string, Exercise[]>
  >({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()]);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, wsRes] = await Promise.all([
      supabase
        .from("workout_plan")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("position", { ascending: true }),
      supabase.from("workouts").select("*").order("date", { ascending: false }),
    ]);

    setPlan((planRes.data ?? []) as PlanEntry[]);

    const list = (wsRes.data ?? []) as Workout[];
    setWorkouts(list);
    if (list.length > 0) {
      const { data: exs } = await supabase
        .from("exercises")
        .select("*")
        .in(
          "workout_id",
          list.map((w) => w.id)
        )
        .order("position", { ascending: true });
      const grouped: Record<string, Exercise[]> = {};
      (exs ?? []).forEach((e) => {
        (grouped[(e as Exercise).workout_id] ||= []).push(e as Exercise);
      });
      setExercisesByWorkout(grouped);
    } else {
      setExercisesByWorkout({});
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openPlanModal(day: number) {
    setPDay(day);
    setPSport("Musculação");
    setPTitle("");
    setPNotes("");
    setPlanOpen(true);
  }

  async function savePlanEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!pSport.trim()) return;
    setPlanSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const position = plan.filter((p) => p.day_of_week === pDay).length;
    await supabase.from("workout_plan").insert({
      user_id: user.id,
      day_of_week: pDay,
      sport: pSport.trim(),
      title: pTitle.trim() || null,
      notes: pNotes.trim() || null,
      position,
    });
    setPlanSaving(false);
    setPlanOpen(false);
    await load();
  }

  async function removePlanEntry(id: string) {
    await supabase.from("workout_plan").delete().eq("id", id);
    setPlan((prev) => prev.filter((p) => p.id !== id));
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setName("");
    setCategory("");
    setDuration("");
    setNotes("");
    setExercises([emptyExercise()]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        date,
        name: name.trim(),
        category: category.trim() || null,
        duration_min: duration ? Number(duration) : null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (!error && workout) {
      const validExercises = exercises
        .filter((ex) => ex.name.trim())
        .map((ex, i) => ({
          workout_id: (workout as Workout).id,
          user_id: user.id,
          name: ex.name.trim(),
          sets: ex.sets ? Number(ex.sets) : null,
          reps: ex.reps ? Number(ex.reps) : null,
          weight_kg: ex.weight_kg ? Number(ex.weight_kg) : null,
          rpe: ex.rpe ? Number(ex.rpe) : null,
          position: i,
        }));
      if (validExercises.length > 0) {
        await supabase.from("exercises").insert(validExercises);
      }
    }

    setSaving(false);
    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este treino?")) return;
    await supabase.from("workouts").delete().eq("id", id);
    await load();
  }

  function updateExercise(i: number, patch: Partial<ExerciseDraft>) {
    setExercises((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );
  }

  const today = todayIndex();

  // Progressão de carga
  const exerciseNames = Array.from(
    new Set(
      Object.values(exercisesByWorkout)
        .flat()
        .filter((e) => e.weight_kg != null)
        .map((e) => e.name)
    )
  ).sort();
  const currentExercise =
    selectedExercise && exerciseNames.includes(selectedExercise)
      ? selectedExercise
      : exerciseNames[0] ?? "";
  const progressData: { label: string; value: number }[] = [];
  if (currentExercise) {
    const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const w of sorted) {
      const exs = (exercisesByWorkout[w.id] ?? []).filter(
        (e) => e.name === currentExercise && e.weight_kg != null
      );
      if (exs.length) {
        const maxW = Math.max(...exs.map((e) => Number(e.weight_kg)));
        progressData.push({ label: formatDate(w.date).slice(0, 5), value: maxW });
      }
    }
  }
  const progStats =
    progressData.length > 0
      ? {
          current: progressData[progressData.length - 1].value,
          record: Math.max(...progressData.map((r) => r.value)),
          delta:
            Math.round(
              (progressData[progressData.length - 1].value -
                progressData[0].value) *
                10
            ) / 10,
          count: progressData.length,
        }
      : null;

  return (
    <div>
      <PageHeader
        title="Treinos"
        subtitle="Monte seu plano da semana e registre seus treinos."
        action={
          tab === "historico" ? (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Novo treino
            </button>
          ) : undefined
        }
      />

      {/* Abas */}
      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-white/[0.06] dark:bg-slate-900/50">
        <button
          onClick={() => setTab("plano")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            tab === "plano"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <CalendarDays className="h-4 w-4" /> Plano semanal
        </button>
        <button
          onClick={() => setTab("historico")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            tab === "historico"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <History className="h-4 w-4" /> Histórico
        </button>
        <button
          onClick={() => setTab("progressao")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            tab === "progressao"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Progressão
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "plano" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((dayName, day) => {
            const sessions = plan.filter((p) => p.day_of_week === day);
            const isToday = day === today;
            return (
              <div
                key={day}
                className={`card ${
                  isToday ? "ring-2 ring-brand-500/40" : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {dayName}
                    </h3>
                    {isToday && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        hoje
                      </span>
                    )}
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <p className="mb-3 text-sm text-slate-400 dark:text-slate-500">
                    Nada planejado.
                  </p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {sessions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/[0.05] dark:bg-slate-800/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sportChip(
                              s.sport
                            )}`}
                          >
                            {s.sport}
                          </span>
                          <button
                            onClick={() => removePlanEntry(s.id)}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {s.title && (
                          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                            {s.title}
                          </p>
                        )}
                        {s.notes && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {s.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => openPlanModal(day)}
                  className="btn-ghost w-full py-1.5 text-sm"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
            );
          })}
        </div>
      ) : tab === "progressao" ? (
        exerciseNames.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-10 w-10" />}
            title="Sem dados de progressão ainda"
            description="Registre treinos com carga (peso) nos exercícios para acompanhar a evolução."
          />
        ) : (
          <div className="space-y-5">
            <div className="card">
              <label className="label">Exercício</label>
              <select
                className="input"
                value={currentExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                {exerciseNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {progStats && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Carga atual"
                  value={progStats.current}
                  unit="kg"
                  icon={<Dumbbell className="h-5 w-5" />}
                  accent="brand"
                />
                <StatCard
                  label="Recorde"
                  value={progStats.record}
                  unit="kg"
                  icon={<Trophy className="h-5 w-5" />}
                  accent="amber"
                />
                <StatCard
                  label="Variação"
                  value={`${progStats.delta > 0 ? "+" : ""}${progStats.delta}`}
                  unit="kg"
                  icon={<TrendingUp className="h-5 w-5" />}
                  accent={progStats.delta >= 0 ? "brand" : "rose"}
                />
              </div>
            )}

            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Evolução da carga
                </h3>
                <span className="text-xs text-slate-400">
                  {progStats?.count ?? 0} registro(s)
                </span>
              </div>
              {progressData.length > 1 ? (
                <TrendChart data={progressData} unit=" kg" color="#18b85e" />
              ) : (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Registre este exercício em mais de um treino para ver a curva.
                </p>
              )}
            </div>
          </div>
        )
      ) : workouts.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-10 w-10" />}
          title="Nenhum treino registrado"
          description="Toque em “Novo treino” para adicionar o primeiro."
        />
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const exs = exercisesByWorkout[w.id] ?? [];
            const isOpen = expanded === w.id;
            return (
              <div key={w.id} className="card overflow-hidden p-0">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => setExpanded(isOpen ? null : w.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {w.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(w.date)}
                      {w.category ? ` · ${w.category}` : ""}
                      {w.duration_min ? ` · ${w.duration_min} min` : ""}
                      {exs.length ? ` · ${exs.length} exercício(s)` : ""}
                    </p>
                  </button>
                  {exs.length > 0 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : w.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => remove(w.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && exs.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400">
                          <th className="pb-1 font-medium">Exercício</th>
                          <th className="pb-1 font-medium">Séries</th>
                          <th className="pb-1 font-medium">Reps</th>
                          <th className="pb-1 font-medium">Carga</th>
                          <th className="pb-1 font-medium">RPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exs.map((ex) => (
                          <tr
                            key={ex.id}
                            className="border-t border-slate-200/60 dark:border-slate-800"
                          >
                            <td className="py-1.5 font-medium text-slate-700 dark:text-slate-200">
                              {ex.name}
                            </td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-400">
                              {ex.sets ?? "—"}
                            </td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-400">
                              {ex.reps ?? "—"}
                            </td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-400">
                              {ex.weight_kg ? `${ex.weight_kg} kg` : "—"}
                            </td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-400">
                              {ex.rpe ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {w.notes && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Obs.: {w.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal — adicionar treino ao plano semanal */}
      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Adicionar ao plano"
      >
        <form onSubmit={savePlanEntry} className="space-y-4">
          <Field label="Dia da semana">
            <select
              className="input"
              value={pDay}
              onChange={(e) => setPDay(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Esporte / modalidade">
            <input
              className="input"
              list="sports-list"
              value={pSport}
              onChange={(e) => setPSport(e.target.value)}
              placeholder="Ex.: Musculação, Corrida..."
              required
            />
            <datalist id="sports-list">
              {SPORTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Treino / foco (opcional)">
            <input
              className="input"
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="Ex.: Treino A — Peito e tríceps / Corrida 5km"
            />
          </Field>
          <Field label="Observações (opcional)">
            <textarea
              className="input min-h-[60px]"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              placeholder="Ex.: manhã, intensidade leve..."
            />
          </Field>
          <button
            type="submit"
            disabled={planSaving}
            className="btn-primary w-full py-2.5"
          >
            {planSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </button>
        </form>
      </Modal>

      {/* Modal — registrar treino (histórico) */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Novo treino"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Duração (min)">
              <input
                type="number"
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>
          <Field label="Nome do treino">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Treino A — Peito e tríceps"
              required
            />
          </Field>
          <Field label="Categoria / grupo muscular">
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Musculação, Corrida, Peito..."
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Exercícios</span>
              <button
                type="button"
                onClick={() => setExercises((p) => [...p, emptyExercise()])}
                className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                + Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      value={ex.name}
                      onChange={(e) =>
                        updateExercise(i, { name: e.target.value })
                      }
                      placeholder="Ex.: Supino reto"
                    />
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExercises((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input
                      className="input"
                      type="number"
                      value={ex.sets}
                      onChange={(e) =>
                        updateExercise(i, { sets: e.target.value })
                      }
                      placeholder="Séries"
                    />
                    <input
                      className="input"
                      type="number"
                      value={ex.reps}
                      onChange={(e) =>
                        updateExercise(i, { reps: e.target.value })
                      }
                      placeholder="Reps"
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.5"
                      value={ex.weight_kg}
                      onChange={(e) =>
                        updateExercise(i, { weight_kg: e.target.value })
                      }
                      placeholder="Carga kg"
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={ex.rpe}
                      onChange={(e) =>
                        updateExercise(i, { rpe: e.target.value })
                      }
                      placeholder="RPE 1-10"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Observações">
            <textarea
              className="input min-h-[70px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Como foi o treino?"
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-2.5"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar treino
          </button>
        </form>
      </Modal>
    </div>
  );
}
