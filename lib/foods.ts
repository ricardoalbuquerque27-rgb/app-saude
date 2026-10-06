import taco from "@/lib/data/taco.json";

// Busca de alimentos sobre a TACO — Tabela Brasileira de Composição de
// Alimentos, 4ª edição (NEPA/UNICAMP, 2011). 591 alimentos com valores por
// 100 g. A tabela é de domínio público e é a referência usada por
// nutricionistas no Brasil; por isso ela, e não uma base americana.
//
// O arquivo fica enxuto de propósito (82 KB): só os campos que o app usa, e
// com uma coluna "b" já sem acento, para a busca não precisar normalizar 591
// registros a cada tecla.

export type Alimento = {
  /** id na TACO */
  i: number;
  /** nome */
  n: string;
  /** categoria */
  c: string;
  /** nome normalizado (sem acento, minúsculo) — uso interno da busca */
  b: string;
  /** kcal por 100 g */
  k: number;
  /** proteína (g) por 100 g */
  p: number;
  /** carboidrato (g) por 100 g */
  ch: number;
  /** gordura (g) por 100 g */
  g: number;
  /** fibra (g) por 100 g */
  f: number;
};

const ALIMENTOS = taco as Alimento[];

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Busca por termos. Todos os termos precisam aparecer no nome — assim
 * "frango grelhado" não devolve todo frango da tabela. A ordenação favorece
 * quem começa com o termo, que é quase sempre o que a pessoa quer
 * ("arroz" → "Arroz, integral, cozido" antes de "Bolo de arroz").
 */
export function buscarAlimentos(consulta: string, limite = 20): Alimento[] {
  const termos = normalizar(consulta).split(/\s+/).filter((t) => t.length >= 2);
  if (termos.length === 0) return [];

  const achados: { a: Alimento; peso: number }[] = [];
  for (const a of ALIMENTOS) {
    if (!termos.every((t) => a.b.includes(t))) continue;
    let peso = 0;
    if (a.b.startsWith(termos[0])) peso += 100;

    // Quem registra refeição come comida PRONTA. Sem isto, "feijao" trazia
    // os crus no topo (nomes mais curtos) e o feijão cozido — o alimento
    // mais comum da mesa brasileira — ficava fora dos primeiros.
    // Premiamos o preparado, mas NÃO punimos o cru: fruta se come crua, e
    // punir derrubava "Banana, crua" abaixo de "Banana, doce em barra".
    if (/\b(cozido|cozida|grelhado|grelhada|assado|assada|refogado|refogada)\b/.test(a.b))
      peso += 40;

    peso -= a.n.length / 10; // nomes curtos costumam ser o alimento "puro"
    achados.push({ a, peso });
  }

  achados.sort((x, y) => y.peso - x.peso);
  return achados.slice(0, limite).map((x) => x.a);
}

/** Macros de uma porção em gramas, a partir dos valores por 100 g. */
export function porcao(a: Alimento, gramas: number) {
  const f = gramas / 100;
  return {
    calories: Math.round(a.k * f),
    protein_g: Math.round(a.p * f * 10) / 10,
    carbs_g: Math.round(a.ch * f * 10) / 10,
    fat_g: Math.round(a.g * f * 10) / 10,
    fiber_g: Math.round(a.f * f * 10) / 10,
  };
}

/** Rótulo curto para exibir junto do item escolhido. */
export function rotuloPorcao(a: Alimento, gramas: number): string {
  const m = porcao(a, gramas);
  return `${gramas} g · ${m.calories} kcal · ${m.protein_g} g prot`;
}
