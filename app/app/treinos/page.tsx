"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dumbbell,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CalendarDays,
  History,
  TrendingUp,
  Trophy,
  Stethoscope,
  BarChart3,
  Copy,
  Zap,
  ListChecks,
  Play,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Workout, Exercise } from "@/lib/types";
import { PageHeader, Modal, Field, EmptyState, StatCard } from "@/components/ui";
import { TrendChart, BarsChart } from "@/components/charts";
import {
  weekDates,
  indexCompletions,
  completionKey,
  setPlanCheck,
  type Completion,
} from "@/lib/planCheckIn";
import { todayISO, weekStartISO, formatDate } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import RestTimer from "@/components/RestTimer";
import { BotoesDoCheckIn, ERRO_DO_CHECKIN, statusDoCheckIn } from "@/components/PlanCheckIn";
import { gravarTreinoAoVivo, ERRO_DO_TREINO } from "@/lib/treinoAoVivo";
import PlateCalculator from "@/components/PlateCalculator";
import WorkoutSession, {
  type SessionRoutine,
  type FinishPayload,
} from "@/components/WorkoutSession";

// Segunda = 0 ... Domingo = 6
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const SPORTS = [
  "Musculação",
  "Corrida",
  "Ciclismo",
  "Natação",
  "Crossfit",
  "Funcional",
  "HIIT",
  "Yoga",
  "Pilates",
  "Futebol",
  "Caminhada",
  "Alongamento",
  "Descanso",
];

// Duas cores só: o descanso é neutro e o resto, a principal. Uma cor por
// modalidade (âmbar, azul, violeta) era enfeite: o nome da modalidade já está
// escrito no próprio selo, e o âmbar é o do aviso, que não cabe a "Corrida".
function sportChip(sport: string) {
  if (sport.toLowerCase().includes("descanso"))
    return "bg-app-pagina text-app-texto-2";
  return "bg-app-primaria-fundo text-app-primaria";
}

type PlanEntry = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  notes: string | null;
  position: number;
  routine_id: string | null;
  prescribed_by: string | null;
};

type SetDraft = { reps: string; weight: string };
type ExerciseDraft = { name: string; rpe: string; sets: SetDraft[] };

const emptyExercise = (): ExerciseDraft => ({
  name: "",
  rpe: "",
  sets: [{ reps: "", weight: "" }],
});

// Rascunho de exercício de uma rotina (com metas).
type RoutineExDraft = {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
};
const emptyRoutineEx = (): RoutineExDraft => ({
  name: "",
  sets: "3",
  reps: "10",
  weight: "",
  rest: "90",
});
type RoutineWithEx = {
  id: string;
  name: string;
  notes: string | null;
  exercises: {
    name: string;
    target_sets: number | null;
    target_reps: number | null;
    target_weight_kg: number | null;
    rest_seconds: number | null;
  }[];
};

function todayIndex() {
  return (new Date(todayISO() + "T12:00:00").getDay() + 6) % 7; // 0=Segunda
}
// Séries de um exercício (usa o detalhe salvo; senão, resume pelas colunas)
function setsOf(ex: Exercise): { reps: number | null; weight: number | null }[] {
  const j = ex.sets_json as any;
  if (Array.isArray(j) && j.length) {
    return j.map((s: any) => ({ reps: s?.reps ?? null, weight: s?.weight ?? null }));
  }
  const n = Math.max(1, ex.sets ?? 1);
  return Array.from({ length: n }, () => ({
    reps: ex.reps ?? null,
    weight: ex.weight_kg ?? null,
  }));
}

function PlanStat({
  value,
  sub,
  label,
}: {
  value: string;
  sub?: string;
  label: string;
}) {
  return (
    <div className="px-2 text-center">
      <p className="tabular text-xl font-semibold text-app-texto">
        {value}
        {sub && <span className="ml-1 text-[13px] font-medium text-app-texto-2">{sub}</span>}
      </p>
      <p className="mt-0.5 text-[13px] text-app-texto-2">{label}</p>
    </div>
  );
}

