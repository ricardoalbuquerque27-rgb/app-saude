import {
  chaveDoExame,
  faixaDaTabela,
  parseExamNumber,
  parseReferenceRange,
  type ExamContext,
} from "@/lib/examRanges";

/**
 * O comparativo dos exames da aba Clínico do nutricionista: cada exame vira
 * uma linha, com o último resultado contra o anterior, dito em palavras
 * ("saiu da faixa", "mais perto da faixa"). Tudo puro e sem banco, para ter
 * teste; só `descricaoDaSerie` formata número (em pt-BR).
 */

/** Uma linha de `exams`, como a leitura da aba a traz. */
export type LinhaDeExame = {
  date: string;
  title: string;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
  status: string | null;
};

export type Mudanca =
  | "segue na faixa"
  | "entrou na faixa"
  | "saiu da faixa"
  | "mais perto da faixa"
  | "mais longe da faixa"
  | "igual ao anterior"
  | "sem faixa para comparar"
  | "primeiro resultado"
  | "unidade diferente do anterior";

export type FaixaNumerica = { min?: number; max?: number };

export type LinhaDoComparativo = {
  /** Junta as grafias do mesmo exame (`chaveDoExame`). */
  chave: string;
  /** O nome como o último resultado foi gravado. */
  nome: string;
  /** O texto da faixa usada (a do laudo do último; sem ela, a da tabela); nulo se nenhuma. */
  faixaTexto: string | null;
  /**
   * A mesma faixa, em número: a régua da comparação e a faixa sombreada do
   * minigráfico. Quem desenha usa esta e não relê o `faixaTexto`.
   */
  faixa: FaixaNumerica | null;
  /** `texto` é o resultado como a lista mostra: o valor gravado e a unidade ("92 mg/dL"). */
  ultimo: { valor: number; texto: string; data: string; status: string | null };
  anterior: { valor: number; data: string } | null;
  /** Último menos anterior; nulo sem anterior ou com unidade diferente. */
  diferenca: number | null;
  mudanca: Mudanca;
  /** 1 piorou, 2 segue fora ou sem comparação, 3 dentro da faixa, 4 um resultado só. */
  grupo: 1 | 2 | 3 | 4;
  /** Só com 3 resultados numéricos ou mais na unidade do último, em ordem de data. */
  serie: { data: string; valor: number }[] | null;
};

/** O minigráfico só diz alguma coisa com três pontos ou mais. */
const MINIMO_DA_SERIE = 3;

// ---------------------------------------------------------------------------
// Pequenas contas
// ---------------------------------------------------------------------------

/**
 * Tira o ruído do ponto flutuante: 5,6 - 5,3 dá 0.2999999999999998 e 0,4 - 0,3
 * dá 0.10000000000000003, e sem isto "igual ao anterior" dependia da última
 * casa binária. O `+ 0` troca o -0 por 0 (`toEqual` distingue os dois).
 */
function limpa(n: number): number {
  return Number(n.toPrecision(12)) + 0;
}

/** "92,5": vírgula decimal, sem zero sobrando. */
function br(n: number): string {
  return String(n).replace(".", ",");
}

/** "2026-10-02" -> "02/10". A coluna `date` já é dia de São Paulo, sem hora. */
function diaMes(data: string): string {
  const [, m, d] = data.split("-");
  return m && d ? `${d}/${m}` : data;
}

/**
 * A unidade para comparar: sem espaço e sem caixa ("mg/dL" e " MG / DL " são
 * a mesma). O NFKC junta o sinal de micro (U+00B5) e a letra grega mi
 * (U+03BC), que o laudo copiado de PDF traz um ou outro, e "mcg" e "ug" são
 * como se digita o micrograma sem o símbolo: "mcg/dL", "ug/dL", "µg/dL" e
 * "μg/dL" são a mesma unidade, e o ferro de 70 µg/dL para 80 mcg/dL não pode
 * virar "unidade diferente".
 */
function unidadeNormalizada(unidade: string | null): string {
  return (unidade ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/mcg|ug/g, "\u03bcg");
}

/**
 * Unidade que falta de um lado conta como a mesma: o laudo muitas vezes
 * omite, e tratar "sem unidade" como "unidade diferente" tiraria da
 * comparação quase todo exame digitado à mão.
 */
function mesmaUnidade(a: string, b: string): boolean {
  return a === "" || b === "" || a === b;
}

/**
 * A faixa numérica de um texto ("70 a 99", "< 200", "30–100 ng/mL", "0,9 a
 * 1,7"). Serve ao laudo e ao texto da faixa da tabela do app, que tem
 * decimais com vírgula (t4 livre, creatinina, potássio).
 */
function faixaDoTexto(texto: string | null | undefined): FaixaNumerica | null {
  if (!texto) return null;
  const faixa = parseReferenceRange(texto);
  if (!faixa || (faixa.min == null && faixa.max == null)) return null;
  return faixa;
}

