"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dumbbell,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Workout, Exercise } from "@/lib/types";
import {
  PageHeader,
  Modal,
  Field,
  EmptyState,
  formatDate,
} from "@/components/ui";

type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  weight_kg: string;
};

const emptyExercise = (): ExerciseDraft => ({
  name: "",
  sets: "",
  reps: "",
  weight_kg: "",
});

export default function TreinosPage() {
  const supabase = createClient();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercisesByWorkout, setExercisesByWorkout] = useState<
    Record<string, Exercise[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ws } = await supabase
      .from("workouts")
      .select("*")
      .order("date", { ascending: false });
    const list = (ws ?? []) as Workout[];
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

  return (
    <div>
      <PageHeader
        title="Treinos"
        subtitle="Registre seus treinos e exercícios."
        action={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Novo treino
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
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
              <div key={w.id} className="card p-0 overflow-hidden">
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
                  <div className="mt-2 grid grid-cols-3 gap-2">
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

          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar treino
          </button>
        </form>
      </Modal>
    </div>
  );
}
