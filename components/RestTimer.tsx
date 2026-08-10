"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";

const PRESETS = [45, 60, 90, 120, 180];

// Cronômetro de descanso entre séries. Toca um bip e vibra ao terminar.
export default function RestTimer() {
  const [total, setTotal] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function finish() {
    setRunning(false);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        setTimeout(() => ctx.close().catch(() => {}), 600);
      }
    } catch {}
  }

  function setPreset(s: number) {
    setTotal(s);
    setRemaining(s);
    setRunning(true);
  }
  function toggle() {
    if (remaining === 0) {
      setRemaining(total);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  }
  function reset() {
    setRunning(false);
    setRemaining(total);
  }
  function bump(delta: number) {
    setRemaining((r) => Math.max(0, r + delta));
    setTotal((t) => Math.max(15, t + delta));
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const pct = total > 0 ? remaining / total : 0;
  const done = remaining === 0;

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Timer className="h-4 w-4" />
        </span>
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Cronômetro de descanso
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg width={96} height={96} className="-rotate-90">
            <circle
              cx={48}
              cy={48}
              r={42}
              fill="none"
              strokeWidth={7}
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            <circle
              cx={48}
              cy={48}
              r={42}
              fill="none"
              strokeWidth={7}
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - pct)}
              className={done ? "text-rose-500" : "text-brand-500"}
            />
          </svg>
          <span
            className={`tabular absolute text-xl font-bold ${
              done ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
            }`}
          >
            {mm}:{ss.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button onClick={() => bump(-15)} className="btn-ghost px-2 py-1.5" aria-label="-15s">
              <Minus className="h-4 w-4" />
            </button>
            <button onClick={toggle} className="btn-primary flex-1 py-2">
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pausar" : done ? "Repetir" : "Iniciar"}
            </button>
            <button onClick={reset} className="btn-ghost px-2 py-1.5" aria-label="Reiniciar">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={() => bump(15)} className="btn-ghost px-2 py-1.5" aria-label="+15s">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => setPreset(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  total === s
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {s < 60 ? `${s}s` : `${s / 60}min`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
