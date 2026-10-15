import type { Res } from "@/lib/consultasDb";

/**
 * Quantas linhas cada página pede: o teto que o PostgREST da Supabase devolve
 * por pedido (`max-rows`, 1.000 por padrão). A página supõe esse teto. Se o
 * projeto o baixar, a página chega cortada, sem erro, e parece "curta": a
 * conferência da contagem em `lerEmPaginas` pega isso, em vez de tomar o corte
 * pelo fim da leitura.
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
 *
 * A consulta recebe `contar` (verdadeiro só na 1ª página) e, quando é, faz
 * `.select(colunas, { count: "exact" })`: o total das linhas que passam nos
 * filtros. Na leitura inteira, a soma das páginas tem de bater com ele; se não
 * bate, é falha. É a defesa contra o `max-rows` do projeto abaixo de 1.000: o
 * PostgREST corta a página sem erro, ela vem com menos linhas que o pedido, e
 * a leitura tomaria o corte pelo fim. (Só na 1ª página, porque o `count` custa
 * uma contagem a cada pedido; e é nela que o PostgREST não responde 416: o
 * deslocamento 0 nunca passa do total.) A soma maior que o total é falha
 * também: a tabela mudou no meio da leitura e uma linha pode ter vindo duas
 * vezes ou nenhuma; "Tentar de novo" resolve. Resposta sem contagem (o
 * cliente não a trouxe) não tem o que conferir, e vale o que veio.
 */
export async function lerEmPaginas<T>(
  pagina: (
    de: number,
    ate: number,
    contar: boolean
  ) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
  teto: number
): Promise<Res<T[]>> {
  const linhas: T[] = [];
  let total: number | null = null;
  while (linhas.length < teto) {
    const de = linhas.length;
    const ate = Math.min(de + LINHAS_POR_PAGINA, teto) - 1;
    const { data, error, count } = await pagina(de, ate, de === 0);
    if (error) return { data: [], falhou: true };
    if (de === 0) total = typeof count === "number" && Number.isFinite(count) ? count : null;
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < ate - de + 1) {
      return total != null && linhas.length !== total ? { data: [], falhou: true } : { data: linhas, falhou: false };
    }
  }
  return { data: [], falhou: true };
}