export default function TreinosPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<
    "plano" | "rotinas" | "historico" | "progressao"
  >("plano");
  const [progView, setProgView] = useState<"carga" | "volume">("carga");
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  // Plano semanal
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  // Check-ins da SEMANA inteira (não só de hoje), indexados por plan_id|data.
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  // Qual check-in grava (sessão e data) e qual resposta: o giro vai no botão tocado.
  const [busyDone, setBusyDone] = useState<{ chave: string; status: "done" | "skipped" } | null>(null);
  // Em qual sessão e dia o check-in falhou: o aviso vai embaixo dos botões dela.
  const [erroDoCheckIn, setErroDoCheckIn] = useState<string | null>(null);
  // Vínculo ativo com nutricionista: só com ele a sessão `prescribed_by` é
  // "prescrita" (Fui e Não fui); sem ele, é do paciente (só Fiz). A mesma regra
  // da Início (montarParaHoje) e da leitura do treino.
  const [vinculoAtivo, setVinculoAtivo] = useState(false);
  const [pDay, setPDay] = useState(0);
  const [pSport, setPSport] = useState("Musculação");
  const [pTitle, setPTitle] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [pRoutineId, setPRoutineId] = useState("");

  // Histórico
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercisesByWorkout, setExercisesByWorkout] = useState<
    Record<string, Exercise[]>
  >({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()]);

  // Rotinas (M1a)
  const [routines, setRoutines] = useState<RoutineWithEx[]>([]);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [rName, setRName] = useState("");
  const [rNotes, setRNotes] = useState("");
  const [rExercises, setRExercises] = useState<RoutineExDraft[]>([emptyRoutineEx()]);

  // Sessão ao vivo (M1b)
  const [sessionRoutine, setSessionRoutine] = useState<SessionRoutine | null>(null);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionErro, setSessionErro] = useState<string | null>(null);
  // O treino salvo cujo check-in falhou: o aviso fica no topo até a próxima aba.
  const [avisoDoTreino, setAvisoDoTreino] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, wsRes, compRes, routRes, routExRes, vinculoRes] = await Promise.all([
      supabase
        .from("workout_plan")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("position", { ascending: true }),
      supabase.from("workouts").select("*").order("date", { ascending: false }),
      supabase
        .from("plan_completions")
        .select("id, plan_id, date, status, workout_id")
        .gte("date", weekDates()[0])
        .lte("date", weekDates()[6]),
      supabase
        .from("routines")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("routine_exercises")
        .select("*")
        .order("position", { ascending: true }),
      // A RLS só mostra ao paciente os vínculos dele, como na Início.
      supabase
        .from("patient_links")
        .select("nutritionist_id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    setPlan((planRes.data ?? []) as PlanEntry[]);
    // Com a leitura do vínculo falhando, vale o que a sessão diz
    // (`prescribed_by`): o check-in grava a mesma linha nos dois casos, e tirar
    // o "Não fui" de quem tem nutricionista por uma falha de leitura seria pior.
    setVinculoAtivo(!!vinculoRes.data || !!vinculoRes.error);

    // Agrupa exercícios por rotina.
    const exByRoutine: Record<string, any[]> = {};
    (routExRes.data ?? []).forEach((e: any) => {
      (exByRoutine[e.routine_id] ||= []).push(e);
    });
    setRoutines(
      (routRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        notes: r.notes,
        exercises: (exByRoutine[r.id] ?? []).map((e: any) => ({
          name: e.name,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight_kg: e.target_weight_kg,
          rest_seconds: e.rest_seconds,
        })),
      }))
    );

    setCompletions((compRes.data ?? []) as Completion[]);

    const list = (wsRes.data ?? []) as Workout[];
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

  // Recarrega quando a IA adiciona/registra um treino.
  useLiveRefresh("treinos", load);

  // Última performance e melhor 1RM (Epley) por exercício (para sugestões).
  const perfByName = useMemo(() => {
    const map: Record<
      string,
      { last?: { reps: number | null; weight: number | null; date: string }; best1rm: number }
    > = {};
    for (const w of workouts) {
      for (const ex of exercisesByWorkout[w.id] ?? []) {
        const key = ex.name.trim().toLowerCase();
        if (!key) continue;
        const sets = setsOf(ex);
        const m = (map[key] ||= { best1rm: 0 });
        if (!m.last) {
          const withW = sets.filter((s) => s.weight != null);
          const best = (withW.length
            ? [...withW].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
            : sets)[0];
          m.last = { reps: best?.reps ?? null, weight: best?.weight ?? null, date: w.date };
        }
        for (const s of sets) {
          if (s.weight != null && s.reps != null && s.reps > 0) {
            const e = s.weight * (1 + s.reps / 30);
            if (e > m.best1rm) m.best1rm = e;
          }
        }
      }
    }
    return map;
  }, [workouts, exercisesByWorkout]);

  function progressionHint(name: string): string | null {
    const p = perfByName[name.trim().toLowerCase()];
    if (!p?.last || p.last.weight == null) return null;
    const w = p.last.weight;
    const r = p.last.reps;
    const next = Math.round(w * 1.025 * 2) / 2; // +2,5% arredondado a 0,5 kg
    const nextTxt = next > w ? `tente ${next}kg` : "tente +2,5kg";
    return `Última vez: ${r ?? "?"}×${w}kg · ${nextTxt} ou +1 rep`;
  }

  function repeatLast() {
    const w = workouts[0];
    if (!w) return;
    const exs = exercisesByWorkout[w.id] ?? [];
    setDate(todayISO());
    setName(w.name);
    setCategory(w.category ?? "");
    setDuration(w.duration_min ? String(w.duration_min) : "");
    setNotes("");
    setExercises(
      exs.length
        ? exs.map((ex) => ({
            name: ex.name,
            rpe: ex.rpe != null ? String(ex.rpe) : "",
            sets: setsOf(ex).map((s) => ({
              reps: s.reps != null ? String(s.reps) : "",
              weight: s.weight != null ? String(s.weight) : "",
            })),
          }))
        : [emptyExercise()]
    );
    setOpen(true);
  }

  // ----- Rotinas (M1a) -----
  function openNewRoutine() {
    setEditingRoutineId(null);
    setRName("");
    setRNotes("");
    setRExercises([emptyRoutineEx()]);
    setRoutineOpen(true);
  }
  function openEditRoutine(r: RoutineWithEx) {
    setEditingRoutineId(r.id);
    setRName(r.name);
    setRNotes(r.notes ?? "");
    setRExercises(
      r.exercises.length
        ? r.exercises.map((e) => ({
            name: e.name,
            sets: e.target_sets != null ? String(e.target_sets) : "",
            reps: e.target_reps != null ? String(e.target_reps) : "",
            weight: e.target_weight_kg != null ? String(e.target_weight_kg) : "",
            rest: e.rest_seconds != null ? String(e.rest_seconds) : "90",
          }))
        : [emptyRoutineEx()]
    );
    setRoutineOpen(true);
  }
  function updRoutineEx(i: number, patch: Partial<RoutineExDraft>) {
    setRExercises((p) => p.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));
  }
  async function saveRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (!rName.trim()) return;
    setRoutineSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRoutineSaving(false);
      return;
    }
    let routineId = editingRoutineId;
    if (routineId) {
      await supabase
        .from("routines")
        .update({ name: rName.trim(), notes: rNotes.trim() || null })
        .eq("id", routineId);
      await supabase.from("routine_exercises").delete().eq("routine_id", routineId);
    } else {
      const { data: r } = await supabase
        .from("routines")
        .insert({
          user_id: user.id,
          name: rName.trim(),
          notes: rNotes.trim() || null,
          position: routines.length,
        })
        .select()
        .single();
      routineId = (r as any)?.id ?? null;
    }
    if (routineId) {
      const rows = rExercises
        .filter((ex) => ex.name.trim())
        .map((ex, i) => ({
          routine_id: routineId as string,
          user_id: user.id,
          name: ex.name.trim(),
          target_sets: ex.sets ? Number(ex.sets) : null,
          target_reps: ex.reps ? Number(ex.reps) : null,
          target_weight_kg: ex.weight ? Number(ex.weight) : null,
          rest_seconds: ex.rest ? Number(ex.rest) : 90,
          position: i,
        }));
      if (rows.length) await supabase.from("routine_exercises").insert(rows);
    }
    setRoutineSaving(false);
    setRoutineOpen(false);
    await load();
  }
  async function removeRoutine(id: string) {
    if (!confirm("Excluir esta rotina?")) return;
    await supabase.from("routines").delete().eq("id", id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }
  // Ponte até o M1b (sessão ao vivo): registra um treino já preenchido pela rotina.
  function registerFromRoutine(r: RoutineWithEx) {
    setDate(todayISO());
    setName(r.name);
    setCategory("");
    setDuration("");
    setNotes("");
    setExercises(
      r.exercises.length
        ? r.exercises.map((e) => {
            const n = Math.max(1, e.target_sets ?? 1);
            const base = {
              reps: e.target_reps != null ? String(e.target_reps) : "",
              weight: e.target_weight_kg != null ? String(e.target_weight_kg) : "",
            };
            return {
              name: e.name,
              rpe: "",
              sets: Array.from({ length: n }, () => ({ ...base })),
            };
          })
        : [emptyExercise()]
    );
    setTab("historico");
    setOpen(true);
  }

  // Mapas derivados para a sessão ao vivo (última performance e 1RM base).
  const lastByName = useMemo(() => {
    const m: Record<string, { reps: number | null; weight: number | null }> = {};
    for (const [k, v] of Object.entries(perfByName)) {
      if (v.last) m[k] = { reps: v.last.reps, weight: v.last.weight };
    }
    return m;
  }, [perfByName]);
  const best1rmByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(perfByName)) m[k] = v.best1rm;
    return m;
  }, [perfByName]);

  async function finishSession(p: FinishPayload) {
    setSessionSaving(true);
    setSessionErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSessionSaving(false);
      setSessionErro(ERRO_DO_TREINO);
      return;
    }
    const sessaoDoPlano =
      sessionRoutine?.planId && sessionRoutine.planDate
        ? { planId: sessionRoutine.planId, data: sessionRoutine.planDate }
        : null;
    const r = await gravarTreinoAoVivo(supabase, user.id, p, sessaoDoPlano);
    setSessionSaving(false);
    // Com o treino não salvo, a sessão fica aberta: fechar perderia as séries.
    if (!r.ok) {
      setSessionErro(r.erro);
      return;
    }
    setSessionRoutine(null);
    setAvisoDoTreino(r.aviso);
    setTab("historico");
    await load();
  }

  function openPlanModal(day: number) {
    setPDay(day);
    setPSport("Musculação");
    setPTitle("");
    setPNotes("");
    setPRoutineId("");
    setPlanOpen(true);
  }

  async function savePlanEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!pSport.trim()) return;
    setPlanSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const position = plan.filter((p) => p.day_of_week === pDay).length;
    await supabase.from("workout_plan").insert({
      user_id: user.id,
      day_of_week: pDay,
      sport: pSport.trim(),
      title: pTitle.trim() || null,
      notes: pNotes.trim() || null,
      position,
      routine_id: pRoutineId || null,
    });
    setPlanSaving(false);
    setPlanOpen(false);
    await load();
  }

  // Inicia a sessão ao vivo a partir de uma sessão do plano (se tiver rotina).
  // `data` é o dia dela na semana: o "Feito" vai nele, e não em hoje.
  function startPlanSession(session: PlanEntry, data: string) {
    const r = routines.find((x) => x.id === session.routine_id);
    if (!r) return;
    setSessionErro(null);
    setSessionRoutine({
      id: r.id,
      name: r.name,
      exercises: r.exercises,
      planId: session.id,
      planDate: data,
    });
  }

  async function removePlanEntry(id: string) {
    await supabase.from("workout_plan").delete().eq("id", id);
    setPlan((prev) => prev.filter((p) => p.id !== id));
  }

  // Marca/desmarca um treino do plano como concluído hoje (e registra no histórico)
  // Check-in do plano: "fui" / "não fui" numa data específica da semana.
  // Tocar no estado já ativo desfaz e volta para "sem resposta".
  async function markPlan(
    session: PlanEntry,
    date: string,
    status: "done" | "skipped"
  ) {
    setBusyDone({ chave: session.id + date, status });
    setErroDoCheckIn(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusyDone(null);
      setErroDoCheckIn(session.id + date);
      return;
    }
    const current = compIndex[completionKey(session.id, date)] ?? null;
    const next = current?.status === status ? null : status;
    // O retorno era ignorado: o `load()` devolvia o botão ao que estava no
    // banco, e a resposta sumia sem mensagem.
    const { error } = await setPlanCheck(supabase, user.id, session, date, next, current);
    setBusyDone(null);
    if (error) setErroDoCheckIn(session.id + date);
    await load();
  }

  function resetForm() {
    setDate(todayISO());
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
      const rows = exercises
        .filter((ex) => ex.name.trim())
        .map((ex, i) => {
          const sets = ex.sets
            .map((s) => ({
              reps: s.reps ? Number(s.reps) : null,
              weight: s.weight ? Number(s.weight) : null,
            }))
            .filter((s) => s.reps != null || s.weight != null);
          const weights = sets
            .map((s) => s.weight)
            .filter((w): w is number => w != null);
          return {
            workout_id: (workout as Workout).id,
            user_id: user.id,
            name: ex.name.trim(),
            sets: sets.length || null,
            reps: sets[0]?.reps ?? null,
            weight_kg: weights.length ? Math.max(...weights) : null,
            sets_json: sets.length ? sets : null,
            rpe: ex.rpe ? Number(ex.rpe) : null,
            position: i,
          };
        });
      if (rows.length > 0) {
        await supabase.from("exercises").insert(rows);
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

  // ----- helpers de exercício no formulário -----
  function updateExerciseName(i: number, name: string) {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, name } : ex)));
  }
  function updateExerciseRpe(i: number, rpe: string) {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, rpe } : ex)));
  }
  function updateSet(ei: number, si: number, patch: Partial<SetDraft>) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === ei
          ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }
          : ex
      )
    );
  }
  function addSet(ei: number) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === ei ? { ...ex, sets: [...ex.sets, { reps: "", weight: "" }] } : ex
      )
    );
  }
  function removeSet(ei: number, si: number) {
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === ei ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex
      )
    );
  }

  const today = todayIndex();
  const semana = weekDates();
  const hojeISO = todayISO();
  const compIndex = indexCompletions(completions);

  // Adesão da semana: só conta o que já venceu (dias futuros ficam de fora).
  const adesao = semana.reduce(
    (acc, date, dow) => {
      if (date > hojeISO) return acc;
      for (const p of plan.filter((x) => x.day_of_week === dow)) {
        acc.previstas++;
        const c = compIndex[completionKey(p.id, date)];
        if (c?.status === "done") acc.confirmadas++;
        else if (c?.status === "skipped") acc.faltas++;
      }
      return acc;
    },
    { previstas: 0, confirmadas: 0, faltas: 0 }
  );

  // Resumo do plano da semana
  const sessionsPlanned = plan.filter(
    (p) => !p.sport.toLowerCase().includes("descanso")
  );
  const daysPlanned = new Set(sessionsPlanned.map((p) => p.day_of_week)).size;

  // ----- Progressão de carga -----
  const exerciseNames = Array.from(
    new Set(
      Object.values(exercisesByWorkout)
        .flat()
        .filter((e) => e.weight_kg != null)
        .map((e) => e.name)
    )
  ).sort();
  const currentExercise =
    selectedExercise && exerciseNames.includes(selectedExercise)
      ? selectedExercise
      : exerciseNames[0] ?? "";
  const progressData: { label: string; value: number }[] = [];
  if (currentExercise) {
    const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const w of sorted) {
      const exs = (exercisesByWorkout[w.id] ?? []).filter(
        (e) => e.name === currentExercise && e.weight_kg != null
      );
      if (exs.length) {
        const maxW = Math.max(...exs.map((e) => Number(e.weight_kg)));
        progressData.push({ label: formatDate(w.date).slice(0, 5), value: maxW });
      }
    }
  }
  const progStats =
    progressData.length > 0
      ? {
          current: progressData[progressData.length - 1].value,
          record: Math.max(...progressData.map((r) => r.value)),
          delta:
            Math.round(
              (progressData[progressData.length - 1].value - progressData[0].value) * 10
            ) / 10,
          count: progressData.length,
        }
      : null;
  const isRecord =
    !!progStats && progStats.count > 1 && progStats.current >= progStats.record;

  // ----- Volume semanal (séries × reps × carga) -----
  function workoutVolume(wId: string) {
    let v = 0;
    for (const ex of exercisesByWorkout[wId] ?? []) {
      for (const s of setsOf(ex)) {
        if (s.reps != null && s.weight != null) v += s.reps * s.weight;
      }
    }
    return v;
  }
  const volumeByWeek: Record<string, number> = {};
  for (const w of workouts) {
    const vol = workoutVolume(w.id);
    if (vol > 0) {
      const wk = weekStartISO(w.date);
      volumeByWeek[wk] = (volumeByWeek[wk] || 0) + vol;
    }
  }
  const volumeData = Object.keys(volumeByWeek)
    .sort()
    .slice(-10)
    .map((k) => ({ label: formatDate(k).slice(0, 5), value: Math.round(volumeByWeek[k]) }));

  return (
    <div>
      <PageHeader
        title="Treinos"
        subtitle="Monte seu plano da semana e registre seus treinos."
        action={
          tab === "historico" ? (
            <div className="flex gap-2">
              {workouts.length > 0 && (
                <button onClick={repeatLast} className="btn-ghost">
                  <Copy className="h-4 w-4" /> Repetir último
                </button>
              )}
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Novo treino
              </button>
            </div>
          ) : tab === "rotinas" ? (
            <button onClick={openNewRoutine} className="btn-primary">
              <Plus className="h-4 w-4" /> Nova rotina
            </button>
          ) : undefined
        }
      />

      {/* Abas */}
      <div className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-app-linha bg-app-cartao p-1">
        {[
          { id: "plano", label: "Semana", icon: CalendarDays },
          { id: "rotinas", label: "Rotinas", icon: ListChecks },
          { id: "historico", label: "Histórico", icon: History },
          { id: "progressao", label: "Progressão", icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as typeof tab);
              setAvisoDoTreino(null);
            }}
            className={`tappable flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${
              tab === t.id
                ? "bg-app-primaria text-app-sobre-primaria"
                : "text-app-texto-2 hover:bg-app-primaria-fundo"
            }`}
          >
            {/* Mesmo motivo das abas de "Meu plano": com ícone, as quatro
                não cabem em 390px e a última fica cortada pela borda. */}
            <t.icon className="hidden h-4 w-4 sm:block" /> {t.label}
          </button>
        ))}
      </div>

      {avisoDoTreino && (
        <p role="status" className="mb-4 text-[13px] text-app-atencao">
          {avisoDoTreino}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-app-texto-2">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "plano" ? (
        <div className="space-y-4">
          {/* Resumo da semana */}
          <div className="card grid grid-cols-3 divide-x divide-app-linha">
            <PlanStat value={`${daysPlanned}`} sub="/ 7" label="Dias com treino" />
            {/* "Sessões/semana" não quebra (não tem espaço) e, com o apoio em
                13 px, passava por cima do traço da coluna em 390 px. */}
            <PlanStat value={`${sessionsPlanned.length}`} label="Sessões por semana" />
            <PlanStat
              value={`${adesao.confirmadas}`}
              sub={`/ ${adesao.previstas}`}
              label="Confirmados na semana"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DAYS.map((dayName, day) => {
              const sessions = plan.filter((p) => p.day_of_week === day);
              const isToday = day === today;
              const dataDoDia = semana[day];
              const jaPassou = dataDoDia <= hojeISO;
              return (
                <div
                  key={day}
                  className={`card transition duration-200 ${
                    isToday ? "border-app-primaria ring-1 ring-app-primaria" : ""
                  }`}
                >
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="font-semibold text-app-texto">{dayName}</h3>
                  <span className="tabular text-[13px] text-app-texto-2">
                    {dataDoDia.slice(8, 10)}/{dataDoDia.slice(5, 7)}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-app-primaria-fundo px-2 py-0.5 text-[13px] font-semibold text-app-primaria">
                      hoje
                    </span>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <p className="mb-3 text-sm text-app-texto-2">
                    Nada planejado.
                  </p>
                ) : (
                  <ul className="mb-3 divide-y divide-app-linha">
                    {sessions.map((s) => {
                      const check = compIndex[completionKey(s.id, dataDoDia)];
                      const ocupado =
                        busyDone?.chave === s.id + dataDoDia ? busyDone.status : null;
                      const doNutri = !!s.prescribed_by && vinculoAtivo;
                      return (
                        <li
                          key={s.id}
                          className="py-3 first:pt-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${sportChip(
                                  s.sport
                                )}`}
                              >
                                {s.sport}
                              </span>
                              {s.prescribed_by && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-app-primaria-fundo px-2 py-0.5 text-[13px] font-semibold text-app-primaria">
                                  <Stethoscope className="h-3 w-3" />
                                  do nutri
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removePlanEntry(s.id)}
                              className="tappable -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                              aria-label="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {s.title && (
                            <p className="mt-1 text-sm font-medium text-app-texto">
                              {s.title}
                            </p>
                          )}
                          {s.notes && (
                            <p className="mt-0.5 text-[13px] text-app-texto-2">
                              {s.notes}
                            </p>
                          )}
                          {/* "Iniciar treino" é o primário da sessão e vem
                              primeiro, na largura toda: terminar o treino ao
                              vivo já marca "Feito". O check-in fica embaixo,
                              para quem treinou sem o cronômetro, e o "Fui"
                              sólido só aparece em dia que já chegou. */}
                          {s.routine_id &&
                            routines.some((r) => r.id === s.routine_id) && (
                              <button
                                onClick={() => startPlanSession(s, dataDoDia)}
                                className="btn-primary mt-2 w-full py-1.5 text-[13px]"
                              >
                                <Play className="h-3.5 w-3.5" /> Iniciar treino
                              </button>
                            )}
                          {jaPassou && (
                            <div className="mt-2 flex gap-1.5">
                              <BotoesDoCheckIn
                                status={statusDoCheckIn(check)}
                                doNutri={doNutri}
                                ocupado={ocupado}
                                esticar
                                onMarcar={(st) => markPlan(s, dataDoDia, st)}
                              />
                            </div>
                          )}
                          {erroDoCheckIn === s.id + dataDoDia && (
                            <p role="alert" className="mt-2 text-[13px] text-app-perigo">
                              {ERRO_DO_CHECKIN}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  onClick={() => openPlanModal(day)}
                  className="btn-ghost w-full py-1.5 text-sm"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
              );
            })}
          </div>
        </div>
      ) : tab === "rotinas" ? (
        routines.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-10 w-10" />}
            title="Nenhuma rotina ainda"
            description="Crie rotinas reutilizáveis (com exercícios e metas) para treinar sempre igual — ou peça para a Gaia montar."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {routines.map((r) => (
              <div key={r.id} className="card flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold text-app-texto">
                        {r.name}
                      </h3>
                      {(r as any).prescribed_by && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-app-primaria-fundo px-2 py-0.5 text-[13px] font-semibold text-app-primaria">
                          <Stethoscope className="h-3 w-3" />
                          do nutri
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-app-texto-2">
                      {r.exercises.length} exercício(s)
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEditRoutine(r)}
                      className="tappable flex min-h-[44px] items-center rounded-lg px-2 text-[13px] font-semibold text-app-texto-2 hover:bg-app-primaria-fundo hover:text-app-texto"
                      aria-label="Editar rotina"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => removeRoutine(r.id)}
                      className="tappable flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                      aria-label="Excluir rotina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {r.exercises.length > 0 && (
                  <ul className="mb-4 flex-1 space-y-1.5">
                    {r.exercises.slice(0, 6).map((e, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-sm text-app-texto"
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="tabular shrink-0 text-[13px] text-app-texto-2">
                          {e.target_sets ?? "—"}×{e.target_reps ?? "—"}
                          {e.target_weight_kg != null ? ` · ${e.target_weight_kg}kg` : ""}
                        </span>
                      </li>
                    ))}
                    {r.exercises.length > 6 && (
                      <li className="text-[13px] text-app-texto-2">
                        +{r.exercises.length - 6} exercício(s)
                      </li>
                    )}
                  </ul>
                )}

                <div className="mt-auto flex flex-col gap-1.5">
                  <button
                    onClick={() =>
                      setSessionRoutine({ id: r.id, name: r.name, exercises: r.exercises })
                    }
                    className="btn-primary w-full py-2"
                  >
                    <Play className="h-4 w-4" /> Iniciar treino
                  </button>
                  <button
                    onClick={() => registerFromRoutine(r)}
                    className="tappable min-h-[44px] text-[13px] font-medium text-app-texto-2 hover:text-app-primaria"
                  >
                    Registro rápido (sem cronômetro)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "progressao" ? (
        exerciseNames.length === 0 && volumeData.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-10 w-10" />}
            title="Sem dados de progressão ainda"
            description="Registre treinos com carga (peso) nos exercícios para acompanhar a evolução."
          />
        ) : (
          <div className="space-y-5">
            {/* alternador Carga / Volume */}
            <div className="inline-flex max-w-full rounded-xl border border-app-linha bg-app-cartao p-1">
              <button
                onClick={() => setProgView("carga")}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  progView === "carga"
                    ? "bg-app-primaria text-app-sobre-primaria"
                    : "text-app-texto-2 hover:bg-app-primaria-fundo"
                }`}
              >
                <TrendingUp className="h-4 w-4" /> Carga por exercício
              </button>
              <button
                onClick={() => setProgView("volume")}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  progView === "volume"
                    ? "bg-app-primaria text-app-sobre-primaria"
                    : "text-app-texto-2 hover:bg-app-primaria-fundo"
                }`}
              >
                <BarChart3 className="h-4 w-4" /> Volume semanal
              </button>
            </div>

            {progView === "carga" ? (
              exerciseNames.length === 0 ? (
                <p className="text-sm text-app-texto-2">
                  Registre exercícios com carga para ver a progressão por exercício.
                </p>
              ) : (
                <>
                  <div className="card">
                    <label className="label">Exercício</label>
                    <select
                      className="input"
                      value={currentExercise}
                      onChange={(e) => setSelectedExercise(e.target.value)}
                    >
                      {exerciseNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {progStats && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <StatCard
                        label="Carga atual"
                        value={progStats.current}
                        unit="kg"
                        icon={<Dumbbell className="h-5 w-5" />}
                      />
                      <StatCard
                        label="Recorde"
                        value={progStats.record}
                        unit="kg"
                        icon={<Trophy className="h-5 w-5" />}
                      />
                      <StatCard
                        label="Variação"
                        value={`${progStats.delta > 0 ? "+" : ""}${progStats.delta}`}
                        unit="kg"
                        icon={<TrendingUp className="h-5 w-5" />}
                      />
                      <StatCard
                        label="1RM estimado"
                        value={Math.round(perfByName[currentExercise.toLowerCase()]?.best1rm ?? 0)}
                        unit="kg"
                        icon={<Zap className="h-5 w-5" />}
                      />
                    </div>
                  )}

                  <div className="card">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="section-title">Evolução da carga</h3>
                      {isRecord && (
                        <span className="flex items-center gap-1 rounded-full bg-app-primaria-fundo px-2 py-0.5 text-[13px] font-semibold text-app-primaria">
                          <Trophy className="h-3 w-3" /> Recorde atual!
                        </span>
                      )}
                    </div>
                    {progressData.length > 1 ? (
                      <TrendChart data={progressData} unit=" kg" />
                    ) : (
                      <p className="py-8 text-center text-sm text-app-texto-2">
                        Registre este exercício em mais de um treino para ver a curva.
                      </p>
                    )}
                  </div>
                </>
              )
            ) : volumeData.length > 0 ? (
              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="section-title">Volume por semana</h3>
                  <span className="text-[13px] text-app-texto-2">carga total (kg)</span>
                </div>
                <BarsChart data={volumeData} unit=" kg" />
                <p className="mt-2 text-[13px] text-app-texto-2">
                  Volume = soma de (repetições × carga) de todos os exercícios na semana.
                </p>
              </div>
            ) : (
              <p className="text-sm text-app-texto-2">
                Registre treinos com repetições e carga para ver o volume semanal.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <RestTimer />
          {workouts.length === 0 ? (
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
              <div key={w.id} className="card overflow-hidden p-0">
                <div className="flex items-center gap-3 p-4">
                  <div className="icon-badge">
                    <Dumbbell className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => setExpanded(isOpen ? null : w.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-semibold text-app-texto">
                      {w.name}
                    </p>
                    <p className="text-[13px] text-app-texto-2">
                      {formatDate(w.date)}
                      {w.category ? ` · ${w.category}` : ""}
                      {w.duration_min ? ` · ${w.duration_min} min` : ""}
                      {exs.length ? ` · ${exs.length} exercício(s)` : ""}
                    </p>
                  </button>
                  {exs.length > 0 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : w.id)}
                      aria-label={isOpen ? "Recolher exercícios" : "Ver exercícios"}
                      className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:bg-app-primaria-fundo"
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
                    aria-label={`Excluir treino ${w.name}`}
                    className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:bg-app-perigo-fundo hover:text-app-perigo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && exs.length > 0 && (
                  <div className="space-y-3 border-t border-app-linha bg-app-pagina px-4 py-3">
                    {exs.map((ex) => (
                      <div key={ex.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-app-texto">
                            {ex.name}
                          </p>
                          {ex.rpe != null && (
                            <span className="tabular text-[13px] text-app-texto-2">RPE {ex.rpe}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {setsOf(ex).map((s, i) => (
                            <span
                              key={i}
                              className="tabular rounded-md bg-app-cartao px-2 py-0.5 text-[13px] text-app-texto-2 ring-1 ring-app-linha"
                            >
                              {s.reps ?? "—"}
                              {s.weight != null ? ` × ${s.weight}kg` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {w.notes && (
                      <p className="text-[13px] text-app-texto-2">
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
        </div>
      )}

      {/* Modal — adicionar ao plano */}
      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="Adicionar ao plano">
        <form onSubmit={savePlanEntry} className="space-y-4">
          <Field label="Dia da semana">
            <select
              className="input"
              value={pDay}
              onChange={(e) => setPDay(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Esporte / modalidade">
            <input
              className="input"
              list="sports-list"
              value={pSport}
              onChange={(e) => setPSport(e.target.value)}
              placeholder="Ex.: Musculação, Corrida..."
              required
            />
            <datalist id="sports-list">
              {SPORTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Treino / foco (opcional)">
            <input
              className="input"
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="Ex.: Treino A — Peito e tríceps / Corrida 5km"
            />
          </Field>
          {routines.length > 0 && (
            <Field label="Rotina (opcional) — permite 'Iniciar treino' neste dia">
              <select
                className="input"
                value={pRoutineId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPRoutineId(id);
                  const r = routines.find((x) => x.id === id);
                  if (r && !pTitle.trim()) setPTitle(r.name);
                }}
              >
                <option value="">Nenhuma</option>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Observações (opcional)">
            <textarea
              className="input min-h-[60px]"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              placeholder="Ex.: manhã, intensidade leve..."
            />
          </Field>
          <button type="submit" disabled={planSaving} className="btn-primary w-full py-2.5">
            {planSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </button>
        </form>
      </Modal>

      {/* Modal — registrar treino (histórico) */}
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
                max={todayISO()}
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

          <div className="flex justify-end">
            <PlateCalculator />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Exercícios</span>
              <button
                type="button"
                onClick={() => setExercises((p) => [...p, emptyExercise()])}
                className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-app-primaria hover:underline"
              >
                + Exercício
              </button>
            </div>
            <div className="space-y-3">
              {exercises.map((ex, ei) => (
                <div
                  key={ei}
                  className="rounded-xl border border-app-linha p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      value={ex.name}
                      onChange={(e) => updateExerciseName(ei, e.target.value)}
                      placeholder="Ex.: Supino reto"
                    />
                    {/* Os botões de remover têm 44 px de toque; o -mr-3 usa a folga de
                        12 px do quadro do exercício para os campos da linha não
                        encolherem (a 390 px "Carga kg" aparecia cortado). */}
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExercises((p) => p.filter((_, idx) => idx !== ei))
                        }
                        className="tappable -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                        aria-label="Remover exercício"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Sugestão de progressão (baseada no histórico) */}
                  {progressionHint(ex.name) && (
                    <p className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-app-primaria">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      {progressionHint(ex.name)}
                    </p>
                  )}

                  {/* Séries */}
                  <div className="mt-2 space-y-1.5">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[13px] font-medium text-app-texto-2">
                          Série {si + 1}
                        </span>
                        <input
                          className="input"
                          type="number"
                          value={s.reps}
                          onChange={(e) => updateSet(ei, si, { reps: e.target.value })}
                          placeholder="Reps"
                        />
                        <input
                          className="input"
                          type="number"
                          step="0.5"
                          value={s.weight}
                          onChange={(e) => updateSet(ei, si, { weight: e.target.value })}
                          placeholder="Carga kg"
                        />
                        {ex.sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSet(ei, si)}
                            className="tappable -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                            aria-label="Remover série"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => addSet(ei)}
                      className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-app-primaria hover:underline"
                    >
                      + Série
                    </button>
                    <input
                      className="input max-w-[130px]"
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={ex.rpe}
                      onChange={(e) => updateExerciseRpe(ei, e.target.value)}
                      placeholder="RPE 1-10"
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

      {/* Modal — criar/editar rotina */}
      <Modal
        open={routineOpen}
        onClose={() => setRoutineOpen(false)}
        title={editingRoutineId ? "Editar rotina" : "Nova rotina"}
      >
        <form onSubmit={saveRoutine} className="space-y-4">
          <Field label="Nome da rotina">
            <input
              className="input"
              value={rName}
              onChange={(e) => setRName(e.target.value)}
              placeholder="Ex.: Treino A — Peito e tríceps"
              required
            />
          </Field>
          <Field label="Observações (opcional)">
            <input
              className="input"
              value={rNotes}
              onChange={(e) => setRNotes(e.target.value)}
              placeholder="Ex.: foco em hipertrofia"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Exercícios e metas</span>
              <button
                type="button"
                onClick={() => setRExercises((p) => [...p, emptyRoutineEx()])}
                className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-app-primaria hover:underline"
              >
                + Exercício
              </button>
            </div>
            <div className="space-y-3">
              {rExercises.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-app-linha p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      value={ex.name}
                      onChange={(e) => updRoutineEx(i, { name: e.target.value })}
                      placeholder="Ex.: Supino reto"
                    />
                    {rExercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRExercises((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="tappable -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                        aria-label="Remover exercício"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <div>
                      <span className="mb-0.5 block text-[13px] font-medium text-app-texto-2">
                        Séries
                      </span>
                      <input
                        className="input"
                        type="number"
                        value={ex.sets}
                        onChange={(e) => updRoutineEx(i, { sets: e.target.value })}
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[13px] font-medium text-app-texto-2">
                        Reps
                      </span>
                      <input
                        className="input"
                        type="number"
                        value={ex.reps}
                        onChange={(e) => updRoutineEx(i, { reps: e.target.value })}
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[13px] font-medium text-app-texto-2">
                        Carga kg
                      </span>
                      <input
                        className="input"
                        type="number"
                        step="0.5"
                        value={ex.weight}
                        onChange={(e) => updRoutineEx(i, { weight: e.target.value })}
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[13px] font-medium text-app-texto-2">
                        Descanso s
                      </span>
                      <input
                        className="input"
                        type="number"
                        value={ex.rest}
                        onChange={(e) => updRoutineEx(i, { rest: e.target.value })}
                        placeholder="90"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={routineSaving}
            className="btn-primary w-full py-2.5"
          >
            {routineSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingRoutineId ? "Salvar alterações" : "Criar rotina"}
          </button>
        </form>
      </Modal>

      {/* Sessão de treino ao vivo (M1b) */}
      {sessionRoutine && (
        <WorkoutSession
          routine={sessionRoutine}
          lastByName={lastByName}
          best1rmByName={best1rmByName}
          saving={sessionSaving}
          erro={sessionErro}
          onClose={() => {
            setSessionRoutine(null);
            setSessionErro(null);
          }}
          onFinish={finishSession}
        />
      )}
    </div>
  );
}
