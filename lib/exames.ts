import {
  chaveDoExame,
  dentroDaFaixa,
  ehTextoDaTabela,
  faixaDaTabela,
  parseExamNumber,
  parseReferenceRange,
  unidadeDoExame,
  type ExamContext,
  type ExamLevel,
  type FaixaDeReferencia,
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

/** A faixa em número, com a borda estrita do "<" e do ">" (`parseReferenceRange`). */
export type FaixaNumerica = FaixaDeReferencia;

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
  /**
   * O selo do último resultado, pela MESMA faixa da linha: a da tabela dá os
   * três níveis da entrada (`classify`); a do laudo, "normal" dentro e
   * "alterado" fora; sem faixa, nulo e sem selo. Não é o `status` gravado:
   * ele vinha do classifyExam antigo, que julgava a B12 de 235 pmol/L pela
   * tabela em pg/mL ("atenção" ao lado de "ref. 148 a 664", que a põe dentro).
   */
  situacao: ExamLevel | null;
  /** `texto` é o resultado como a lista mostra: o valor gravado e a unidade ("92 mg/dL"). */
  ultimo: { valor: number; texto: string; data: string };
  anterior: { valor: number; data: string } | null;
  /** Último menos anterior; nulo sem anterior ou com unidade diferente. */
  diferenca: number | null;
  mudanca: Mudanca;
  /** 1 piorou, 2 segue fora ou sem comparação, 3 dentro da faixa, 4 um resultado só. */
  grupo: 1 | 2 | 3 | 4;
  /** Só com 3 resultados numéricos ou mais na unidade do último, em ordem de data. */
  serie: { data: string; valor: number }[] | null;
  /** Em quantos dias o exame tem resultado com número, em qualquer unidade: o "N resultados". */
  resultados: number;
  /**
   * O resultado sem número ("Amostra hemolisada") mais novo, quando é de um
   * dia DEPOIS do último com número; nulo se não há. A comparação segue entre
   * os números, mas a linha diz que veio coisa depois (`avisosDaLinha`).
   */
  depois: { texto: string; data: string } | null;
  /** Os dias (em ordem) em que o exame tem dois resultados com número diferentes: vale o último lançado. */
  maisDeUmNoDia: string[];
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

/**
 * "2026-10-02" -> "02/10", e "2025-12-18" -> "18/12/25" quando o ano não é o
 * de `hoje` (o dia de São Paulo, `todayISO`). Os exames vêm de anos: "18/12"
 * ao lado de "05/04" lia como o dezembro passado e o abril que vem. A coluna
 * `date` já é dia de São Paulo, sem hora.
 */
export function dataDoComparativo(data: string, hoje: string): string {
  const [a, m, d] = data.split("-");
  if (!m || !d) return data;
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`;
}

/** "02/10", "10/07 e 02/10", "01/03, 10/07 e 02/10". */
function listaDeDatas(datas: string[], hoje: string): string {
  const ds = datas.map((d) => dataDoComparativo(d, hoje));
  return ds.length < 2 ? ds.join("") : `${ds.slice(0, -1).join(", ")} e ${ds[ds.length - 1]}`;
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

/** Dentro da faixa: a borda conta como dentro, menos a estrita ("< 190" deixa o 190 fora). */
const dentro = dentroDaFaixa;

/**
 * A distância até a borda mais próxima; zero entre as bordas E na borda. Por
 * isso não diz se o valor está dentro (`dentro` diz): o 190 com "< 190" está
 * fora a uma distância zero, e o 200 → 190 é "mais perto da faixa".
 */
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
  /** Normalizada; nas entradas com equivalentes, a principal (`unidadeDoExame`: mmol/L do potássio vira mEq/L). */
  unidade: string;
  referencia: string | null;
  /** Posição na entrada: desempata dois resultados do mesmo dia. */
  ordem: number;
};

/** Um resultado sem número ("reagente", "Amostra hemolisada"), para o aviso de `depois`. */
type SemNumero = { data: string; texto: string; ordem: number };

/**
 * A faixa do último resultado, que é a régua da linha inteira, e o selo dele:
 *  1. a do laudo dele (`reference_range`), se `parseReferenceRange` a lê (uma
 *     faixa ou um limite só, fora de parênteses, sem palavra de estrato) e se
 *     não é, letra por letra, um texto de faixa da tabela do app
 *     (`ehTextoDaTabela`). Esse texto é da tabela gravado no lugar do laudo:
 *     o casamento frouxo antigo do classifyExam dava ao VLDL-colesterol o
 *     "< 190 mg/dL" do colesterol total, e o VLDL de 24 para 35 "seguia na
 *     faixa". Selo: dentro "normal", fora "alterado";
 *  2. senão, a da tabela do app (`faixaDaTabela`), só quando o nome casa com
 *     uma entrada pela regra estrita ("VLDL-colesterol" não leva a do
 *     colesterol total), a unidade do resultado está em branco ou é uma da
 *     entrada (glicose de 5,1 mmol/L contra 70–99 mg/dL seria "abaixo da
 *     faixa" para um valor normal), e o exame não depende do sexo ou o sexo é
 *     conhecido. Selo: os três níveis da entrada;
 *  3. senão, nenhuma: a linha diz "sem faixa para comparar", sem selo.
 * A prioridade é a da spec, a do laudo antes da tabela.
 */
function faixaDoUltimo(
  ultimo: Resultado,
  ctx: ExamContext
): { faixa: FaixaNumerica | null; texto: string | null; situacao: ExamLevel | null } {
  const doLaudo = ehTextoDaTabela(ultimo.referencia) ? null : faixaDoTexto(ultimo.referencia);
  if (doLaudo) {
    return {
      faixa: doLaudo,
      texto: (ultimo.referencia ?? "").trim(),
      situacao: dentro(ultimo.valor, doLaudo) ? "normal" : "alterado",
    };
  }

  const daTabela = faixaDaTabela(ultimo.titulo, ultimo.valor, ctx, ultimo.unidade);
  if (daTabela) {
    const faixa = faixaDoTexto(daTabela.faixa);
    if (faixa) return { faixa, texto: daTabela.faixa, situacao: daTabela.situacao };
  }
  return { faixa: null, texto: null, situacao: null };
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
    const ultimoDentro = faixa != null && dentro(ultimo.valor, faixa);
    return { mudanca: "unidade diferente do anterior", diferenca: null, grupo: ultimoDentro ? 3 : 2 };
  }

  const diferenca = limpa(ultimo.valor - anterior.valor);
  // Sem faixa não se sabe se melhorou: fica com a diferença, junto dos que
  // seguem fora (2) e não entre os que pioraram.
  if (!faixa) return { mudanca: "sem faixa para comparar", diferenca, grupo: 2 };

  // Dentro ou fora decide primeiro, e a distância só compara dois de fora: na
  // borda estrita a distância é zero e o valor está fora.
  if (dentro(anterior.valor, faixa)) {
    return dentro(ultimo.valor, faixa)
      ? { mudanca: "segue na faixa", diferenca, grupo: 3 }
      : { mudanca: "saiu da faixa", diferenca, grupo: 1 };
  }
  if (dentro(ultimo.valor, faixa)) return { mudanca: "entrou na faixa", diferenca, grupo: 3 };
  const antes = distanciaAFaixa(anterior.valor, faixa);
  const agora = distanciaAFaixa(ultimo.valor, faixa);
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
 * Resultado sem número ("reagente") não entra na conta, e o exame que só tem
 * desses não aparece; o mais novo deles, quando é de depois do último com
 * número, vira o `depois` da linha. Dois resultados do mesmo exame no mesmo
 * dia contam como um, o último da entrada (com valores diferentes, a linha
 * avisa em `maisDeUmNoDia`); o "anterior" é sempre de uma data anterior.
 *
 * A entrada deve vir em ordem crescente de data e, no mesmo dia, de
 * `created_at`: "o último da entrada" decide o resultado do dia, e a linha
 * não traz `created_at` para desempatar aqui dentro.
 */
export function compararExames(linhas: LinhaDeExame[], ctx: ExamContext): LinhaDoComparativo[] {
  // Primeiro o número: um "ver laudo" lançado depois não apaga o 44 do mesmo dia.
  const porChave = new Map<string, Resultado[]>();
  const semNumero = new Map<string, SemNumero[]>();
  linhas.forEach((l, ordem) => {
    // Nome que não tem letra nem número ("???") não diz de que exame é.
    const titulo = (l.title ?? "").trim();
    const chave = chaveDoExame(titulo);
    if (!chave) return;
    const valor = parseExamNumber(l.result_value);
    if (valor == null) {
      const lista = semNumero.get(chave) ?? [];
      lista.push({ data: l.date, texto: l.result_value?.trim() || "sem resultado", ordem });
      semNumero.set(chave, lista);
      return;
    }
    const lista = porChave.get(chave) ?? [];
    lista.push({
      data: l.date,
      titulo,
      valor,
      texto: [l.result_value?.trim(), l.unit?.trim()].filter(Boolean).join(" "),
      unidade: unidadeDoExame(titulo, l.unit),
      referencia: l.reference_range,
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
    const maisDeUmNoDia: string[] = [];
    for (const r of lista) {
      const doDia = dias.length ? dias[dias.length - 1] : null;
      if (doDia && doDia.data === r.data) {
        // O mesmo valor lançado duas vezes não é aviso; outro valor (ou outra
        // unidade) é, porque só o último lançado aparece.
        const outro = doDia.valor !== r.valor || doDia.unidade !== r.unidade;
        if (outro && maisDeUmNoDia[maisDeUmNoDia.length - 1] !== r.data) maisDeUmNoDia.push(r.data);
        dias[dias.length - 1] = r;
      } else {
        dias.push(r);
      }
    }

    const ultimo = dias[dias.length - 1];
    const anterior = dias.length > 1 ? dias[dias.length - 2] : null;
    const { faixa, texto: faixaTexto, situacao } = faixaDoUltimo(ultimo, ctx);
    const { mudanca, diferenca, grupo } = compararComOAnterior(ultimo, anterior, faixa);

    // O sem número mais novo, se for de um dia depois do último com número.
    const depoisDoUltimo = (semNumero.get(chave) ?? [])
      .filter((r) => r.data > ultimo.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ordem - b.ordem));
    const maisNovo = depoisDoUltimo[depoisDoUltimo.length - 1];

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
      situacao,
      ultimo: { valor: ultimo.valor, texto: ultimo.texto, data: ultimo.data },
      anterior: anterior ? { valor: anterior.valor, data: anterior.data } : null,
      diferenca,
      mudanca,
      grupo,
      serie:
        daUnidadeDoUltimo.length >= MINIMO_DA_SERIE
          ? daUnidadeDoUltimo.map((r) => ({ data: r.data, valor: r.valor }))
          : null,
      resultados: dias.length,
      depois: maisNovo ? { texto: maisNovo.texto, data: maisNovo.data } : null,
      maisDeUmNoDia,
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
 * Os avisos da linha, em palavras, para a coluna do último resultado: o
 * resultado sem número que veio depois ("depois: Amostra hemolisada em 01/09")
 * e os dias com mais de um resultado ("mais de um resultado em 02/10"). A spec
 * pede que o resultado sem número seja dito na linha, nunca escondido.
 */
export function avisosDaLinha(linha: LinhaDoComparativo, hoje: string): string[] {
  const avisos: string[] = [];
  if (linha.depois) avisos.push(`depois: ${linha.depois.texto} em ${dataDoComparativo(linha.depois.data, hoje)}`);
  if (linha.maisDeUmNoDia.length) avisos.push(`mais de um resultado em ${listaDeDatas(linha.maisDeUmNoDia, hoje)}`);
  return avisos;
}

/**
 * A frase da tela quando não há o que comparar (nenhuma linha com anterior),
 * ou nula quando há. "Cada exame tem um resultado só" só quando é verdade: o
 * exame com dois resultados sem número, ou com um sem número além do número,
 * ou com dois no mesmo dia, também cai aqui, e a frase diz o que falta.
 */
export function fraseSemComparacao(linhas: LinhaDeExame[], comparativo: LinhaDoComparativo[]): string | null {
  if (comparativo.some((l) => l.mudanca !== "primeiro resultado")) return null;
  if (comparativo.length === 0) return "Sem comparação ainda: nenhum resultado tem número para comparar.";

  const porExame = new Map<string, number>();
  let algumSemNumero = false;
  for (const l of linhas) {
    const chave = chaveDoExame((l.title ?? "").trim());
    if (!chave) continue;
    porExame.set(chave, (porExame.get(chave) ?? 0) + 1);
    if (parseExamNumber(l.result_value) == null) algumSemNumero = true;
  }
  if (Array.from(porExame.values()).every((n) => n === 1) && !algumSemNumero) {
    return "Sem comparação ainda: cada exame tem um resultado só.";
  }
  return `Sem comparação ainda: nenhum exame tem dois resultados com número em dias diferentes${
    algumSemNumero ? ", e resultado sem número não se compara" : ""
  }.`;
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
 * 18 em 18/12/25, 24 em 10/07, 38 em 02/10; faixa de 30 a 100." (o ano só
 * quando não é o de `hoje`, `dataDoComparativo`). Sem série (o minigráfico não
 * existe), descreve o último resultado.
 */
export function descricaoDaSerie(linha: LinhaDoComparativo, hoje: string): string {
  if (!linha.serie) return `${linha.nome}: ${br(linha.ultimo.valor)} em ${dataDoComparativo(linha.ultimo.data, hoje)}.`;

  const pontos = linha.serie.map((p) => `${br(p.valor)} em ${dataDoComparativo(p.data, hoje)}`).join(", ");
  const { min, max, minExclusivo, maxExclusivo } = linha.faixa ?? {};
  // "até 20" diria que o 20 está dentro; com "< 20", não está.
  const faixa =
    min != null && max != null
      ? `; faixa de ${br(min)} a ${br(max)}`
      : max != null
        ? `; faixa ${maxExclusivo ? "abaixo de" : "até"} ${br(max)}`
        : min != null
          ? `; faixa ${minExclusivo ? "acima de" : "a partir de"} ${br(min)}`
          : "";
  return `${linha.nome}: ${pontos}${faixa}.`;
}
