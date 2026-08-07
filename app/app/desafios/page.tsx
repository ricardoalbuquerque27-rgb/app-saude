"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Check,
  Trophy,
  Dumbbell,
  Salad,
  Droplets,
  Flame,
  Scale,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CHALLENGES, weekStartISO, type ChallengeMetric } from "@/lib/challenges";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Dumbbell,
  Salad,
  Droplets,
  Flame,
  Scale,
};

export default function DesafiosPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<ChallengeMetric, number>>({
    workouts: 0,
    meals: 0,
    waterGoalDays: 0,
    activeDays: 0,
    measurements: 0,
  });
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);

  const weekStart = weekStartISO();

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [prof, wk, ml, dl, bm, comp] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_water_goal_ml")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("workouts").select("date").eq("user_id", user.id).gte("date", weekStart),
      supabase.from("meals").select("date").eq("user_id", user.id).gte("date", weekStart),
      supabase
        .from("daily_logs")
        .select("date, water_ml")
        .eq("user_id", user.id)
        .gte("date", weekStart),
      supabase
        .from("body_measurements")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", weekStart),
      supabase
        .from("challenge_completions")
        .select("challenge_id")
        .eq("user_id", user.id)
        .eq("week_start", weekStart),
    ]);

    const waterGoal = prof.data?.daily_water_goal_ml ?? 2500;
    const workouts = (wk.data ?? []).length;
    const meals = (ml.data ?? []).length;
    const waterGoalDays = (dl.data ?? []).filter(
      (l) => (Number(l.water_ml) || 0) >= waterGoal
    ).length;
    const measurements = (bm.data ?? []).length;

    const activeSet = new Set<string>();
    (wk.data ?? []).forEach((r) => r.date && activeSet.add(r.date));
    (ml.data ?? []).forEach((r) => r.date && activeSet.add(r.date));
    (dl.data ?? []).forEach((r) => r.date && activeSet.add(r.date));
    (bm.data ?? []).forEach((r) => r.date && activeSet.add(r.date));

    setProgress({
      workouts,
      meals,
      waterGoalDays,
      activeDays: activeSet.size,
      measurements,
    });
    setClaimed(new Set((comp.data ?? []).map((c) => c.challenge_id)));
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(id: string, xp: number) {
    if (claiming) return;
    setClaiming(id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("challenge_completions")
      .insert({ user_id: user.id, challenge_id: id, week_start: weekStart, xp });
    if (!error) {
      setClaimed((prev) => new Set(prev).add(id));
    }
    setClaiming(null);
  }

  const earnedXp = CHALLENGES.filter((c) => claimed.has(c.id)).reduce(
    (s, c) => s + c.xp,
    0
  );
  const totalXp = CHALLENGES.reduce((s, c) => s + c.xp, 0);
  const doneCount = CHALLENGES.filter(
    (c) => claimed.has(c.id) || progress[c.metric] >= c.target
  ).length;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Desafios da semana"
        subtitle="Complete metas e ganhe XP extra. Reinicia toda segunda-feira."
      />

      {/* Resumo */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Trophy className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-brand-50/80">XP de desafios nesta semana</p>
            <p className="text-2xl font-bold tracking-tight">
              {earnedXp}
              <span className="text-base font-medium text-brand-50/70">
                {" "}
                / {totalXp} XP
              </span>
            </p>
            <p className="mt-0.5 text-xs text-brand-50/80">
              {doneCount}/{CHALLENGES.length} desafios concluídos
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {CHALLENGES.map((c) => {
            const Icon = ICONS[c.icon] ?? Trophy;
            const current = Math.min(progress[c.metric], c.target);
            const isClaimed = claimed.has(c.id);
            const isDone = progress[c.metric] >= c.target;
            const pct = Math.round((current / c.target) * 100);

            return (
              <div
                key={c.id}
                className={`card ${isClaimed ? "border-brand-200 dark:border-brand-900/50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isClaimed
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {c.title}
                      </p>
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                        <Sparkles className="h-3 w-3" /> {c.xp} XP
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {c.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  {isClaimed ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                      <Check className="h-4 w-4" /> Concluído · +{c.xp} XP
                    </div>
                  ) : isDone ? (
                    <button
                      onClick={() => claim(c.id, c.xp)}
                      disabled={claiming === c.id}
                      className="btn-primary w-full py-2.5"
                    >
                      {claiming === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Resgatar +{c.xp} XP
                    </button>
                  ) : (
                    <>
                      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {progress[c.metric]} / {c.target}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        O XP dos desafios entra no seu nível em Conquistas.
      </p>
    </div>
  );
}
