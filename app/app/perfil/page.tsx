"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PageHeader, Field } from "@/components/ui";

export default function PerfilPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [height, setHeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [waterGoal, setWaterGoal] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .maybeSingle();
    const p = data as Profile | null;
    if (p) {
      setFullName(p.full_name ?? "");
      setHeight(p.height_cm?.toString() ?? "");
      setBirthDate(p.birth_date ?? "");
      setWeightGoal(p.weight_goal_kg?.toString() ?? "");
      setWaterGoal(p.daily_water_goal_ml?.toString() ?? "");
      setCalorieGoal(p.daily_calorie_goal?.toString() ?? "");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim() || null,
      height_cm: height ? Number(height) : null,
      birth_date: birthDate || null,
      weight_goal_kg: weightGoal ? Number(weightGoal) : null,
      daily_water_goal_ml: waterGoal ? Number(waterGoal) : 2500,
      daily_calorie_goal: calorieGoal ? Number(calorieGoal) : null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Perfil" subtitle="Seus dados e metas." />

      <div className="card mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <User className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {fullName || "Sem nome"}
          </p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {email}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Dados</h2>
        <Field label="Nome completo">
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altura (cm)">
            <input
              type="number"
              className="input"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              className="input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
        </div>

        <h2 className="pt-2 font-semibold text-slate-900 dark:text-white">
          Metas
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Peso alvo (kg)">
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightGoal}
              onChange={(e) => setWeightGoal(e.target.value)}
              placeholder="75"
            />
          </Field>
          <Field label="Água/dia (ml)">
            <input
              type="number"
              className="input"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              placeholder="2500"
            />
          </Field>
          <Field label="Calorias/dia">
            <input
              type="number"
              className="input"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              placeholder="2000"
            />
          </Field>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "Salvo!" : "Salvar alterações"}
        </button>
      </form>

      <button
        onClick={signOut}
        className="btn-ghost mt-6 w-full py-2.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </div>
  );
}
