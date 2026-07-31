"use client";

import { useEffect, useState, useCallback } from "react";
import { Salad, Plus, Trash2, Loader2, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Meal } from "@/lib/types";
import { PageHeader, Modal, Field, EmptyState, StatCard } from "@/components/ui";

const MEAL_TYPES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];

export default function DietaPage() {
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mealType, setMealType] = useState(MEAL_TYPES[0]);
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("meals")
      .select("*")
      .eq("date", date)
      .order("created_at", { ascending: true });
    setMeals((data ?? []) as Meal[]);
    setLoading(false);
  }, [supabase, date]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein_g) || 0),
      carbs: acc.carbs + (Number(m.carbs_g) || 0),
      fat: acc.fat + (Number(m.fat_g) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  function resetForm() {
    setMealType(MEAL_TYPES[0]);
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("meals").insert({
      user_id: user.id,
      date,
      meal_type: mealType,
      description: description.trim(),
      calories: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
    });
    setSaving(false);
    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(id: string) {
    await supabase.from("meals").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Dieta"
        subtitle="Acompanhe suas refeições e macros."
        action={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Refeição
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <input
          type="date"
          className="input max-w-[180px]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Calorias"
          value={Math.round(totals.calories)}
          unit="kcal"
          icon={<Flame className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard label="Proteína" value={Math.round(totals.protein)} unit="g" accent="brand" />
        <StatCard label="Carboidrato" value={Math.round(totals.carbs)} unit="g" accent="blue" />
        <StatCard label="Gordura" value={Math.round(totals.fat)} unit="g" accent="rose" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : meals.length === 0 ? (
        <EmptyState
          icon={<Salad className="h-10 w-10" />}
          title="Nenhuma refeição neste dia"
          description="Adicione o que você comeu para acompanhar calorias e macros."
        />
      ) : (
        <div className="space-y-3">
          {meals.map((m) => (
            <div key={m.id} className="card flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Salad className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    {m.meal_type}
                  </p>
                  <button
                    onClick={() => remove(m.id)}
                    className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {m.description}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {m.calories != null && <span>{Math.round(Number(m.calories))} kcal</span>}
                  {m.protein_g != null && <span>P: {m.protein_g}g</span>}
                  {m.carbs_g != null && <span>C: {m.carbs_g}g</span>}
                  {m.fat_g != null && <span>G: {m.fat_g}g</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Nova refeição"
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Tipo de refeição">
            <select
              className="input"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Descrição">
            <textarea
              className="input min-h-[70px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: 2 ovos, 50g de aveia, 1 banana"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorias (kcal)">
              <input
                type="number"
                className="input"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="350"
              />
            </Field>
            <Field label="Proteína (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="25"
              />
            </Field>
            <Field label="Carboidrato (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="40"
              />
            </Field>
            <Field label="Gordura (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="10"
              />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar refeição
          </button>
        </form>
      </Modal>
    </div>
  );
}
