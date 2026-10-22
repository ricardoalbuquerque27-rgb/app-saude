// A gravação da sessão de treino ao vivo (o "Finalizar" de `WorkoutSession`,
// na semana de Treinos). Morava dentro da página, e lá tinha dois defeitos:
//
// - **O check-in ia na data de hoje, não na da sessão.** Quem iniciava no
//   sábado o treino de segunda gravava o "Feito" com o id da sessão de segunda
//   e a data de sábado; cada dia da semana procura a data dele, então nenhum o
//   mostrava, e a segunda seguia sem resposta.
// - **O erro não era conferido.** Com o insert do treino falhando, a sessão
//   fechava, a aba ia para o Histórico e o treino inteiro sumia calado.
//
// O treino em si fica com a data de hoje, que é quando ele foi feito; o
// check-in, com a data da sessão do plano que ele cumpre. É a mesma regra do
// "Fui" tocado depois, num dia que já passou: a resposta é sobre o dia
// planejado.

import { todayISO } from "@/lib/date";
import { gravarTreino } from "@/lib/treinos";

export type TreinoAoVivo = {
  name: string;
  durationMin: number | null;
  exercises: {
    name: string;
    sets: { reps: number | null; weight: number | null }[];
  }[];
};

/** A sessão do plano de onde o treino saiu, e o dia dela na semana. */
export type SessaoDoPlano = { planId: string; data: string };

export type ResultadoDoTreino = { ok: true; aviso: string | null } | { ok: false; erro: string };

export const ERRO_DO_TREINO = "Não deu para salvar o treino. Tente de novo.";
export const AVISO_DO_PLANO = "O treino foi salvo, mas não deu para marcar o dia no plano.";

export async function gravarTreinoAoVivo(
  supabase: any,
  uid: string,
  p: TreinoAoVivo,
  sessao: SessaoDoPlano | null,
  hoje: string = todayISO()
): Promise<ResultadoDoTreino> {
  const series = p.exercises
    .map((ex, i) => {
      const sets = ex.sets.filter((s) => s.reps != null || s.weight != null);
      if (!sets.length) return null;
      const pesos = sets.map((s) => s.weight).filter((w): w is number => w != null);
      return {
        user_id: uid,
        name: ex.name,
        sets: sets.length,
        reps: sets[0]?.reps ?? null,
        weight_kg: pesos.length ? Math.max(...pesos) : null,
        sets_json: sets,
        rpe: null,
        position: i,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  // Com as séries falhando, `gravarTreino` apaga o treino: o "Finalizar" pode
  // ser tocado de novo sem duplicar o treino no Histórico.
  const treino = await gravarTreino(
    supabase,
    {
      user_id: uid,
      date: hoje,
      name: p.name,
      category: null,
      duration_min: p.durationMin,
      notes: "Sessão ao vivo",
    },
    series
  );
  if (!treino.ok) return { ok: false, erro: ERRO_DO_TREINO };

  // Dia que ainda não chegou não tem check-in (a semana só oferece "Fui" em
  // dia que já chegou): o treino adiantado fica só no Histórico, como o de uma
  // rotina iniciada pela aba Rotinas, e o dia pergunta quando chegar.
  if (!sessao || sessao.data > hoje) return { ok: true, aviso: null };

  // Daqui em diante o treino já está salvo: uma falha no check-in não o desfaz
  // (perderia as séries) e só avisa, porque tentar de novo o duplicaria.
  const { data: atual, error: erroDaLeitura } = await supabase
    .from("plan_completions")
    .select("id, status, workout_id")
    .eq("user_id", uid)
    .eq("plan_id", sessao.planId)
    .eq("date", sessao.data)
    .maybeSingle();
  if (erroDaLeitura) return { ok: true, aviso: AVISO_DO_PLANO };
  // Um "Fui" já respondido fica: trocar o workout_id deixaria solto o treino
  // que ele gerou. Um "não fui" vira "feito", porque o treino aconteceu.
  if (atual?.status === "done") return { ok: true, aviso: null };

  const { error } = await supabase.from("plan_completions").upsert(
    {
      user_id: uid,
      plan_id: sessao.planId,
      date: sessao.data,
      status: "done",
      workout_id: treino.id,
    },
    { onConflict: "plan_id,date" }
  );
  if (error) return { ok: true, aviso: AVISO_DO_PLANO };
  return { ok: true, aviso: null };
}