/** Zero dentro da faixa (as bordas são dentro); fora, a distância até a borda mais próxima. */
function distanciaAFaixa(valor: number, faixa: FaixaNumerica): number {
  if (faixa.min != null && valor < faixa.min) return limpa(faixa.min - valor);
  if (faixa.max != null && valor > faixa.max) return limpa(valor - faixa.max);
  return 0;
}

// ---------------------------------------------------------------------------
// O comparativo
// ---------------------------------------------------------------------------

/** Um resultado com número, já limpo para a conta. */
type Resultado = {
  data: string;
  titulo: string;
  valor: number;
  texto: string;
  unidade: string;
  referencia: string | null;
  status: string | null;
  /** Posição na entrada: desempata dois resultados do mesmo dia. */
  ordem: number;
};

/**
 * A faixa do último resultado: a do laudo; sem ela (ou ilegível), a da tabela
 * do app para o sexo do paciente, e só quando o nome é igual ao de uma entrada
 * dela (`faixaDaTabela`: "VLDL-colesterol" não leva a do colesterol total) e a
 * unidade do resultado é a da entrada ou está em branco. Glicose de 5,1
 * mmol/L contra 70-99 mg/dL seria "abaixo da faixa" para um valor normal; sem
 * faixa, a linha diz "sem faixa para comparar". A prioridade é a da spec, a do
 * laudo antes da tabela.
 */
function faixaDoUltimo(
  ultimo: Resultado,
  ctx: ExamContext
): { faixa: FaixaNumerica | null; texto: string | null } {
  const doLaudo = faixaDoTexto(ultimo.referencia);
  if (doLaudo) return { faixa: doLaudo, texto: (ultimo.referencia ?? "").trim() };

  const daTabela = faixaDaTabela(ultimo.titulo, ultimo.valor, ctx);
  if (
    daTabela &&
    (ultimo.unidade === "" || ultimo.unidade === unidadeNormalizada(daTabela.unidade))
  ) {
    const faixa = faixaDoTexto(daTabela.faixa);
    if (faixa) return { faixa, texto: daTabela.faixa };
  }
  return { faixa: null, texto: null };
}

/**
 * O que mudou do anterior para o último, pela distância de cada valor até a
 * mesma faixa (a do último: a régua não muda no meio da comparação).
 */
function compararComOAnterior(
  ultimo: Resultado,
  anterior: Resultado | null,
  faixa: FaixaNumerica | null
): { mudanca: Mudanca; diferenca: number | null; grupo: 1 | 2 | 3 | 4 } {
  if (!anterior) return { mudanca: "primeiro resultado", diferenca: null, grupo: 4 };

  // Unidade diferente não se compara: 5,1 mmol/L contra 92 mg/dL daria uma
  // "melhora" falsa. Sem saber se piorou, o grupo vai pelo último: fora da
  // faixa ou sem faixa pede atenção (2), dentro não (3).
  if (!mesmaUnidade(ultimo.unidade, anterior.unidade)) {
    const dentro = faixa != null && distanciaAFaixa(ultimo.valor, faixa) === 0;
    return { mudanca: "unidade diferente do anterior", diferenca: null, grupo: dentro ? 3 : 2 };
  }

  const diferenca = limpa(ultimo.valor - anterior.valor);
  // Sem faixa não se sabe se melhorou: fica com a diferença, junto dos que
  // seguem fora (2) e não entre os que pioraram.
  if (!faixa) return { mudanca: "sem faixa para comparar", diferenca, grupo: 2 };

  const antes = distanciaAFaixa(anterior.valor, faixa);
  const agora = distanciaAFaixa(ultimo.valor, faixa);
  if (antes === 0) {
    return agora === 0
      ? { mudanca: "segue na faixa", diferenca, grupo: 3 }
      : { mudanca: "saiu da faixa", diferenca, grupo: 1 };
  }
  if (agora === 0) return { mudanca: "entrou na faixa", diferenca, grupo: 3 };
  if (agora < antes) return { mudanca: "mais perto da faixa", diferenca, grupo: 2 };
  if (agora > antes) return { mudanca: "mais longe da faixa", diferenca, grupo: 1 };
  // Mesma distância, mesmo de lados opostos (60 e 109 numa faixa de 70 a 99):
  // a régua é a distância, e a diferença na linha mostra o salto.
  return { mudanca: "igual ao anterior", diferenca, grupo: 2 };
}

/**
 * Uma linha por exame, na ordem de mostrar: primeiro o que piorou, depois o
 * que segue fora, depois o resto, depois os de um resultado só; dentro do
 * grupo, o último resultado mais recente primeiro (e o nome, quando é o mesmo
 * dia: um laudo traz vinte exames na mesma data).
 *
 * Resultado sem número ("reagente") fica fora, e o exame que só tem desses
 * não aparece. Dois resultados do mesmo exame no mesmo dia contam como um, o
 * último da entrada; o "anterior" é sempre de uma data anterior.
 *
 * A entrada deve vir em ordem crescente de data e, no mesmo dia, de
 * `created_at`: "o último da entrada" decide o resultado do dia, e a linha
 * não traz `created_at` para desempatar aqui dentro.
 */
