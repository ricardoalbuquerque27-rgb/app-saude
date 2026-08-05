"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Droplets,
  Moon,
  Footprints,
  Smile,
  Loader2,
  Plus,
  Minus,
  Gauge,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyLog, Profile } from "@/lib/types";
import { PageHeader, Field, formatDate } from "@/components/ui";

const MOODS = [
  { value: "otimo", label: "😄 Ótimo" },
  { value: "bem", label: "🙂 Bem" },
  { value: "neutro", label: "😐 Neutro" },
  { value: "cansado", label: "😴 Cansado" },
  { value: "mal", label: "😞 Mal" },
];

export default function HabitosPage() {
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [log, setLog] = useState<Partial<DailyLog>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<DailyLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: current }, { data: prof }, { data: hist }] = await Promise.all([
      supabase.from("daily_logs").select("*").eq("date", date).maybeSingle(),
      supabase.from("profiles").select("*").maybeSingle(),
      supabase
        .from("daily_logs")
        .select("*")
        .order("date", { ascending: false })
        .limit(7),
    ]);
    setLog((current as DailyLog) ?? { date, water_ml: 0 });
    setProfile((prof as Profile) ?? null);
    setHistory((hist ?? []) as DailyLog[]);
    setLoading(false);
  }, [supabase, date]);

  useEffect(() => {
    load();
  }, [load]);

  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const water = log.water_ml ?? 0;
  const waterPct = Math.min(100, Math.round((water / waterGoal) * 100));

  async function persist(patch: Partial<DailyLog>) {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const next = { ...log, ...patch };
    setLog(next);
    await supabase.from("daily_logs").upsert(
      {
        user_id: user.id,
        date,
        water_ml: next.water_ml ?? 0,
        sleep_hours: next.sleep_hours ?? null,
        steps: next.steps ?? null,
        mood: next.mood ?? null,
        energy: next.energy ?? null,
        stress: next.stress ?? null,
        pain: next.pain ?? null,
        notes: next.notes ?? null,
      },
      { onConflict: "user_id,date" }
    );
    setSaving(false);
    // Atualiza histórico em segundo plano
    const { data: hist } = await supabase
      .from("daily_logs")
      .select("*")
      .order("date", { ascending: false })
      .limit(7);
    setHistory((hist ?? []) as DailyLog[]);
  }

  function addWater(ml: number) {
    persist({ water_ml: Math.max(0, water + ml) });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hábitos"
        subtitle="Água, sono, humor e atividade do dia."
        action={
          <input
            type="date"
            className="input max-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      />

      {/* Água */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Água</h2>
          </div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {(water / 1000).toFixed(2)} / {(waterGoal / 1000).toFixed(1)} L
          </span>
        </div>
        <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${waterPct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[200, 300, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              className="btn-ghost"
            >
              <Plus className="h-4 w-4" /> {ml}ml
            </button>
          ))}
          <button
            onClick={() => addWater(-200)}
            className="btn-ghost"
            disabled={water <= 0}
          >
            <Minus className="h-4 w-4" /> 200ml
          </button>
        </div>
      </div>

      {/* Sono, passos, humor */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <Moon className="h-5 w-5 text-violet-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Sono</h2>
          </div>
          <Field label="Horas dormidas">
            <input
              type="number"
              step="0.5"
              className="input"
              value={log.sleep_hours ?? ""}
              onChange={(e) =>
                setLog((p) => ({
                  ...p,
                  sleep_hours: e.target.value ? Number(e.target.value) : null,
                }))
              }
              onBlur={() => persist({ sleep_hours: log.sleep_hours })}
              placeholder="8"
            />
          </Field>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <Footprints className="h-5 w-5 text-brand-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Passos</h2>
          </div>
          <Field label="Passos no dia">
            <input
              type="number"
              className="input"
              value={log.steps ?? ""}
              onChange={(e) =>
                setLog((p) => ({
                  ...p,
                  steps: e.target.value ? Number(e.target.value) : null,
                }))
              }
              onBlur={() => persist({ steps: log.steps })}
              placeholder="8000"
            />
          </Field>
        </div>
      </div>

      <div className="card mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Smile className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Como você se sente?
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => persist({ mood: m.value })}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                log.mood === m.value
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bem-estar */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-rose-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Bem-estar
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Energia (1–5)">
            <select
              className="input"
              value={log.energy ?? ""}
              onChange={(e) =>
                persist({ energy: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estresse (1–5)">
            <select
              className="input"
              value={log.stress ?? ""}
              onChange={(e) =>
                persist({ stress: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dor (0–10)">
            <select
              className="input"
              value={log.pain ?? ""}
              onChange={(e) =>
                persist({ pain: e.target.value !== "" ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Energia e estresse: 1 = baixo, 5 = alto. Dor: 0 = nenhuma, 10 = máxima.
        </p>
      </div>

      {saving && (
        <p className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" /> salvando...
        </p>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
            Últimos dias
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDate(h.date)}
                </span>
                <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>💧 {((h.water_ml ?? 0) / 1000).toFixed(1)}L</span>
                  {h.sleep_hours != null && <span>😴 {h.sleep_hours}h</span>}
                  {h.steps != null && <span>👟 {h.steps}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
