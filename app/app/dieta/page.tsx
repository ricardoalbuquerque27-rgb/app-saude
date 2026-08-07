"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Salad,
  Plus,
  Trash2,
  Loader2,
  Camera,
  Sparkles,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Meal } from "@/lib/types";
import { PageHeader, Modal, Field, EmptyState } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";

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
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [proteinGoal, setProteinGoal] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mealType, setMealType] = useState(MEAL_TYPES[0]);
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNote, setAnalyzeNote] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("daily_calorie_goal, protein_goal_g")
        .maybeSingle();
      setCalorieGoal(data?.daily_calorie_goal ?? null);
      setProteinGoal(data?.protein_goal_g ?? null);
    })();
  }, [supabase]);

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein_g) || 0),
      carbs: acc.carbs + (Number(m.carbs_g) || 0),
      fat: acc.fat + (Number(m.fat_g) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;
  function shiftDate(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Distribuição de macros (por calorias: P/C 4, G 9)
  const pCal = totals.protein * 4;
  const cCal = totals.carbs * 4;
  const fCal = totals.fat * 9;
  const macroCal = pCal + cCal + fCal || 1;

  function resetForm() {
    setMealType(MEAL_TYPES[0]);
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAnalyzeError(null);
    setAnalyzeNote(null);
  }

  // Redimensiona a foto no navegador antes de enviar (mais rápido e barato).
  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1024;
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            const scale = maxSide / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error("img"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  async function analyzePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar a mesma foto
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeNote(null);
    try {
      const image = await resizeImage(file);
      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data?.error ?? "Falha ao analisar a foto.");
        return;
      }
      if (data.description) setDescription(data.description);
      if (data.calories != null) setCalories(String(data.calories));
      if (data.protein_g != null) setProtein(String(data.protein_g));
      if (data.carbs_g != null) setCarbs(String(data.carbs_g));
      if (data.fat_g != null) setFat(String(data.fat_g));
      const conf =
        data.confidence === "baixa"
          ? " (confiança baixa — confira os valores)"
          : "";
      setAnalyzeNote("Preenchido pela IA — revise antes de salvar." + conf);
    } catch {
      setAnalyzeError("Não foi possível processar a imagem. Tente outra foto.");
    } finally {
      setAnalyzing(false);
    }
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

      {/* Navegador de data */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => shiftDate(-1)}
          className="btn-ghost h-10 w-10 justify-center px-0"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="relative flex-1 sm:max-w-[220px]">
          <input
            type="date"
            className="input pr-3 text-center"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="btn-ghost h-10 w-10 justify-center px-0 disabled:opacity-40"
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isToday && (
          <button onClick={() => setDate(todayStr)} className="chip">
            Hoje
          </button>
        )}
      </div>

      {/* Resumo do dia */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Resumo do dia
            </h2>
            <p className="text-xs capitalize text-slate-400">{dateLabel}</p>
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

        <div className="grid grid-cols-2 gap-2">
          <ProgressRing
            pct={calorieGoal ? totals.calories / calorieGoal : 0}
            centerMain={`${Math.round(totals.calories)}`}
            centerSub={calorieGoal ? `/ ${calorieGoal}` : "kcal"}
            label="Calorias"
            colorClass="text-amber-500"
          />
          <ProgressRing
            pct={proteinGoal ? totals.protein / proteinGoal : 0}
            centerMain={`${Math.round(totals.protein)}`}
            centerSub={proteinGoal ? `/ ${proteinGoal} g` : "g"}
            label="Proteína"
            colorClass="text-rose-500"
          />
        </div>

        {/* Distribuição de macros */}
        <div className="mt-5">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="bg-rose-500" style={{ width: `${(pCal / macroCal) * 100}%` }} />
            <div className="bg-blue-500" style={{ width: `${(cCal / macroCal) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(fCal / macroCal) * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Proteína{" "}
              <span className="tabular font-medium text-slate-700 dark:text-slate-300">
                {Math.round(totals.protein)}g
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Carbo{" "}
              <span className="tabular font-medium text-slate-700 dark:text-slate-300">
                {Math.round(totals.carbs)}g
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Gordura{" "}
              <span className="tabular font-medium text-slate-700 dark:text-slate-300">
                {Math.round(totals.fat)}g
              </span>
            </span>
          </div>
        </div>
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
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={analyzePhoto}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={analyzePhoto}
          />
          <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 dark:border-brand-800 dark:bg-brand-950/30">
            <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              Analisar foto do prato com IA
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={analyzing}
                className="btn-primary py-2.5"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="btn-ghost py-2.5"
              >
                <Upload className="h-4 w-4" />
                Enviar arquivo
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {analyzing
                ? "Analisando foto…"
                : "Tire uma foto ou escolha uma imagem da galeria — a IA estima calorias e macros."}
            </p>
            {analyzeNote && (
              <p className="mt-2 rounded-lg bg-brand-100 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                {analyzeNote}
              </p>
            )}
            {analyzeError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {analyzeError}
              </p>
            )}
          </div>

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
