import type { Res } from "@/lib/consultasDb";

/**
 * Quantas linhas cada página pede: o teto que o PostgREST da Supabase devolve
 * por pedido (`max-rows`, 1.000). Se o projeto baixar esse teto, uma página
 * cheia viria "curta" e a leitura pararia antes do fim: a página não pode
 * passar dele.
 */
export const LINHAS_POR_PAGINA = 1000;

/**
 * Lê uma consulta inteira em páginas de 1.000 (`.range(de, ate)`), até vir
 * uma página com menos linhas que o pedido.
 *
 * O PostgREST corta no limite SEM erro. As leituras do Corpo e dos exames
 * tinham `.limit` e contavam "vir cheio" como falha (um histórico cortado
 * desenhado como inteiro é o "Nunca registrou nada" de antes), mas os exames
 * só crescem: com 200 linhas (oito laudos) a aba Clínico morria de vez, o
 * tratamento junto, e nenhum "Tentar de novo" resolvia.
 *
 * `teto` é a trava contra ler sem fim: chegar a ele com a última página cheia
 * conta como falha, porque pode haver mais e o que veio seria um pedaço. Erro
 * em qualquer página também; nos dois casos `data` volta vazio, para ninguém
 * desenhar meia leitura. Quem chama ordena por colunas que desempatam
 * (terminando no `id`): com empate, o PostgREST não garante a mesma ordem em
 * dois pedidos, e uma linha poderia vir em duas páginas e outra em nenhuma.
 */
export async function lerEmPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  teto: number
): Promise<Res<T[]>> {
  const linhas: T[] = [];
  while (linhas.length < teto) {
    const de = linhas.length;
    const ate = Math.min(de + LINHAS_POR_PAGINA, teto) - 1;
    const { data, error } = await pagina(de, ate);
    if (error) return { data: [], falhou: true };
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < ate - de + 1) return { data: linhas, falhou: false };
  }
  return { data: [], falhou: true };
}
