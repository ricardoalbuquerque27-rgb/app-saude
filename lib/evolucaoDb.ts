import type { Res } from "@/lib/consultasDb";
import type { LinhaDoCorpo } from "@/lib/evolucao";

// As duas leituras da Evolução da aba Corpo do nutricionista. Cada uma devolve
// `falhou` junto: lista vazia por erro de leitura não é "sem pesagem", e o
// gráfico de "Ainda não dá para ver tendência" diria isso a quem pesa todo dia
// (CLAUDE.md, "Leitura que falha não é 'não tem'").

/** O teto do PostgREST (1.000 linhas); ver `getEvolucaoDoCorpo`. */
export const LIMITE_DO_CORPO = 1000;

/**
 * O vínculo ativo do nutricionista logado com o paciente, o mais recente: dele
 * sai o começo do período do gráfico (`inicioDoPeriodo`). Quem filtra o
 * nutricionista é a RLS de `patient_links` (ele só enxerga os vínculos dele;
 * o paciente, os dele), então não há `nutritionist_id` aqui. Sem vínculo
 * ativo, `data` é nulo sem erro: a página nem chega a esta aba (o perfil do
 * paciente já volta nulo), e quem chama trata como falha.
 */
export async function getInicioDoAcompanhamento(
  supabase: any,
  pacienteId: string
): Promise<Res<{ accepted_at: string | null; created_at: string } | null>> {
  const { data, error } = await supabase
    .from("patient_links")
    .select("accepted_at, created_at")
    .eq("patient_id", pacienteId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: error ? null : (data ?? null), falhou: !!error };
}

/**
 * As medidas do corpo do paciente entre dois dias (inclusive), de casa e da
 * consulta, da mais antiga para a mais nova.
 *
 * Piso e teto de data (`.gte` e `.lte`): o teto é hoje, e medida lançada com
 * data futura entrava na média da semana. A leitura da tabela "Medidas
 * registradas" traz só as 60 mais recentes, e um ano de pesagem diária passa
 * disso; esta lê o período inteiro.
 *
 * O PostgREST corta em 1.000 linhas SEM erro, e um ano cortado se desenharia
 * como se fosse inteiro (a lacuna no começo, o peso inicial errado). Vir
 * exatamente 1.000 conta como falha: tanto faz se a conta bateu na unha.
 */
export async function getEvolucaoDoCorpo(
  supabase: any,
  pacienteId: string,
  desde: string,
  ate: string
): Promise<Res<LinhaDoCorpo[]>> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("date, weight_kg, waist_cm, body_fat_pct, measured_by, created_at")
    .eq("user_id", pacienteId)
    .gte("date", desde)
    .lte("date", ate)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(LIMITE_DO_CORPO);
  const linhas = (data ?? []) as LinhaDoCorpo[];
  return { data: linhas, falhou: !!error || linhas.length >= LIMITE_DO_CORPO };
}
