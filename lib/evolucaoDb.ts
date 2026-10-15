import type { Res } from "@/lib/consultasDb";
import type { LinhaDoCorpo } from "@/lib/evolucao";
import { lerEmPaginas } from "@/lib/paginacao";

// As duas leituras da Evolução da aba Corpo do nutricionista. Cada uma devolve
// `falhou` junto: lista vazia por erro de leitura não é "sem pesagem", e o
// gráfico de "Ainda não dá para ver tendência" diria isso a quem pesa todo dia
// (CLAUDE.md, "Leitura que falha não é 'não tem'").

/**
 * Quantas medidas a leitura do período aceita antes de desistir
 * (`lerEmPaginas`): quase 14 por dia num ano. Passar disso conta como falha.
 */
export const TETO_DO_CORPO = 5000;

/**
 * O vínculo ativo do nutricionista logado com o paciente, o mais recente: dele
 * sai o começo do período do gráfico (`inicioDoPeriodo`). A RLS de
 * `patient_links` já só mostra ao nutricionista os vínculos dele, mas o filtro
 * por `nutritionist_id` fica aqui também: sem ele, uma política mais larga (ou
 * a leitura feita com outra chave) daria o começo do acompanhamento de outro
 * nutricionista, calado. O id vem de quem chama (o usuário logado). Sem vínculo
 * ativo, `data` é nulo sem erro: a página nem chega a esta aba (o perfil do
 * paciente já volta nulo), e quem chama trata como falha.
 */
export async function getInicioDoAcompanhamento(
  supabase: any,
  pacienteId: string,
  nutriId: string
): Promise<Res<{ accepted_at: string | null; created_at: string } | null>> {
  const { data, error } = await supabase
    .from("patient_links")
    .select("accepted_at, created_at")
    .eq("patient_id", pacienteId)
    .eq("nutritionist_id", nutriId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: error ? null : (data ?? null), falhou: !!error };
}

/**
 * As medidas do corpo do paciente entre dois dias (inclusive), de casa e da
 * consulta, da mais antiga para a mais nova (no mesmo dia, pela gravação; o
 * `id` desempata as páginas).
 *
 * Piso e teto de data (`.gte` e `.lte`): o teto é hoje, e medida lançada com
 * data futura entrava na média da semana. A leitura da tabela "Medidas
 * registradas" traz só as 60 mais recentes, e um ano de pesagem diária passa
 * disso; esta lê o período inteiro.
 *
 * Em páginas (`lerEmPaginas`): o PostgREST corta em 1.000 linhas SEM erro, e
 * um ano cortado se desenharia como se fosse inteiro (a lacuna no começo, o
 * peso inicial errado). Antes era `.limit(1000)` com "vir 1.000 é falha", e
 * quem pesa três vezes por dia perdia a aba Corpo inteira. A 1ª página pede a
 * contagem (`count: "exact"`): a soma das páginas tem de bater com ela, senão
 * o `max-rows` do projeto cortou a página e a leitura é falha.
 */
export async function getEvolucaoDoCorpo(
  supabase: any,
  pacienteId: string,
  desde: string,
  ate: string
): Promise<Res<LinhaDoCorpo[]>> {
  return lerEmPaginas<LinhaDoCorpo>(
    (de, fim, contar) =>
      supabase
        .from("body_measurements")
        .select(
          "date, weight_kg, waist_cm, body_fat_pct, measured_by, created_at",
          contar ? { count: "exact" } : undefined
        )
        .eq("user_id", pacienteId)
        .gte("date", desde)
        .lte("date", ate)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(de, fim),
    TETO_DO_CORPO
  );
}
