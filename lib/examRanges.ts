// Faixas de referência de exames laboratoriais: a leitura da faixa impressa no
// laudo (`parseReferenceRange`), o nome e a unidade de cada exame
// (`chaveDoExame`, `unidadeDoExame`) e a tabela curada do app (adulto, com
// faixas por sexo e idade quando isso muda a referência: `faixaDaTabela`).
//
// Duas regras usam isto, uma para cada lado (CLAUDE.md, "Uso pretendido"):
//   - o paciente vê só a posição do valor na faixa do laudo
//     (`situacaoNoLaudo` e `linhaDoLaudo`, aqui), nunca a tabela do app;
//   - a nutricionista vê o selo da `situacaoParaANutricionista`
//     (`lib/exames.ts`): o laudo primeiro, depois a tabela.
//
// Este módulo é PURO (sem dependências de servidor) para poder ser usado
// tanto no back-end (chat/IA) quanto no front-end (formulário).

export type Sex = "M" | "F" | null | undefined;
export type ExamLevel = "normal" | "atencao" | "alterado";
export type ExamDirection = "baixo" | "normal" | "alto";

export type ExamContext = { sex?: Sex; age?: number | null };

// Extrai o primeiro número de um texto (aceita vírgula decimal).
export function parseExamNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const m = input.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Uma faixa de referência lida do texto. As bordas são dentro da faixa, salvo
 * quando o operador é estrito: "< 190" quer dizer que 190 já não é
 * desejável, e "> 40" que 40 ainda não basta. Lido como "até 190", o
 * colesterol de 190 "entrava na faixa" no comparativo e saía "normal" pelo
 * laudo, onde a tabela do app dizia "atenção".
 */
export type FaixaDeReferencia = {
  min?: number;
  max?: number;
  /** O `min` fica fora ("> 40", "acima de 40", "superior a 40"). Ausente: dentro. */
  minExclusivo?: true;
  /** O `max` fica fora ("< 190", "abaixo de 190", "inferior a 190"). Ausente: dentro. */
  maxExclusivo?: true;
};

/** O valor está dentro da faixa? A borda conta como dentro, menos a estrita. */
export function dentroDaFaixa(valor: number, faixa: FaixaDeReferencia): boolean {
  if (faixa.min != null && (faixa.minExclusivo ? valor <= faixa.min : valor < faixa.min)) return false;
  if (faixa.max != null && (faixa.maxExclusivo ? valor >= faixa.max : valor > faixa.max)) return false;
  return true;
}

// Os operadores de um limite só, sobre o texto já sem acento e em minúsculas.
// A ordem importa nas que começam igual: "<=" antes de "<", senão o "<"
// casava sozinho e o "=" sobrava (a expressão antiga só acertava o ">=" por
// retrocesso, e o "=" não decidia nada). As de palavra pedem limite de
// palavra: "ate" não pode casar dentro de outra palavra.
const OPERADORES: { expr: string; lado: "min" | "max"; estrito: boolean }[] = [
  { expr: "<=", lado: "max", estrito: false },
  { expr: "≤", lado: "max", estrito: false },
  { expr: String.raw`\bmenor ou igual a\b`, lado: "max", estrito: false },
  { expr: String.raw`\bigual ou inferior a\b`, lado: "max", estrito: false },
  { expr: String.raw`\bate\b`, lado: "max", estrito: false },
  { expr: "<", lado: "max", estrito: true },
  { expr: String.raw`\bmenor (?:do )?que\b`, lado: "max", estrito: true },
  { expr: String.raw`\babaixo de\b`, lado: "max", estrito: true },
  { expr: String.raw`\binferior a\b`, lado: "max", estrito: true },
  { expr: ">=", lado: "min", estrito: false },
  { expr: "≥", lado: "min", estrito: false },
  { expr: String.raw`\bmaior ou igual a\b`, lado: "min", estrito: false },
  { expr: String.raw`\bigual ou superior a\b`, lado: "min", estrito: false },
  { expr: ">", lado: "min", estrito: true },
  { expr: String.raw`\bmaior (?:do )?que\b`, lado: "min", estrito: true },
  { expr: String.raw`\bacima de\b`, lado: "min", estrito: true },
  { expr: String.raw`\bsuperior a\b`, lado: "min", estrito: true },
];

