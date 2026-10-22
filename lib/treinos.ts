// As gravações de Treinos que tocam mais de uma tabela: o treino com as
// séries (o "Registrar treino" e o "Finalizar" da sessão ao vivo) e a rotina
// com os exercícios. Moravam na página e ignoravam o erro: o "Registrar
// treino" fechava o formulário e limpava o que foi digitado com o insert
// falhando, e editar uma rotina apagava os exercícios antes de gravar os
// novos, de modo que um insert que falhasse deixava a rotina vazia.
//
// A regra das duas é a mesma: ou grava tudo, ou desfaz o que gravou e devolve
// `ok: false`, para quem chama manter o formulário aberto e tentar de novo sem
// duplicar.

type Linha = Record<string, unknown>;

/**
 * Grava o treino e as séries dele. Com as séries falhando, apaga o treino
 * (as séries de um treino caem em cascata com ele).
 */
export async function gravarTreino(
  supabase: any,
  treino: Linha,
  series: Linha[]
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data: w, error } = await supabase.from("workouts").insert(treino).select().single();
  if (error || !w) return { ok: false };
  if (series.length) {
    const { error: erroDasSeries } = await supabase
      .from("exercises")
      .insert(series.map((s) => ({ ...s, workout_id: w.id })));
    if (erroDasSeries) {
      await supabase.from("workouts").delete().eq("id", w.id);
      return { ok: false };
    }
  }
  return { ok: true, id: w.id };
}

export type DadosDaRotina = { id: string | null; nome: string; notas: string | null; posicao: number };

/**
 * Cria a rotina (sem `id`) ou edita a que existe. Na edição, os exercícios
 * novos entram antes de os antigos saírem, e o nome muda por último: até o
 * fim, a rotina gravada é a de antes, inteira.
 */
export async function salvarRotina(
  supabase: any,
  uid: string,
  rotina: DadosDaRotina,
  exercicios: Linha[]
): Promise<{ ok: true; id: string } | { ok: false }> {
  const comDono = (id: string) => exercicios.map((e) => ({ ...e, routine_id: id, user_id: uid }));

  if (!rotina.id) {
    const { data: r, error } = await supabase
      .from("routines")
      .insert({ user_id: uid, name: rotina.nome, notes: rotina.notas, position: rotina.posicao })
      .select()
      .single();
    if (error || !r) return { ok: false };
    if (exercicios.length) {
      const { error: erroDosExercicios } = await supabase.from("routine_exercises").insert(comDono(r.id));
      if (erroDosExercicios) {
        // Rotina vazia no lugar da que a pessoa montou; o novo "Criar rotina"
        // faria outra ao lado.
        await supabase.from("routines").delete().eq("id", r.id);
        return { ok: false };
      }
    }
    return { ok: true, id: r.id };
  }

  const id = rotina.id;
  const { data: antigos, error: erroDaLeitura } = await supabase
    .from("routine_exercises")
    .select("id")
    .eq("routine_id", id);
  if (erroDaLeitura) return { ok: false };
  const idsAntigos = (antigos ?? []).map((e: { id: string }) => e.id);

  let idsNovos: string[] = [];
  if (exercicios.length) {
    const { data: novos, error } = await supabase.from("routine_exercises").insert(comDono(id)).select("id");
    if (error) return { ok: false };
    idsNovos = (novos ?? []).map((e: { id: string }) => e.id);
  }
  if (idsAntigos.length) {
    const { error } = await supabase.from("routine_exercises").delete().in("id", idsAntigos);
    if (error) {
      // Antigos e novos juntos seriam a rotina em dobro: sai o que entrou.
      if (idsNovos.length) await supabase.from("routine_exercises").delete().in("id", idsNovos);
      return { ok: false };
    }
  }
  const { error: erroDoNome } = await supabase
    .from("routines")
    .update({ name: rotina.nome, notes: rotina.notas })
    .eq("id", id);
  if (erroDoNome) return { ok: false };
  return { ok: true, id };
}
