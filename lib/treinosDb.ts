// As leituras da página Treinos do paciente, juntas, com o que falhou por
// área. Moravam na página com `data ?? []`, e a leitura que falhava virava
// "não tem": o plano que não carregava dizia "Nada planejado." na semana toda,
// as respostas que não carregavam punham o "Fui" sólido em dia já respondido, e
// o Histórico dizia "Nenhum treino ainda". O histórico, além disso, lia sem
// páginas: o PostgREST corta em 1.000 linhas sem erro, e as séries eram pedidas
// com a lista de todos os treinos no endereço (`.in("workout_id", …)`).

import { lerEmPaginas } from "@/lib/paginacao";
import type { Completion } from "@/lib/planCheckIn";
import type { Exercise, Workout } from "@/lib/types";

export type SessaoDoPlano = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  notes: string | null;
  position: number;
  routine_id: string | null;
  prescribed_by: string | null;
};

export type RotinaComExercicios = {
  id: string;
  name: string;
  notes: string | null;
  prescribed_by: string | null;
  exercises: {
    name: string;
    target_sets: number | null;
    target_reps: number | null;
    target_weight_kg: number | null;
    rest_seconds: number | null;
  }[];
};

export type LeituraDeTreinos = {
  plano: SessaoDoPlano[];
  respostas: Completion[];
  rotinas: RotinaComExercicios[];
  treinos: Workout[];
  seriesPorTreino: Record<string, Exercise[]>;
  vinculoAtivo: boolean;
  /** O que não carregou. A área que falhou volta vazia, para ninguém desenhar meia leitura. */
  falhou: { plano: boolean; respostas: boolean; rotinas: boolean; historico: boolean };
};

/**
 * Até onde o histórico lê antes de desistir (`lerEmPaginas`): treino duas
 * vezes por dia por quase sete anos, com seis exercícios cada. Passar disso
 * conta como falha do Histórico (ver "Em aberto" no CLAUDE.md: a página lê o
 * histórico inteiro a cada vez).
 */
export const TETO_DE_TREINOS = 5000;
export const TETO_DE_SERIES = 30000;

export async function lerTreinos(supabase: any, semana: string[]): Promise<LeituraDeTreinos> {
  const [planoR, respostasR, rotinasR, exerciciosDasRotinasR, vinculoR, treinosR, seriesR] = await Promise.all([
    supabase
      .from("workout_plan")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("plan_completions")
      .select("id, plan_id, date, status, workout_id")
      .gte("date", semana[0])
      .lte("date", semana[6]),
    supabase
      .from("routines")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("routine_exercises")
      .select("*")
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
    // A RLS só mostra ao paciente os vínculos dele, como na Início.
    supabase.from("patient_links").select("nutritionist_id").eq("status", "active").limit(1).maybeSingle(),
    // Do mais novo ao mais velho, como o Histórico mostra; o `id` desempata as
    // páginas (ver `lerEmPaginas`).
    lerEmPaginas<Workout>(
      (de, ate, contar) =>
        supabase
          .from("workouts")
          .select("*", contar ? { count: "exact" } : undefined)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate),
      TETO_DE_TREINOS
    ),
    // Todas as séries do paciente (a RLS só mostra as dele), em vez da lista
    // de treinos no endereço, que crescia com o histórico.
    lerEmPaginas<Exercise>(
      (de, ate, contar) =>
        supabase
          .from("exercises")
          .select("*", contar ? { count: "exact" } : undefined)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate),
      TETO_DE_SERIES
    ),
  ]);

  const falhouRotinas = !!rotinasR.error || !!exerciciosDasRotinasR.error;
  const exerciciosPorRotina: Record<string, any[]> = {};
  if (!falhouRotinas) {
    for (const e of exerciciosDasRotinasR.data ?? []) (exerciciosPorRotina[e.routine_id] ||= []).push(e);
  }
  const rotinas: RotinaComExercicios[] = falhouRotinas
    ? []
    : (rotinasR.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        notes: r.notes,
        prescribed_by: r.prescribed_by ?? null,
        exercises: (exerciciosPorRotina[r.id] ?? []).map((e: any) => ({
          name: e.name,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight_kg: e.target_weight_kg,
          rest_seconds: e.rest_seconds,
        })),
      }));

  const falhouHistorico = treinosR.falhou || seriesR.falhou;
  const seriesPorTreino: Record<string, Exercise[]> = {};
  if (!falhouHistorico) {
    for (const e of seriesR.data) (seriesPorTreino[e.workout_id] ||= []).push(e);
  }

  return {
    plano: planoR.error ? [] : ((planoR.data ?? []) as SessaoDoPlano[]),
    respostas: respostasR.error ? [] : ((respostasR.data ?? []) as Completion[]),
    rotinas,
    treinos: falhouHistorico ? [] : treinosR.data,
    seriesPorTreino,
    // Com a leitura do vínculo falhando, vale o que a sessão diz
    // (`prescribed_by`): o check-in grava a mesma linha nos dois casos, e tirar
    // o "Não fui" de quem tem nutricionista por uma falha de leitura seria pior.
    vinculoAtivo: !!vinculoR.data || !!vinculoR.error,
    falhou: {
      plano: !!planoR.error,
      respostas: !!respostasR.error,
      rotinas: falhouRotinas,
      historico: falhouHistorico,
    },
  };
}