const NUMERO = String.raw`(-?\d+(?:\.\d+)?)`;
// Cada pedaço do texto que é uma faixa ("70 a 99", "70-99", "70 até 99") ou
// um limite ("< 190", "acima de 40"). Grupos: 1 e 2 são as pontas da faixa; um
// por operador, na ordem de OPERADORES; o último é o número do limite.
const PEDACO = new RegExp(
  String.raw`${NUMERO}\s*(?:-|–|—|\ba\b|\bate\b)\s*${NUMERO}|(?:${OPERADORES.map((o) => `(${o.expr})`).join("|")})\s*${NUMERO}`,
  "g"
);

// Palavras de estrato: a referência que as tem fora de parênteses é uma
// tabela por sexo, idade, fase ou risco, não uma faixa. Sem acento.
const ESTRATO =
  /\b(?:homem|homens|mulher|mulheres|masculino|feminino|anos|fase|risco|desejavel|limitrofe|otimo|diabetes)\b|\bpre-/;

/**
 * O "(" do começo fecha no último caractere? Então o texto inteiro é um
 * embrulho de parênteses: "(70 a 99)" sim, "(70 a 99) (jejum)" não (são dois
 * comentários).
 */
function embrulhadoPorInteiro(t: string): boolean {
  let fundo = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") fundo++;
    else if (t[i] === ")" && --fundo === 0) return i === t.length - 1;
  }
  return false;
}

/** "((70 a 99))" é "70 a 99"; o que não é um embrulho só passa como está. */
function semEmbrulho(texto: string): string {
  let t = texto.trim();
  while (t.startsWith("(") && t.endsWith(")") && embrulhadoPorInteiro(t)) t = t.slice(1, -1).trim();
  return t;
}

/**
 * Lê a faixa de referência de um texto de laudo: "70 a 99", "70-99", "< 200",
 * "até 150", "> 40", "≥ 30", "inferior a 5,7%"...
 *
 * Devolve `null` quando o texto, fora de parênteses, tem mais de uma faixa ou
 * limite, ou uma palavra de estrato (homens, mulheres, anos, fase, risco,
 * desejável, limítrofe, ótimo, pré-, diabetes). Lida pela primeira faixa que a
 * expressão achava, a referência em níveis ("Normal: < 5,7 %; Pré-diabetes:
 * 5,7 a 6,4 %; Diabetes: ≥ 6,5 %") ia contra 5,7–6,4, e a glicada que subiu de
 * 5,4 para 6,0 "entrava na faixa". Uma por sexo dava a faixa do homem à
 * mulher. Sem faixa, o comparativo diz "sem faixa para comparar" e o texto
 * inteiro continua na tela. O que está entre parênteses é comentário e não
 * conta: "< 130 mg/dL (ideal < 100)" é "< 130", e "≥ 50 mg/dL (mulheres)" é
 * "≥ 50" (os textos da tabela do app são assim). Mas quando o texto TODO está
 * entre parênteses, "(70 a 99)", o que está dentro é a faixa: tirar tudo o
 * que tem parênteses deixava esse texto vazio e dava `null`, onde antes dava
 * 70–99.
 */
