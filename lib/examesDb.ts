import type { Res } from "@/lib/consultasDb";
import type { LinhaDeExame } from "@/lib/exames";
import { lerEmPaginas } from "@/lib/paginacao";

/** Um resultado de exame como a aba Clínico lê: o do comparativo e a observação da lista. */
export type ExameDoPaciente = LinhaDeExame & { notes: string | null };

/**
 * Quantos resultados a leitura aceita antes de desistir (`lerEmPaginas`): 200
 * laudos de 25 exames. Passar disso conta como falha, só do bloco Exames.
 */
export const TETO_DE_EXAMES = 5000;

/**
 * Todos os exames do paciente, do mais velho ao mais novo e, no mesmo dia,
 * pela ordem de gravação: `compararExames` fica com o ÚLTIMO da entrada quando
 * dois resultados do mesmo exame caem no mesmo dia. O `id` no fim desempata
 * as páginas.
 *
 * Sem janela de data: o comparativo precisa do resultado anterior de cada
 * exame, que pode ser de anos atrás. Por isso lê em páginas, até o fim, em vez
 * de contar "vir cheio" como falha: numa leitura que só cresce, isso era uma
 * quebra que nunca se desfazia.
 */
export async function getExamesDoPaciente(
  supabase: any,
  pacienteId: string
): Promise<Res<ExameDoPaciente[]>> {
  return lerEmPaginas<ExameDoPaciente>(
    (de, ate) =>
      supabase
        .from("exams")
        .select("date, title, result_value, unit, reference_range, status, notes")
        .eq("user_id", pacienteId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(de, ate),
    TETO_DE_EXAMES
  );
}
