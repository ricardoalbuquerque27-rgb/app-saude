// Refeições do cardápio, na ordem do dia. Mora aqui, e não só no
// MealPlanEditor, porque aquele módulo é "use client": um componente de
// servidor que importasse a lista de lá receberia uma referência de cliente
// no lugar do array (a mesma armadilha de formatDate, em lib/date.ts). A
// leitura do cardápio no detalhe do paciente é de servidor e precisa da
// mesma ordem que o editor mostra.
export const MEAL_TYPES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];

/**
 * As refeições de um cardápio, sem repetir: as de `MEAL_TYPES` na ordem do
 * dia, depois as de fora da lista na ordem em que aparecem. É a ordem dos
 * horários no Perfil e das linhas da "Refeições da semana" da nutricionista.
 */
export function tiposDoCardapio(itens: { meal_type: string }[]): string[] {
  const tipos = new Set(itens.map((i) => i.meal_type));
  return [...MEAL_TYPES.filter((t) => tipos.has(t)), ...Array.from(tipos).filter((t) => !MEAL_TYPES.includes(t))];
}

// A sugestão para fechar a proteína do dia (spec "Sugestão para fechar a
// meta"). Mora aqui, e não na Início ou na Dieta, porque as duas telas usam a
// mesma conta e este módulo já guarda a ordem das refeições e pode ser lido no
// servidor.

/** Só as colunas de `meal_plan_items` que a sugestão lê. */
export type ItemDoPlano = {
  meal_type: string;
  position: number;
  description: string;
  protein_g: number | null;
};

export type SugestaoDeProteina = {
  faltam: number;
  refeicao: string;
  descricao: string;
  proteina: number;
};

/** Abaixo disto, lembrar da proteína é chatice ("faltam 4 g"). */
const FALTA_MINIMA_G = 10;

/**
 * Quanto falta de proteína e qual refeição do PLANO DO NUTRICIONISTA cobre
 * parte disso, ou `null` quando não há o que sugerir.
 *
 * - **Só com plano e vínculo.** Sem meta, sem itens ou com o vínculo revogado,
 *   `null`: o app não sugere comida por conta própria, quem prescreve é o
 *   nutricionista.
 * - **`faltam` arredondado antes de comparar com 10.** É o número que a frase
 *   mostra; comparar o valor cru deixaria aparecer "Faltam 10 g" para 9,6 e
 *   esconder para 9,4 sem que ninguém visse a diferença.
 * - **A refeição** é a primeira, na ordem de `MEAL_TYPES`, que tem item no
 *   plano e não foi registrada hoje. Um `meal_type` fora da lista (o
 *   nutricionista pode escrever "Pré-treino") vem depois das conhecidas, pela
 *   menor `position` dos seus itens e, no empate, pela ordem em que apareceu:
 *   sem isso, um tipo desconhecido ficaria sem lugar na fila e a sugestão
 *   mudaria de uma leitura para outra.
 * - **A opção** é a de mais proteína; no empate, a de menor `position`, que é
 *   a que o nutricionista pôs primeiro. Opção com `protein_g` nulo ou até 0
 *   não entra na disputa: nulo não tem número a mostrar, e 0 g (o
 *   nutricionista lança 0 para fruta) não "cobre parte" do que falta, de modo
 *   que "lanche da tarde, 0 g (1 maçã)" para fechar 40 g seria absurdo. Uma
 *   refeição em que nenhuma opção tem proteína acima de 0 passa a vez para a
 *   próxima.
 * - **Calorias ficam de fora**, por decisão: "faltam 600 kcal" empurra quem
 *   está emagrecendo a comer sem fome, e o excesso já aparece no anel.
 *
 * "Hoje" não é decidido aqui: quem chama passa as refeições de `todayISO()`.
 */
export function sugestaoDeProteina(e: {
  meta: number | null;
  consumido: number;
  itens: ItemDoPlano[];
  tiposRegistrados: string[];
  vinculoAtivo: boolean;
}): SugestaoDeProteina | null {
  if (!e.vinculoAtivo || e.meta == null || e.itens.length === 0) return null;
  const faltam = Math.round(e.meta - e.consumido);
  // `!(>=)` e não `<`: com meta ou consumido NaN, `faltam` é NaN e `NaN < 10`
  // é falso, o que deixaria passar a frase "Faltam NaN g".
  if (!(faltam >= FALTA_MINIMA_G)) return null;

  const registrados = new Set(e.tiposRegistrados);
  const porTipo = new Map<string, ItemDoPlano[]>();
  for (const item of e.itens) {
    const lista = porTipo.get(item.meal_type);
    if (lista) lista.push(item);
    else porTipo.set(item.meal_type, [item]);
  }

  const conhecidos = MEAL_TYPES.filter((t) => porTipo.has(t));
  // `sort` é estável: no empate de position vale a ordem de chegada do Map.
  const desconhecidos = Array.from(porTipo.keys())
    .filter((t) => !MEAL_TYPES.includes(t))
    .sort(
      (a, b) =>
        Math.min(...porTipo.get(a)!.map((i) => i.position)) -
        Math.min(...porTipo.get(b)!.map((i) => i.position))
    );

  for (const tipo of [...conhecidos, ...desconhecidos]) {
    if (registrados.has(tipo)) continue;
    let melhor: ItemDoPlano | null = null;
    for (const item of porTipo.get(tipo)!) {
      const g = item.protein_g;
      if (g == null || !Number.isFinite(g) || g <= 0) continue;
      if (
        melhor == null ||
        g > melhor.protein_g! ||
        (g === melhor.protein_g && item.position < melhor.position)
      ) {
        melhor = item;
      }
    }
    if (melhor) {
      return {
        faltam,
        refeicao: tipo,
        descricao: melhor.description,
        proteina: Math.round(melhor.protein_g!),
      };
    }
  }
  return null;
}

/**
 * A sugestão em duas partes: a frase até os gramas e a descrição da opção. A
 * tela corta a descrição em duas linhas (spec "Sugestão para fechar a meta"), e
 * para isso precisa dela em separado; o texto inteiro continua sendo o de
 * `textoDaSugestao`, que sai daqui, de modo que as duas não divergem.
 *
 * A refeição vem sem artigo e com a inicial minúscula ("lanche da tarde"),
 * para a frase não depender do gênero de cada nome ("o lanche", "a ceia").
 */
export function partesDaSugestao(s: SugestaoDeProteina): { frase: string; descricao: string } {
  const refeicao = s.refeicao.charAt(0).toLowerCase() + s.refeicao.slice(1);
  return {
    frase: `Faltam ${s.faltam} g de proteína para a meta de hoje. Próxima refeição do seu plano: ${refeicao}, ${s.proteina} g`,
    descricao: s.descricao,
  };
}

/**
 * A frase da sugestão inteira, num texto só: "…, 25 g (1 scoop de whey + 1
 * maçã)." É o que vale onde a descrição não precisa ser cortada.
 */
export function textoDaSugestao(s: SugestaoDeProteina): string {
  const { frase, descricao } = partesDaSugestao(s);
  return `${frase} (${descricao}).`;
}
