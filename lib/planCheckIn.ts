import { todayISO, addDaysISO } from "@/lib/date";

// Check-in do treino planejado.
//
// Três estados possíveis para um treino previsto num dia:
//   "done"    → o paciente confirmou que treinou (linha com status 'done')
//   "skipped" → declarou que não foi          (linha com status 'skipped')
//   null      → sem resposta                  (nenhuma linha)
//
// "Sem resposta" é diferente de "faltou": é o que permite ao nutricionista
// distinguir quem furou de quem só não marcou.

export type CheckStatus = "done" | "skipped";

export type PlanSession = {
  id: string;
  sport: string | null;
  title: string | null;
  day_of_week: number;
};

export type Completion = {
  id: string;
  plan_id: string | null;
  date: string;
  status: string;
  workout_id: string | null;
};

/** Índice `${plan_id}|${date}` → completion, para consulta O(1) na tela. */
export function indexCompletions(rows: Completion[]): Record<string, Completion> {
  const out: Record<string, Completion> = {};
  for (const c of rows) {
    if (c.plan_id) out[`${c.plan_id}|${c.date}`] = c;
  }
  return out;
}

export function completionKey(planId: string, date: string) {
  return `${planId}|${date}`;
}

/** Segunda-feira da semana de `iso` (o plano usa 0 = segunda). */
export function mondayOf(iso: string = todayISO()): string {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  return addDaysISO(iso, -dow);
}

/** As 7 datas da semana de `iso`, de segunda a domingo. */
export function weekDates(iso: string = todayISO()): string[] {
  const mon = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i));
}

/**
 * Grava (ou desfaz) o check-in de uma sessão do plano numa data.
 *
 * `status` nulo remove a marcação e volta ao estado "sem resposta".
 * Marcar como "done" também cria um treino no histórico, para o registro
 * contar nas estatísticas; desmarcar remove esse treino.
 */
export async function setPlanCheck(
  supabase: any,
  uid: string,
  session: PlanSession,
  date: string,
  status: CheckStatus | null,
  existing?: Completion | null
): Promise<{ error: string | null }> {
  // Descobre a linha atual quando quem chama não a tem em mãos.
  let current = existing ?? null;
  if (current === undefined || current === null) {
    const { data } = await supabase
      .from("plan_completions")
      .select("id, plan_id, date, status, workout_id")
      .eq("plan_id", session.id)
      .eq("date", date)
      .maybeSingle();
    current = (data as Completion) ?? null;
  }

  // Desmarcar: apaga a linha e o treino que ela tenha gerado.
  if (status === null) {
    if (!current) return { error: null };
    if (current.workout_id) {
      await supabase.from("workouts").delete().eq("id", current.workout_id);
    }
    const { error } = await supabase
      .from("plan_completions")
      .delete()
      .eq("id", current.id);
    return { error: error?.message ?? null };
  }

  // O treino no histórico só existe para "fui". Ao trocar para "não fui",
  // o treino criado antes precisa sair junto.
  let workoutId: string | null = current?.workout_id ?? null;

  if (status === "skipped" && workoutId) {
    await supabase.from("workouts").delete().eq("id", workoutId);
    workoutId = null;
  }

  if (status === "done" && !workoutId) {
    const { data: w } = await supabase
      .from("workouts")
      .insert({
        user_id: uid,
        date,
        name: session.title || session.sport || "Treino",
        category: session.sport,
        notes: "Confirmado pelo plano semanal",
      })
      .select("id")
      .single();
    workoutId = (w as any)?.id ?? null;
  }

  const { error } = await supabase.from("plan_completions").upsert(
    {
      user_id: uid,
      plan_id: session.id,
      date,
      status,
      workout_id: workoutId,
    },
    { onConflict: "plan_id,date" }
  );

  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Adesão ao plano (usado no painel do nutricionista)
// ---------------------------------------------------------------------------

export type PlanAdherence = {
  /** Sessões previstas em dias que já passaram (inclui hoje). */
  previstas: number;
  confirmadas: number;
  faltas: number;
  semResposta: number;
  /** 0–100, sobre as previstas. Null quando não há nada previsto. */
  percentual: number | null;
};

/**
 * Cruza o plano semanal (que é um molde por dia da semana) com os check-ins
 * de um intervalo de datas. Dias futuros não contam — só o que já venceu.
 */
export function computeAdherence(
  plan: { id: string; day_of_week: number }[],
  completions: Completion[],
  dates: string[],
  today: string = todayISO()
): PlanAdherence {
  const idx = indexCompletions(completions);
  let previstas = 0;
  let confirmadas = 0;
  let faltas = 0;

  for (const date of dates) {
    if (date > today) continue;
    const dow = (new Date(date + "T12:00:00").getDay() + 6) % 7;
    for (const p of plan.filter((x) => x.day_of_week === dow)) {
      previstas++;
      const c = idx[completionKey(p.id, date)];
      if (c?.status === "done") confirmadas++;
      else if (c?.status === "skipped") faltas++;
    }
  }

  return {
    previstas,
    confirmadas,
    faltas,
    semResposta: previstas - confirmadas - faltas,
    percentual: previstas ? Math.round((confirmadas / previstas) * 100) : null,
  };
}
