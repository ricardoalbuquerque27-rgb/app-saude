import { todayISO } from "@/lib/date";

// Importado também por componente de cliente (o botão "+250 ml" da Início):
// só entra aqui o que roda no navegador.

export type ResultadoDaAgua =
  | { ok: true; total: number }
  | { ok: false; erro: string };

/**
 * Soma `ml` (negativo desfaz) à água do dia e grava o total. É a única forma
 * de gravar água: o assistente (`registrar_agua`) e o botão da Início passam
 * por aqui.
 *
 * O `registrar_agua` antigo ignorava o erro da leitura: com ela falhando, o
 * total do dia virava 0 e o upsert gravava só o `ml` por cima do que o
 * paciente já tinha bebido, então um "+250" apagava 1,5 L. Agora a leitura que
 * falha devolve o erro e não grava nada.
 *
 * O upsert leva só `user_id`, `date` e `water_ml`. O do PostgREST atualiza
 * apenas as colunas enviadas, então sono, humor e o resto da linha do dia
 * sobrevivem. Já mandar a linha inteira, montada de uma leitura que pode estar
 * velha, é o que o `persist` de Hábitos faz e desfaz o que mudou fora da tela.
 *
 * O total nunca fica abaixo de 0 (o "Desfazer" quando o dia já tem menos do
 * que o copo desfeito, porque outro lugar mexeu nele).
 *
 * Duas chamadas ao mesmo tempo leem o mesmo total e a segunda apaga a
 * primeira: quem chama grava uma por vez. Entre abas ou aparelhos a corrida
 * continua possível, e fechá-la pediria uma função no banco.
 */
export async function adicionarAgua(
  supabase: any,
  uid: string,
  ml: number,
  hoje: string = todayISO()
): Promise<ResultadoDaAgua> {
  // NaN virava `null` no JSON do upsert e apagaria a água do dia calado.
  if (!Number.isFinite(ml)) {
    return { ok: false, erro: "Quantidade de água inválida." };
  }

  const { data: atual, error: erroDaLeitura } = await supabase
    .from("daily_logs")
    .select("water_ml")
    .eq("user_id", uid)
    .eq("date", hoje)
    .maybeSingle();
  if (erroDaLeitura) {
    return {
      ok: false,
      erro: `Leitura da água do dia: ${erroDaLeitura.message ?? "falhou"}`,
    };
  }

  // `water_ml` pode vir nulo (o dia existe só com sono ou humor) ou como
  // texto (o numeric do PostgREST).
  const total = Math.max(0, (Number(atual?.water_ml) || 0) + ml);
  const { error: erroDaGravacao } = await supabase
    .from("daily_logs")
    .upsert(
      { user_id: uid, date: hoje, water_ml: total },
      { onConflict: "user_id,date" }
    );
  if (erroDaGravacao) {
    return {
      ok: false,
      erro: `Gravação da água do dia: ${erroDaGravacao.message ?? "falhou"}`,
    };
  }
  return { ok: true, total };
}