export function parseReferenceRange(ref: unknown): FaixaDeReferencia | null {
  if (typeof ref !== "string") return null;
  // Todas as vírgulas: com `replace(",", ".")` só a primeira trocava, e
  // "0,9 a 1,7" virava 0,9 a 1 (o 1,5 normal saía "alterado, acima").
  const fora = semEmbrulho(ref)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,/g, ".");
  if (ESTRATO.test(fora)) return null;

  const pedacos = Array.from(fora.matchAll(PEDACO));
  if (pedacos.length !== 1) return null;
  const m = pedacos[0];

  if (m[1] != null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const i = OPERADORES.findIndex((_, j) => m[3 + j] != null);
  const n = Number(m[3 + OPERADORES.length]);
  if (i < 0 || !Number.isFinite(n)) return null;
  const { lado, estrito } = OPERADORES[i];
  if (lado === "max") return estrito ? { max: n, maxExclusivo: true } : { max: n };
  return estrito ? { min: n, minExclusivo: true } : { min: n };
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

/**
 * Uma parte da unidade (o que fica de cada lado da barra), na forma comparável:
 *  - UI, IU e U são a mesma unidade internacional, com ou sem prefixo ("mUI",
 *    "µUI", "uUI", "mIU"); o prefixo micro (u, µ, mc) vira µ e o mili fica m;
 *  - em qualquer outra unidade, o prefixo micro inicial (u, µ, mc) vira µ:
 *    "mcg", "ug" e "µg" são o micrograma, "umol" o micromol, "uL" o microlitro.
 * Parte que não começa assim (mg, ng, mmol, dL, mL...) passa como está.
 */
function parteDaUnidade(parte: string): string {
  const internacional = parte.match(/^(m|\u03bc|u|mc)?(?:ui|iu|u)$/);
  if (internacional) {
    const prefixo = internacional[1];
    return (prefixo === undefined ? "" : prefixo === "m" ? "m" : "\u03bc") + "u";
  }
  return parte.replace(/^(?:\u03bc|u|mc)(?=[a-z])/, "\u03bc");
}

/**
 * A unidade para comparar: sem espaço e sem caixa ("mg/dL" e " MG / DL " são
 * a mesma). O NFKC junta o sinal de micro (U+00B5) e a letra grega mi
 * (U+03BC), que o laudo copiado de PDF traz um ou outro; `parteDaUnidade`
 * junta mcg, ug, µg e UI, IU, U. Por fim, µUI/mL e mUI/L são o mesmo número (1
 * µUI/mL = 1 mUI/L, e a TSH aparece de um jeito ou do outro), então a
 * primeira vira a segunda. Só essas equivalências valem para qualquer exame:
 * µg/mL e mg/L, por exemplo, não são tratadas como iguais. As que valem só
 * para um exame (mEq/L e mmol/L do potássio) moram na entrada dele.
 */
export function unidadeNormalizada(unidade: string | null | undefined): string {
  const u = (unidade ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase()
    .split("/")
    .map(parteDaUnidade)
    .join("/");
  return u === "\u03bcu/ml" ? "mu/l" : u;
}

// Normaliza o nome do exame para casar com a tabela.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RangeDef = {
  keys: string[]; // termos que identificam o exame (sem acento)
  unit: string;
  /**
   * Outras grafias de unidade que dão o MESMO número neste exame: mmol/L do
   * potássio e do sódio é o mesmo que mEq/L (íon de carga 1). Não vale como
   * regra geral: no cálcio e no magnésio, 1 mmol/L são 2 mEq/L.
   */
  unidadesEquivalentes?: string[];
  sexDependent?: boolean; // faixa muda muito entre homens e mulheres
  // devolve status/direção/faixa a partir do valor e do contexto
  classify: (v: number, ctx: ExamContext) => {
    status: ExamLevel;
    direction: ExamDirection;
    faixa: string;
  };
};

// Ajuda: exame em que apenas valores ALTOS preocupam (colesterol, glicose…).
// bordas: [desejavelMax, alteradoMin] → normal < desejavelMax ≤ atenção < alteradoMin ≤ alterado
function highConcern(
  desirableMax: number,
  alteredMin: number,
  faixa: string,
  lowFloor?: number // abaixo disso também é alterado (ex.: hipoglicemia)
) {
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (lowFloor != null && v < lowFloor)
      return { status: "alterado", direction: "baixo", faixa };
    if (v >= alteredMin) return { status: "alterado", direction: "alto", faixa };
    if (v >= desirableMax) return { status: "atencao", direction: "alto", faixa };
    return { status: "normal", direction: "normal", faixa };
  };
}

// Ajuda: exame com faixa fechada [min, max]; fora dela é alterado, com uma
// pequena margem de "atenção" nas bordas.
function windowConcern(min: number, max: number, faixa: string) {
  const margin = (max - min) * 0.08;
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (v < min)
      return {
        status: v < min - margin ? "alterado" : "atencao",
        direction: "baixo",
        faixa,
      };
    if (v > max)
      return {
        status: v > max + margin ? "alterado" : "atencao",
        direction: "alto",
        faixa,
      };
    return { status: "normal", direction: "normal", faixa };
  };
}

// Ajuda: exame em que valores BAIXOS preocupam (HDL, vitamina D, hemoglobina).
function lowConcern(normalMin: number, alteredMax: number, faixa: string) {
  // normal ≥ normalMin ; atenção entre alteredMax e normalMin ; alterado < alteredMax
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (v >= normalMin) return { status: "normal", direction: "normal", faixa };
    if (v >= alteredMax) return { status: "atencao", direction: "baixo", faixa };
    return { status: "alterado", direction: "baixo", faixa };
  };
}