export function compararExames(linhas: LinhaDeExame[], ctx: ExamContext): LinhaDoComparativo[] {
  // Primeiro o número: um "ver laudo" lançado depois não apaga o 44 do mesmo dia.
  const porChave = new Map<string, Resultado[]>();
  linhas.forEach((l, ordem) => {
    const valor = parseExamNumber(l.result_value);
    if (valor == null) return;
    // Nome que não tem letra nem número ("???") não diz de que exame é.
    const titulo = (l.title ?? "").trim();
    const chave = chaveDoExame(titulo);
    if (!chave) return;
    const lista = porChave.get(chave) ?? [];
    lista.push({
      data: l.date,
      titulo,
      valor,
      texto: [l.result_value?.trim(), l.unit?.trim()].filter(Boolean).join(" "),
      unidade: unidadeNormalizada(l.unit),
      referencia: l.reference_range,
      status: l.status,
      ordem,
    });
    porChave.set(chave, lista);
  });

  const comparativo: LinhaDoComparativo[] = [];
  porChave.forEach((lista, chave) => {
    // Por data, e na mesma data pela ordem da entrada: a data é "AAAA-MM-DD",
    // então comparar o texto é comparar o dia.
    lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ordem - b.ordem));
    const dias: Resultado[] = [];
    for (const r of lista) {
      if (dias.length && dias[dias.length - 1].data === r.data) dias[dias.length - 1] = r;
      else dias.push(r);
    }

    const ultimo = dias[dias.length - 1];
    const anterior = dias.length > 1 ? dias[dias.length - 2] : null;
    const { faixa, texto: faixaTexto } = faixaDoUltimo(ultimo, ctx);
    const { mudanca, diferenca, grupo } = compararComOAnterior(ultimo, anterior, faixa);

    // Unidade estritamente igual (sem unidade só junta com sem unidade): a
    // série mistura todos os pontos num desenho só, e 45 nmol/L ao lado de 24
    // mcg/dL não é uma linha. Na comparação com o anterior a falta de unidade
    // vale como "a mesma" (`mesmaUnidade`), para não apagar a de quem não digitou.
    const daUnidadeDoUltimo = dias.filter((r) => r.unidade === ultimo.unidade);
    comparativo.push({
      chave,
      nome: ultimo.titulo,
      faixaTexto,
      faixa,
      ultimo: { valor: ultimo.valor, texto: ultimo.texto, data: ultimo.data, status: ultimo.status },
      anterior: anterior ? { valor: anterior.valor, data: anterior.data } : null,
      diferenca,
      mudanca,
      grupo,
      serie:
        daUnidadeDoUltimo.length >= MINIMO_DA_SERIE
          ? daUnidadeDoUltimo.map((r) => ({ data: r.data, valor: r.valor }))
          : null,
    });
  });

  return comparativo.sort(
    (a, b) =>
      a.grupo - b.grupo ||
      (a.ultimo.data < b.ultimo.data ? 1 : a.ultimo.data > b.ultimo.data ? -1 : 0) ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0)
  );
}

/**
 * A linha de resumo acima da tabela: quantos exames melhoraram ou estão na
 * faixa, quantos pioraram e quantos têm um resultado só. "Igual ao anterior",
 * "sem faixa" e "unidade diferente" não dizem nem uma coisa nem outra e não
 * entram em nenhuma conta.
 */
export function resumoDoComparativo(linhas: LinhaDoComparativo[]): {
  melhores: number;
  piores: number;
  umResultado: number;
} {
  const conta = (...mudancas: Mudanca[]) => linhas.filter((l) => mudancas.includes(l.mudanca)).length;
  return {
    melhores: conta("entrou na faixa", "segue na faixa", "mais perto da faixa"),
    piores: conta("saiu da faixa", "mais longe da faixa"),
    umResultado: conta("primeiro resultado"),
  };
}

/**
 * O `aria-label` do minigráfico, para quem não vê o desenho. Ex.: "Vitamina D:
 * 18 em 15/01, 24 em 10/07, 38 em 02/10; faixa de 30 a 100." Sem série (o
 * minigráfico não existe), descreve o último resultado.
 */
export function descricaoDaSerie(linha: LinhaDoComparativo): string {
  if (!linha.serie) return `${linha.nome}: ${br(linha.ultimo.valor)} em ${diaMes(linha.ultimo.data)}.`;

  const pontos = linha.serie.map((p) => `${br(p.valor)} em ${diaMes(p.data)}`).join(", ");
  const { min, max } = linha.faixa ?? {};
  const faixa =
    min != null && max != null
      ? `; faixa de ${br(min)} a ${br(max)}`
      : max != null
        ? `; faixa até ${br(max)}`
        : min != null
          ? `; faixa a partir de ${br(min)}`
          : "";
  return `${linha.nome}: ${pontos}${faixa}.`;
}
