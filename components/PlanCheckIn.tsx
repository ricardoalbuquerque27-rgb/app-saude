"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  setPlanCheck,
  indexCompletions,
  completionKey,
  type CheckStatus,
  type Completion,
  type PlanSession,
} from "@/lib/planCheckIn";

// Check-in do treino planejado, para o paciente. Aparece no dashboard e na
// aba Plano. Sem marcação = "sem resposta"; tocar de novo no mesmo botão
// desfaz.
export default function PlanCheckIn({
  sessions,
  date,
  completions,
  compact = false,
}: {
  sessions: PlanSession[];
  date: string;
  completions: Completion[];
  compact?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Guarda qual sessão acabou de ser salva, para dar o "pop" de confirmação.
  const [pop, setPop] = useState<string | null>(null);
  const idx = indexCompletions(completions);

  async function mark(session: PlanSession, status: CheckStatus) {
    setBusy(session.id);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      return;
    }
    const current = idx[completionKey(session.id, date)] ?? null;
    // Tocar no botão já ativo desfaz a marcação.
    const next: CheckStatus | null = current?.status === status ? null : status;

    const { error } = await setPlanCheck(
      supabase,
      user.id,
      session,
      date,
      next,
      current
    );
    setBusy(null);
    if (error) {
      setErro("Não foi possível salvar. Tente de novo.");
      return;
    }
    if (next !== null) {
      setPop(session.id);
      setTimeout(() => setPop(null), 400);
    }
    window.dispatchEvent(
      new CustomEvent("pf-data-changed", { detail: { areas: ["treinos"] } })
    );
    router.refresh();
  }

  if (sessions.length === 0) return null;

  return (
    <div className={compact ? "" : "space-y-2"}>
      {sessions.map((s) => {
        const current = idx[completionKey(s.id, date)];
        const done = current?.status === "done";
        const skipped = current?.status === "skipped";
        const loading = busy === s.id;

        return (
          <div
            key={s.id}
            className={
              compact
                ? "mt-2 flex gap-1.5"
                : "rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.07] dark:bg-slate-900/70"
            }
          >
            {!compact && (
              <>
                <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {s.sport}
                </span>
                {s.title && (
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {s.title}
                  </p>
                )}
              </>
            )}

            <div className={compact ? "flex w-full gap-1.5" : "mt-2.5 flex gap-2"}>
              <button
                onClick={() => mark(s, "done")}
                disabled={loading}
                aria-pressed={done}
                className={`tappable flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  pop === s.id && done ? "pf-pop" : ""
                } ${
                  done
                    ? "bg-brand-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {done ? "Fui treinar" : "Fui"}
              </button>
              <button
                onClick={() => mark(s, "skipped")}
                disabled={loading}
                aria-pressed={skipped}
                className={`tappable flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  pop === s.id && skipped ? "pf-pop" : ""
                } ${
                  skipped
                    ? "bg-rose-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-rose-400 hover:text-rose-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-rose-500 dark:hover:text-rose-300"
                }`}
              >
                <X className="h-3.5 w-3.5" />
                {skipped ? "Não fui" : "Não fui"}
              </button>
            </div>

            {!compact && !current && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Seu nutricionista vê essa confirmação.
              </p>
            )}
          </div>
        );
      })}
      {erro && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}
    </div>
  );
}