const isFemale = (ctx: ExamContext) => ctx.sex === "F";

const TABLE: RangeDef[] = [
  {
    keys: ["glicose", "glicemia", "glicose jejum", "glicose em jejum", "glicemia de jejum", "glicose basal"],
    unit: "mg/dL",
    classify: (v) =>
      highConcern(100, 126, "70–99 mg/dL (jejum)", 70)(v),
  },
  {
    keys: ["hemoglobina glicada", "hba1c", "a1c", "glicada"],
    unit: "%",
    classify: (v) => highConcern(5.7, 6.5, "< 5,7%")(v),
  },
  {
    // "e frações" é key, e não palavra neutra: "Hemoglobina e frações" é a
    // eletroforese, outro exame, e a neutra juntava com a hemoglobina.
    keys: ["colesterol total", "colesterol", "colesterol total e fracoes", "colesterol e fracoes"],
    unit: "mg/dL",
    classify: (v) => highConcern(190, 240, "< 190 mg/dL")(v),
  },
  {
    keys: ["ldl", "colesterol ldl", "ldl colesterol", "ldl c"],
    unit: "mg/dL",
    classify: (v) => highConcern(130, 160, "< 130 mg/dL (ideal < 100)")(v),
  },
  {
    keys: ["hdl", "colesterol hdl", "hdl colesterol", "hdl c"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? lowConcern(50, 45, "≥ 50 mg/dL (mulheres)")(v)
        : lowConcern(40, 35, "≥ 40 mg/dL (homens)")(v),
  },
  {
    keys: ["triglicerideos", "triglicerides", "triglicerides", "tg"],
    unit: "mg/dL",
    classify: (v) => highConcern(150, 200, "< 150 mg/dL")(v),
  },
  {
    keys: [
      "vitamina d",
      "25 oh vitamina d",
      "25 hidroxivitamina d",
      "vitamina d 25",
      "25 hidroxi vitamina d",
      "vitamina d 25 hidroxi",
    ],
    unit: "ng/mL",
    classify: (v) => {
      if (v > 100) return { status: "atencao", direction: "alto", faixa: "30–100 ng/mL" };
      return lowConcern(30, 20, "30–100 ng/mL")(v);
    },
  },
  {
    // O "ultrassensível" é o método, não outro exame: com uma entrada à parte,
    // TSH e TSH ultrassensível viravam duas linhas, cada uma com um resultado.
    keys: ["tsh", "hormonio tireoestimulante", "tsh ultrassensivel", "tsh ultra sensivel"],
    unit: "µUI/mL",
    classify: (v) => windowConcern(0.4, 4.0, "0,4–4,0 µUI/mL")(v),
  },
  {
    keys: ["t4 livre", "tiroxina livre", "ft4"],
    unit: "ng/dL",
    classify: (v) => windowConcern(0.9, 1.7, "0,9–1,7 ng/dL")(v),
  },
  {
    keys: ["creatinina"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(0.6, 1.1, "0,6–1,1 mg/dL (mulheres)")(v)
        : windowConcern(0.7, 1.3, "0,7–1,3 mg/dL (homens)")(v),
  },
  {
    keys: ["ureia"],
    unit: "mg/dL",
    classify: (v) => windowConcern(15, 45, "15–45 mg/dL")(v),
  },
  {
    keys: ["acido urico", "urico"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(2.4, 6.0, "2,4–6,0 mg/dL (mulheres)")(v)
        : windowConcern(3.4, 7.0, "3,4–7,0 mg/dL (homens)")(v),
  },
  {
    keys: ["hemoglobina", "hb"],
    unit: "g/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? lowConcern(12, 11, "12–16 g/dL (mulheres)")(v)
        : lowConcern(13, 12, "13–17 g/dL (homens)")(v),
  },
  {
    keys: ["hematocrito", "ht"],
    unit: "%",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(36, 46, "36–46% (mulheres)")(v)
        : windowConcern(40, 52, "40–52% (homens)")(v),
  },
  {
    keys: ["ferritina"],
    unit: "ng/mL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(15, 150, "15–150 ng/mL (mulheres)")(v)
        : windowConcern(30, 400, "30–400 ng/mL (homens)")(v),
  },
  {
    keys: ["testosterona total", "testosterona"],
    unit: "ng/dL",
    sexDependent: true,
    classify: (v, ctx) => {
      if (isFemale(ctx)) return windowConcern(15, 70, "15–70 ng/dL (mulheres)")(v);
      const faixa = "264–916 ng/dL (homens)";
      if (v < 264) return { status: "alterado", direction: "baixo", faixa };
      if (v > 916) return { status: "alterado", direction: "alto", faixa };
      if (v < 350) return { status: "atencao", direction: "baixo", faixa };
      return { status: "normal", direction: "normal", faixa };
    },
  },
  {
    keys: ["vitamina b12", "b12", "cobalamina"],
    unit: "pg/mL",
    classify: (v) => {
      if (v < 200) return { status: "alterado", direction: "baixo", faixa: "200–900 pg/mL" };
      if (v < 300) return { status: "atencao", direction: "baixo", faixa: "200–900 pg/mL" };
      if (v > 900) return { status: "atencao", direction: "alto", faixa: "200–900 pg/mL" };
      return { status: "normal", direction: "normal", faixa: "200–900 pg/mL" };
    },
  },
  {
    keys: ["ferro", "ferro serico"],
    unit: "µg/dL",
    classify: (v) => windowConcern(60, 160, "60–160 µg/dL")(v),
  },
  {
    // "Transaminase oxalacética" é o nome que o laudo dá à TGO/AST, e a "pirúvica"
    // à TGP/ALT; a palavra sozinha não é key, para não bastar para nada.
    keys: [
      "tgo",
      "ast",
      "aspartato aminotransferase",
      "transaminase oxalacetica",
      "transaminase glutamico oxalacetica",
    ],
    unit: "U/L",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? highConcern(32, 48, "até 32 U/L (mulheres)")(v)
        : highConcern(40, 60, "até 40 U/L (homens)")(v),
  },
  {
    keys: [
      "tgp",
      "alt",
      "alanina aminotransferase",
      "transaminase piruvica",
      "transaminase glutamico piruvica",
    ],
    unit: "U/L",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? highConcern(33, 50, "até 33 U/L (mulheres)")(v)
        : highConcern(41, 62, "até 41 U/L (homens)")(v),
  },
  {
    keys: [
      "pcr",
      "proteina c reativa",
      "proteina c-reativa",
      "pcr us",
      "pcr ultrassensivel",
      "proteina c reativa ultrassensivel",
      // como o TSH: o método também chega separado ("ultra-sensível", "ultra sensível")
      "pcr ultra sensivel",
      "proteina c reativa ultra sensivel",
    ],
    unit: "mg/L",
    classify: (v) => highConcern(3, 10, "< 3 mg/L")(v),
  },
  {
    keys: ["potassio", "k"],
    unit: "mEq/L",
    unidadesEquivalentes: ["mmol/L"],
    classify: (v) => windowConcern(3.5, 5.1, "3,5–5,1 mEq/L")(v),
  },
  {
    keys: ["sodio", "na"],
    unit: "mEq/L",
    unidadesEquivalentes: ["mmol/L"],
    classify: (v) => windowConcern(135, 145, "135–145 mEq/L")(v),
  },
];

/**
 * Todos os textos de faixa que a tabela dá (os dois sexos, qualquer valor: o
 * texto não muda com o valor, só com o sexo). Servem para reconhecer o texto
 * da tabela gravado em `reference_range` (`ehTextoDaTabela`).
 */
const VALORES_DE_AMOSTRA = [0, 0.5, 1, 2, 5, 10, 50, 100, 150, 200, 300, 500, 1000, 100000];
export const TEXTOS_DE_FAIXA_DA_TABELA: ReadonlySet<string> = new Set(
  TABLE.flatMap((def) =>
    (["F", "M"] as const).flatMap((sex) => VALORES_DE_AMOSTRA.map((v) => def.classify(v, { sex }).faixa))
  )
);

/**
 * O texto é, letra por letra (sem os espaços das pontas), um texto de faixa da
 * tabela do app? Então não é o laudo do laboratório: o casamento frouxo antigo
 * do `classifyExam` gravava em `reference_range` o texto da entrada que ele
 * achava (o VLDL-colesterol saía com "< 190 mg/dL", do colesterol total), e o
 * formulário de exames e a IA gravavam o texto da tabela quando o laudo não
 * trazia faixa. Desde o `exameParaGravar` nada grava mais, mas as linhas
 * antigas seguem no banco.
 */
export function ehTextoDaTabela(texto: string | null | undefined): boolean {
  return !!texto && TEXTOS_DE_FAIXA_DA_TABELA.has(texto.trim().replace(/\s+/g, " "));
}

export type SituacaoNoLaudo = "dentro" | "acima" | "abaixo" | "sem faixa";

/**
 * Onde o valor fica na faixa impressa no laudo: é tudo o que o paciente vê do
 * resultado. A tabela do app nunca entra aqui: julgar pela tabela (com sexo,
 * idade e o nível "atenção") é juízo clínico, e esse fica com a nutricionista
 * (`situacaoParaANutricionista`; spec do uso pretendido, "A regra"). Sem faixa
 * legível (referência em níveis, texto da tabela gravado no lugar do laudo,
 * valor sem número), não há o que comparar.
 */
// Título ("1/40", "1:160"): o número que se lê dele é o 1, e "1/40" contra
// "< 1/80" saía "acima" sendo abaixo.
const TITULO = /\d\s*[/:]\s*\d/;
// Ponto de milhar ("4.000", "250.000"). O `parseExamNumber` lê o ponto como
// decimal, o que só dá certo quando os dois lados o escrevem: "4500" contra
// "4.000 a 11.000" saía "acima" para um leucograma normal.
const MILHAR = /\d\.\d{3}(?!\d)/;

export function situacaoNoLaudo(
  valor: unknown,
  referencia: unknown
): { situacao: SituacaoNoLaudo; faixa: string | null } {
  const semFaixa = { situacao: "sem faixa" as const, faixa: null };
  const v = parseExamNumber(valor);
  if (v == null || typeof referencia !== "string" || ehTextoDaTabela(referencia)) return semFaixa;
  const textoDoValor = typeof valor === "string" ? valor.trim() : String(valor);
  if (TITULO.test(textoDoValor) || TITULO.test(referencia)) return semFaixa;
  if (MILHAR.test(textoDoValor) !== MILHAR.test(referencia)) return semFaixa;
  const faixa = parseReferenceRange(referencia);
  if (!faixa || (faixa.min == null && faixa.max == null)) return semFaixa;
  const texto = referencia.trim();

  // Valor com operador ("< 10", "> 90") é um intervalo, não um ponto: só se
  // afirma quando o intervalo inteiro cai de um lado. "< 10" contra "10 a 50"
  // é abaixo; "< 20" pode ser qualquer um dos dois. Outros operadores (≤, ≥)
  // não se afirmam.
  if (/[≤≥]|<=|>=/.test(textoDoValor)) return semFaixa;
  if (textoDoValor.startsWith("<")) {
    if (faixa.min != null) return v <= faixa.min ? { situacao: "abaixo", faixa: texto } : semFaixa;
    return v <= faixa.max! ? { situacao: "dentro", faixa: texto } : semFaixa;
  }
  if (textoDoValor.startsWith(">")) {
    if (faixa.max != null) return v >= faixa.max ? { situacao: "acima", faixa: texto } : semFaixa;
    return v >= faixa.min! ? { situacao: "dentro", faixa: texto } : semFaixa;
  }

  if (dentroDaFaixa(v, faixa)) return { situacao: "dentro", faixa: texto };
  const acima = faixa.max != null && (faixa.maxExclusivo ? v >= faixa.max : v > faixa.max);
  return { situacao: acima ? "acima" : "abaixo", faixa: texto };
}

export function textoDaSituacaoNoLaudo(s: { situacao: SituacaoNoLaudo; faixa: string | null }): string {
  if (s.situacao === "sem faixa" || !s.faixa) return "sem faixa do laudo";
  return `${s.situacao} da faixa do laudo (${s.faixa})`;
}

/**
 * A linha do resultado para o paciente (página Exames, leitura do laudo,
 * formulário e Gaia): a `textoDaSituacaoNoLaudo`, ou, quando o laudo traz uma
 * referência que não se compara (em níveis, "Negativo"), essa referência como
 * está, sem comparação: mostrar o que o laudo imprime é constatar. O texto da
 * tabela do app gravado no lugar do laudo não aparece: não é do laudo.
 * `fora` é acima ou abaixo da faixa, o que a tela pinta de atenção.
 */
export function linhaDoLaudo(valor: unknown, referencia: unknown): { texto: string; fora: boolean } {
  const s = situacaoNoLaudo(valor, referencia);
  if (s.situacao !== "sem faixa") return { texto: textoDaSituacaoNoLaudo(s), fora: s.situacao !== "dentro" };
  const ref = typeof referencia === "string" ? referencia.trim() : "";
  if (ref && !ehTextoDaTabela(ref)) return { texto: `referência do laudo: ${ref}`, fora: false };
  return { texto: textoDaSituacaoNoLaudo(s), fora: false };
}

// As palavras de cada entrada da tabela: a união das palavras de todas as keys
// dela, contada como uma só (a entrada da glicose tem "glicose", "glicemia",
// "jejum", "em" e "de"). Na ordem de TABLE.
const PALAVRAS_DAS_ENTRADAS: Set<string>[] = TABLE.map(
  (def) => new Set(def.keys.flatMap((k) => norm(k).split(" ")))
);

// Palavras que dizem de onde veio a amostra e não de qual exame se trata
// ("Potássio sérico", "Glicose plasmática"): não contam contra o nome na
// cobertura. Já normalizadas, sem acento. Sem "urina" e "urinária" de
// propósito: glicose na urina é outro exame, e a glicose do sangue não é a
// faixa dela.
const PALAVRAS_DE_AMOSTRA = new Set([
  "soro",
  "serico",
  "serica",
  "sericos",
  "sericas",
  "plasma",
  "plasmatico",
  "plasmatica",
  "sangue",
  "sanguineo",
]);

// Palavras que dizem COMO o resultado foi obtido ou de onde ele vem, e não de
// qual exame se trata ("Colesterol LDL calculado", "COLESTEROL LDL -
// FRIEDEWALD", "Glicose basal", "Hemograma - Hemoglobina", "TRANSAMINASE ...
// (TGO/AST)"): também não contam contra o nome. Sem elas, o nome que o laudo
// escreve todo dia não casava com a entrada e o `classifyExam` dava
// `source: "nenhuma"`; pelo chat o LDL-c de 180 era gravado "normal" e saía
// da fila de triagem. Servem só como "não pesa contra", nunca como prova: o
// nome precisa de pelo menos uma palavra que conte e da key inteira de uma
// entrada, então "Calculado" ou "Basal" sozinhos não são exame. Palavra que
// juntaria exame diferente não entra aqui, e sim como key da entrada que a
// tem ("e frações", que a hemoglobina também escreve; ver o colesterol total).
const PALAVRAS_DE_METODO = new Set([
  "calculado",
  "calculada",
  "friedewald",
  "ultrassensivel",
  "basal",
  "hemograma",
  "transaminase",
]);

// A entrada da tabela a que o nome do exame se refere, ou nenhuma. O nome
// casa quando:
//   1. é IGUAL (depois do `norm`) a uma das keys de uma entrada; a exata vence; ou
//   2. TODAS as suas palavras (menos as de amostra e de método) aparecem entre as palavras
//      de UMA ÚNICA entrada E o nome contém inteira, como expressão, pelo
//      menos uma key dela (" nome " inclui " key ").
//      Se mais de uma entrada qualificar, não há casamento: não dá para saber
//      de qual o laudo fala, e a faixa da entrada errada é pior que nenhuma.
//
// Foi o casamento antigo do `classifyExam` (o `findDef`, que saiu) que pegou a
// key como palavra solta dentro de qualquer nome e juntou exames diferentes:
// "VLDL-colesterol" e "Colesterol não-HDL" saíam como "colesterol total",
// "Vitamina K" como potássio (chave "k"), "Hemoglobina corpuscular média" como
// hemoglobina e "Capacidade total de ligação do ferro" como ferro. Aqui a palavra que
// diferencia o exame ("vldl", "corpuscular", "prandial", "vitamina") nunca
// está nas keys da entrada errada, então o nome não casa com ela. Já o sufixo
// redundante ("Hemoglobina glicada (HbA1c)", "Glicose (jejum)") tem só
// palavras da própria entrada, e a key inteira, e junta.
//
// A exigência da key inteira tira o nome que só tem PALAVRAS da entrada: "T4"
// é palavra da entrada do T4 livre, mas T4 sozinho pode ser o total, e
// "Jejum" é palavra da glicose sem ser exame nenhum ("Livre" e "Hormônio"
// também). Sem key inteira, a chave é o próprio nome e não há faixa.
function entradaDaTabela(nome: string): RangeDef | null {
  const n = norm(nome);
  if (!n) return null;
  const exata = TABLE.find((def) => def.keys.some((k) => norm(k) === n));
  if (exata) return exata;
  const palavras = n.split(" ").filter((p) => !PALAVRAS_DE_AMOSTRA.has(p) && !PALAVRAS_DE_METODO.has(p));
  if (palavras.length === 0) return null;
  const nomeComBordas = ` ${n} `;
  const cobrem = TABLE.filter(
    (def, i) =>
      palavras.every((p) => PALAVRAS_DAS_ENTRADAS[i].has(p)) &&
      def.keys.some((k) => nomeComBordas.includes(` ${norm(k)} `))
  );
  return cobrem.length === 1 ? cobrem[0] : null;
}

// A chave que junta as grafias do mesmo exame no comparativo do nutricionista:
// a primeira chave da entrada da tabela a que o nome se refere (`entradaDaTabela`;
// "Glicose", "Glicemia de jejum" e "glicose em jejum" são todas "glicose"). Sem
// isso o comparativo teria uma linha por grafia, cada uma com um resultado só e
// sem nada para comparar.
//
// O casamento é o estrito de `entradaDaTabela`, de propósito: com "um
// resultado por dia", colesterol total 200 (10/07) e 190 (02/10) mais
// VLDL-colesterol 24 (02/10) viravam UMA linha, "VLDL-colesterol, 24, entrou
// na faixa", e o 190 sumia. Fora da tabela vale o nome normalizado (sem
// acento, caixa nem pontuação). É o mesmo casamento da `situacaoParaANutricionista`.
export function chaveDoExame(nome: string): string {
  return entradaDaTabela(nome)?.keys[0] ?? norm(nome);
}

/** As unidades em que a faixa da entrada vale, normalizadas: a dela e as equivalentes. */
function unidadesDaEntrada(def: RangeDef): string[] {
  return [def.unit, ...(def.unidadesEquivalentes ?? [])].map(unidadeNormalizada);
}

/**
 * A faixa da entrada vale para este resultado? Só sem unidade (o laudo
 * muitas vezes omite) ou numa unidade da entrada: a B12 em pmol/L contra
 * 200–900 pg/mL, ou a glicose em mmol/L contra 70–99 mg/dL, julgava um valor
 * normal como fora da faixa.
 */
function naUnidadeDaEntrada(def: RangeDef, unidade: string | null | undefined): boolean {
  const u = unidadeNormalizada(unidade);
  return u === "" || unidadesDaEntrada(def).includes(u);
}

/**
 * A unidade de um resultado para compará-lo com outros do mesmo exame: a
 * normalizada (`unidadeNormalizada`) e, quando é uma equivalente da entrada da
 * tabela (mmol/L do potássio), a principal da entrada. Assim o potássio de 4,0
 * mEq/L e o de 5,6 mmol/L se comparam, e o cálcio nas mesmas duas unidades não.
 */
export function unidadeDoExame(nome: string, unidade: string | null | undefined): string {
  const u = unidadeNormalizada(unidade);
  const def = entradaDaTabela(nome);
  return def && def.unidadesEquivalentes && unidadesDaEntrada(def).includes(u)
    ? unidadeNormalizada(def.unit)
    : u;
}

// A faixa de referência da tabela do app para o exame, pelo mesmo casamento de
// `chaveDoExame` (nome com uma palavra que a entrada não tem não leva a faixa
// dela), com a unidade em que a entrada está e a situação do `valor` nela (os
// três níveis da entrada: é o selo do comparativo). Só quando a `unidade` do
// resultado é vazia ou da entrada (`naUnidadeDaEntrada`). Exame que depende do
// sexo, sem o sexo, fica sem faixa: não chutamos.
export function faixaDaTabela(
  nome: string,
  valor: number,
  ctx: ExamContext,
  unidade: string | null = null
): { faixa: string; unidade: string; situacao: ExamLevel } | null {
  const def = entradaDaTabela(nome);
  if (!def || (def.sexDependent && !ctx.sex) || !naUnidadeDaEntrada(def, unidade)) return null;
  const r = def.classify(valor, ctx);
  return { faixa: r.faixa, unidade: def.unit, situacao: r.status };
}

