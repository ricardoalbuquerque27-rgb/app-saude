"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Check, Play, Pause, RotateCcw, Plus, Trophy, Loader2 } from "lucide-react";

type RoutineEx = {
  name: string;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
};
export type SessionRoutine = {
  id: string;
  name: string;
  exercises: RoutineEx[];
  planId?: string; // se veio de um dia do plano, marca como concluído ao finalizar
};

type SetState = { reps: string; weight: string; done: boolean };
type ExState = { name: string; rest: number; sets: SetState[] };

export type FinishPayload = {
  name: string;
  durationMin: number | null;
  exercises: {
    name: string;
    sets: { reps: number | null; weight: number | null }[];
  }[];
};

function epley(w: number, r: number) {
  return w * (1 + r / 30);
}
function beep() {
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {}
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {}
}

export default function WorkoutSession({
  routine,
  lastByName,
  best1rmByName,
  saving,
  onClose,
  onFinish,
}: {
  routine: SessionRoutine;
  lastByName: Record<string, { reps: number | null; weight: number | null }>;
  best1rmByName: Record<string, number>;
  saving: boolean;
  onClose: () => void;
  onFinish: (p: FinishPayload) => void;
}) {
  const [exs, setExs] = useState<ExState[]>(() =>
    routine.exercises.map((e) => {
      const n = Math.max(1, e.target_sets ?? 1);
      const last = lastByName[e.name.trim().toLowerCase()];
      const reps = e.target_reps ?? last?.reps ?? null;
      const weight = e.target_weight_kg ?? last?.weight ?? null;
      return {
        name: e.name,
        rest: e.rest_seconds ?? 90,
        sets: Array.from({ length: n }, () => ({
          reps: reps != null ? String(reps) : "",
          weight: weight != null ? String(weight) : "",
          done: false,
        })),
      };
    })
  );
  const [prNames, setPrNames] = useState<Set<string>>(new Set());

  // Cronômetro total da sessão.
  const startRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Cronômetro de descanso (dispara ao concluir uma série).
  const [rest, setRest] = useState<{ remaining: number; total: number } | null>(null);
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      setRest((r) => {
        if (!r) return r;
        if (r.remaining <= 1) {
          beep();
          return null;
        }
        return { ...r, remaining: r.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rest]);

  function updSet(ei: number, si: number, patch: Partial<SetState>) {
    setExs((prev) =>
      prev.map((ex, i) =>
        i === ei ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : ex
      )
    );
  }
  function addSet(ei: number) {
    setExs((prev) =>
      prev.map((ex, i) =>
        i === ei
          ? { ...ex, sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1], done: false }] }
          : ex
      )
    );
  }
  function toggleDone(ei: number, si: number) {
    const ex = exs[ei];
    const s = ex.sets[si];
    const willDo = !s.done;
    updSet(ei, si, { done: willDo });
    if (willDo) {
      // dispara descanso
      setRest({ remaining: ex.rest, total: ex.rest });
      // checa PR (1RM estimado)
      const w = Number(s.weight);
      const r = Number(s.reps);
      if (w > 0 && r > 0) {
        const key = ex.name.trim().toLowerCase();
        const baseline = best1rmByName[key] ?? 0;
        if (epley(w, r) > baseline + 0.01 && !prNames.has(ex.name)) {
          setPrNames((prev) => new Set(prev).add(ex.name));
          try {
            navigator.vibrate?.(120);
          } catch {}
        }
      }
    }
  }

  const totalSets = exs.reduce((s, e) => s + e.sets.length, 0);
  const doneSets = exs.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  const progress = totalSets ? doneSets / totalSets : 0;

  const mmss = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;

  function finish() {
    const payload: FinishPayload = {
      name: routine.name,
      durationMin: Math.max(1, Math.round(elapsed / 60)),
      exercises: exs.map((ex) => ({
        name: ex.name,
        sets: ex.sets
          .filter((s) => s.done || s.reps || s.weight)
          .map((s) => ({
            reps: s.reps ? Number(s.reps) : null,
            weight: s.weight ? Number(s.weight) : null,
          })),
      })),
    };
    onFinish(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => {
            if (doneSets === 0 || confirm("Descartar este treino? O que você marcou será perdido."))
              onClose();
          }}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{routine.name}</p>
          <p className="tabular text-xs text-slate-500 dark:text-slate-400">{mmss(elapsed)}</p>
        </div>
        <button
          onClick={finish}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar"}
        </button>
      </div>

      {/* Progresso */}
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Exercícios */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-40">
        <p className="text-center text-xs text-slate-400">
          {doneSets}/{totalSets} séries concluídas
        </p>
        {exs.map((ex, ei) => {
          const last = lastByName[ex.name.trim().toLowerCase()];
          return (
            <div key={ei} className="card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{ex.name}</h3>
                {prNames.has(ex.name) && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <Trophy className="h-3 w-3" /> Recorde!
                  </span>
                )}
              </div>
              {last?.weight != null && (
                <p className="mb-2 text-xs text-slate-400">
                  Última vez: {last.reps ?? "?"}×{last.weight}kg
                </p>
              )}
              <div className="space-y-1.5">
                {ex.sets.map((s, si) => (
                  <div
                    key={si}
                    className={`flex items-center gap-2 rounded-lg p-1.5 ${
                      s.done ? "bg-brand-50 dark:bg-brand-950/20" : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-medium text-slate-400">
                      {si + 1}
                    </span>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => updSet(ei, si, { reps: e.target.value })}
                      placeholder="reps"
                    />
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={s.weight}
                      onChange={(e) => updSet(ei, si, { weight: e.target.value })}
                      placeholder="kg"
                    />
                    <button
                      onClick={() => toggleDone(ei, si)}
                      className={`flex h-9 w-10 shrink-0 items-center justify-center rounded-lg transition ${
                        s.done
                          ? "bg-brand-600 text-white"
                          : "border border-slate-300 text-slate-400 hover:border-brand-400 dark:border-slate-700"
                      }`}
                      aria-label="Concluir série"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addSet(ei)}
                className="mt-2 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                + Série
              </button>
            </div>
          );
        })}
      </div>

      {/* Cronômetro de descanso (aparece durante o descanso) */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Descanso</span>
                <span className="tabular font-semibold text-slate-900 dark:text-white">
                  {mmss(rest.remaining)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${Math.round((rest.remaining / rest.total) * 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setRest((r) => (r ? { ...r, remaining: r.remaining + 15, total: r.total + 15 } : r))}
              className="btn-ghost px-2 py-1.5"
              aria-label="+15s"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={() => setRest(null)} className="btn-primary px-3 py-1.5">
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
