import { addDaysISO, dataNoBrasil, limitesDaJanela, weekStartISO } from "@/lib/date";
import { pesoDoDia } from "@/lib/nutri";

/**
 * A conta dos gráficos da aba Corpo do nutricionista: a média semanal do
 * peso, os pontos da consulta, a escala e as frases de acessibilidade.
 * Tudo puro e sem banco, para ter teste. Só `descricaoDoPeso` e
 * `descricaoDaMedida` formatam número (em pt-BR); o resto devolve número.
 */

/** Uma linha de `body_measurements`, como a leitura da aba a traz. */
export type LinhaDoCorpo = {
  date: string;
  weight_kg: number | string | null;
  waist_cm: number | string | null;
  body_fat_pct: number | string | null;
  /** Quem mediu; nulo é o paciente, em casa. Preenchido é a medida da consulta. */
  measured_by: string | null;
  created_at: string | null;
};

/**
 * O número de um campo que vem do banco. O `numeric` do PostgREST chega como
 * texto ("70.3"), e somar texto concatenava; nulo e texto vazio são "sem
 * medida", nunca zero (`Number("")` é 0 e puxaria a média para baixo).
 */
function numero(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Uma casa decimal, como número. Sem isso a média de 70,1 / 70,3 / 70,2 / 70,2
 * sai 70.19999999999999 e a diferença 70,1 - 74,4 sai -4.300000000000011. O
 * `+ 0` troca o -0 (de -0,04 arredondado) por 0: `toEqual` distingue os dois.
 */
function umaCasa(n: number): number {
  return Number(n.toFixed(1)) + 0;
}

/** "70,1" / "66": vírgula, sem zero sobrando. */
function br(n: number): string {
  return String(umaCasa(n)).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

/**
 * O primeiro dia do gráfico: o dia (em São Paulo) em que o acompanhamento
 * começou, e nunca antes dos 12 meses que a leitura traz.
 *
 * `dataNoBrasil`, e não `accepted_at.slice(0, 10)`: o instante vem em UTC, e
 * quem aceitou às 22h30 de 12/05 em São Paulo teria o início em 13/05 e a
 * primeira pesagem fora do período. Vínculo "do futuro" (relógio torto) vale
 * hoje, para o período não ficar invertido e a leitura trazer zero linhas.
 */
export function inicioDoPeriodo(
  vinculo: { accepted_at: string | null; created_at: string },
  hoje: string
): string {
  const comeco = dataNoBrasil(vinculo.accepted_at ?? vinculo.created_at);
  const piso = limitesDaJanela(hoje, 365).desde;
  if (comeco > hoje) return hoje;
  return comeco < piso ? piso : comeco;
}

// ---------------------------------------------------------------------------
// Peso: média semanal e pontos da consulta
// ---------------------------------------------------------------------------

export type SemanaDePeso = {
  /** Segunda-feira, salvo na primeira semana do período, que começa em `desde`. */
  inicio: string;
  /** Domingo, salvo na semana de `ate`, que termina em `ate`. */
  fim: string;
  /** Média dos dias com pesagem de casa, 1 casa; nula na semana sem pesagem. */
  media: number | null;
  /** Quantos dias da semana têm pesagem de casa. */
  dias: number;
  menor: number | null;
  maior: number | null;
  /** A semana de `ate` (hoje): entra com o que tiver. */
  emCurso: boolean;
};

/**
 * Uma semana (segunda a domingo) por linha do período, em ordem, só com as
 * pesagens de casa (`measured_by` nulo).
 *
 * Um valor por dia antes da média, o da pesagem mais recente (`created_at`,
 * pela mesma regra de `pesoDoDia`): sem isso, um dia com três pesagens pesaria
 * três vezes na semana. A medida da consulta fica de fora (é ponto à parte,
 * `pontosDaConsulta`), e no dia com as duas a de casa conta aqui.
 *
 * As pontas da semana acompanham o período: a primeira começa em `desde` e a
 * que contém `ate` termina em `ate`. Assim a dica e a frase do gráfico não
 * citam dia anterior ao acompanhamento nem dia que ainda não veio. `ate` é
 * hoje; linha fora de [desde, ate] fica de fora, a com data futura inclusive
 * (sem teto, o registro lançado para amanhã entrava na média).
 *
 * Semana sem pesagem volta com `media: null` e não é pulada: o gráfico para
 * a linha ali, em vez de ligar as duas pontas e inventar um valor.
 */
export function semanasDePeso(
  linhas: LinhaDoCorpo[],
  desde: string,
  ate: string
): SemanaDePeso[] {
  if (desde > ate) return [];

  const porDia = new Map<string, { weight_kg: number; created_at: string | null }[]>();
  for (const l of linhas) {
    if (l.measured_by != null) continue;
    if (l.date < desde || l.date > ate) continue;
    const peso = numero(l.weight_kg);
    if (peso == null) continue;
    const doDia = porDia.get(l.date) ?? [];
    doDia.push({ weight_kg: peso, created_at: l.created_at });
    porDia.set(l.date, doDia);
  }

  const porSemana = new Map<string, number[]>();
  // forEach: o tsconfig do app não itera Map com for...of (sem target es2015).
  porDia.forEach((doDia, dia) => {
    const peso = pesoDoDia(doDia);
    if (peso == null) return;
    const segunda = weekStartISO(dia);
    porSemana.set(segunda, [...(porSemana.get(segunda) ?? []), peso]);
  });

  const semanas: SemanaDePeso[] = [];
  const ultimaSegunda = weekStartISO(ate);
  for (let segunda = weekStartISO(desde); segunda <= ultimaSegunda; segunda = addDaysISO(segunda, 7)) {
    const pesos = porSemana.get(segunda) ?? [];
    const domingo = addDaysISO(segunda, 6);
    semanas.push({
      inicio: segunda < desde ? desde : segunda,
      fim: domingo > ate ? ate : domingo,
      media: pesos.length ? umaCasa(pesos.reduce((s, p) => s + p, 0) / pesos.length) : null,
      dias: pesos.length,
      menor: pesos.length ? Math.min(...pesos) : null,
      maior: pesos.length ? Math.max(...pesos) : null,
      emCurso: segunda === ultimaSegunda,
    });
  }
  return semanas;
}

export type PontoDeConsulta = { data: string; valor: number };

/** Mais antigo primeiro; no mesmo dia, pelo `created_at`. */
function porDataECriacao(a: LinhaDoCorpo, b: LinhaDoCorpo): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

/** As medidas tiradas na consulta (`measured_by` preenchido) que têm o campo. */
export function pontosDaConsulta(
  linhas: LinhaDoCorpo[],
  campo: "weight_kg" | "waist_cm" | "body_fat_pct"
): PontoDeConsulta[] {
  const pontos: PontoDeConsulta[] = [];
  for (const l of [...linhas].sort(porDataECriacao)) {
    if (l.measured_by == null) continue;
    const valor = numero(l[campo]);
    if (valor != null) pontos.push({ data: l.date, valor });
  }
  return pontos;
}

export type PontoDeMedida = { data: string; valor: number; daConsulta: boolean };

/**
 * Cintura ou % de gordura: um ponto por linha com valor, de casa e da
 * consulta, em ordem de data. No mesmo dia as duas aparecem (cheio para a da
 * consulta, vazado para a de casa): escolher uma esconderia a outra.
 */
export function serieDeMedida(
  linhas: LinhaDoCorpo[],
  campo: "waist_cm" | "body_fat_pct"
): PontoDeMedida[] {
  const pontos: PontoDeMedida[] = [];
  for (const l of [...linhas].sort(porDataECriacao)) {
    const valor = numero(l[campo]);
    if (valor != null) pontos.push({ data: l.date, valor, daConsulta: l.measured_by != null });
  }
  return pontos;
}

export type TituloDoPeso = {
  rotulo: "média da semana" | "última medida";
  valor: number;
  /** Último contra o primeiro; nulo quando só há um para comparar. */
  variacao: number | null;
  /** O início do que se compara: o `inicio` da 1ª semana com média, ou a data da 1ª consulta. */
  desde: string | null;
};

/**
 * O título do gráfico de peso: a média da última semana contra a da primeira
 * ("desde a 1ª semana"). Sem nenhuma semana com média (paciente que só tem
 * medida da consulta), a última medida da consulta contra a primeira, e o
 * rótulo muda: chamar de "média da semana" um ponto de consulta mentiria.
 * `consulta` vem de `pontosDaConsulta`, em ordem de data.
 */
export function tituloDoPeso(
  semanas: SemanaDePeso[],
  consulta: PontoDeConsulta[]
): TituloDoPeso | null {
  const comMedia = semanas.filter((s) => s.media != null);
  if (comMedia.length) {
    const primeira = comMedia[0];
    const ultima = comMedia[comMedia.length - 1];
    return {
      rotulo: "média da semana",
      valor: ultima.media!,
      variacao: comMedia.length > 1 ? umaCasa(ultima.media! - primeira.media!) : null,
      desde: primeira.inicio,
    };
  }
  if (consulta.length) {
    const primeiro = consulta[0];
    const ultimo = consulta[consulta.length - 1];
    return {
      rotulo: "última medida",
      valor: ultimo.valor,
      variacao: consulta.length > 1 ? umaCasa(ultimo.valor - primeiro.valor) : null,
      desde: primeiro.data,
    };
  }
  return null;
}

/** Tendência precisa de dois pontos: 2+ semanas com média ou 2+ medidas da consulta. */
export function temGraficoDePeso(
  semanas: SemanaDePeso[],
  consulta: PontoDeConsulta[]
): boolean {
  return semanas.filter((s) => s.media != null).length >= 2 || consulta.length >= 2;
}

// ---------------------------------------------------------------------------
// Escala
// ---------------------------------------------------------------------------

/**
 * Os limites do eixo do peso: o kg inteiro abaixo do menor e acima do maior,
 * com 0,5 kg de folga para o ponto não encostar na borda.
 *
 * A meta só entra na escala a até 5 kg do menor ou do maior valor. Com a meta
 * 30 kg abaixo, ela achataria a linha do peso numa faixa fina; fora da escala,
 * o gráfico a mostra como "meta N kg ↓" (ou ↑, por `metaAcima`) no canto.
 */
export function escalaDoPeso(
  valores: number[],
  meta: number | null
): { min: number; max: number; metaNaEscala: boolean; metaAcima: boolean } {
  const dados = valores.filter((v) => Number.isFinite(v));
  // Sem dado não há gráfico; isto só evita um eixo de Infinity.
  if (!dados.length) return { min: 0, max: 1, metaNaEscala: false, metaAcima: false };

  const menor = Math.min(...dados);
  const maior = Math.max(...dados);
  // `umaCasa`: 70,1 - 5 tem de dar 65,1 para a meta 65,1 entrar.
  const metaNaEscala = meta != null && meta >= umaCasa(menor - 5) && meta <= umaCasa(maior + 5);
  return {
    min: Math.floor(Math.min(menor, metaNaEscala ? meta : menor) - 0.5),
    max: Math.ceil(Math.max(maior, metaNaEscala ? meta : maior) + 0.5),
    metaNaEscala,
    metaAcima: meta != null && meta > maior,
  };
}

// ---------------------------------------------------------------------------
// Frases do aria-label
// ---------------------------------------------------------------------------

/** "13/10", ou "13/10/2026" quando o período atravessa o ano. */
function diaMes(iso: string, comAno: boolean): string {
  const [a, m, d] = iso.split("-");
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`;
}

const POR_EXTENSO = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

/**
 * O que o gráfico de peso mostra, em uma frase para o `aria-label` (o
 * gráfico é SVG; a tabela de medidas é a versão em texto). Ex.: "Peso de
 * 12/05 a 13/10: média da semana caiu de 74,4 para 70,1 kg; seis consultas,
 * a última com 70,3 kg; meta 66 kg."
 *
 * O período vai da primeira à última data que o gráfico desenha (semanas com
 * média e consultas). Com o ano nas duas pontas quando atravessa um ano, para
 * "de 15/10 a 14/10" não confundir quem só ouve.
 */
export function descricaoDoPeso(
  semanas: SemanaDePeso[],
  consulta: PontoDeConsulta[],
  meta: number | null
): string {
  const comMedia = semanas.filter((s) => s.media != null);
  const partes: string[] = [];

  if (comMedia.length === 1) {
    partes.push(`média da semana de ${br(comMedia[0].media!)} kg`);
  } else if (comMedia.length > 1) {
    const de = comMedia[0].media!;
    const para = comMedia[comMedia.length - 1].media!;
    partes.push(
      de === para
        ? `média da semana ficou em ${br(para)} kg`
        : `média da semana ${para < de ? "caiu" : "subiu"} de ${br(de)} para ${br(para)} kg`
    );
  }

  if (consulta.length === 1) {
    partes.push(`uma consulta, com ${br(consulta[0].valor)} kg`);
  } else if (consulta.length > 1) {
    const n = consulta.length;
    partes.push(
      `${POR_EXTENSO[n] || n} consultas, a última com ${br(consulta[n - 1].valor)} kg`
    );
  }

  const datas = [
    ...(comMedia.length ? [comMedia[0].inicio, comMedia[comMedia.length - 1].fim] : []),
    ...(consulta.length ? [consulta[0].data, consulta[consulta.length - 1].data] : []),
  ].sort();

  const metaTexto = meta != null ? `meta ${br(meta)} kg` : null;
  if (!datas.length) {
    return `Peso: sem medidas no período${metaTexto ? `; ${metaTexto}` : ""}.`;
  }

  if (metaTexto) partes.push(metaTexto);
  const primeira = datas[0];
  const ultima = datas[datas.length - 1];
  const comAno = primeira.slice(0, 4) !== ultima.slice(0, 4);
  const periodo =
    primeira === ultima
      ? `em ${diaMes(primeira, comAno)}`
      : `de ${diaMes(primeira, comAno)} a ${diaMes(ultima, comAno)}`;
  return `Peso ${periodo}: ${partes.join("; ")}.`;
}

/**
 * O mesmo para cintura e % de gordura. Ex.: "Cintura medida 6 vezes, de 92
 * para 85 cm." `pontos` vem de `serieDeMedida`, em ordem de data.
 */
export function descricaoDaMedida(
  nome: string,
  unidade: string,
  pontos: PontoDeMedida[]
): string {
  if (!pontos.length) return `${nome} sem medidas.`;
  const primeiro = pontos[0].valor;
  const ultimo = pontos[pontos.length - 1].valor;
  if (pontos.length === 1) return `${nome} medida 1 vez, ${br(ultimo)} ${unidade}.`;
  const vezes = `${nome} medida ${pontos.length} vezes`;
  return primeiro === ultimo
    ? `${vezes}, a primeira e a última com ${br(ultimo)} ${unidade}.`
    : `${vezes}, de ${br(primeiro)} para ${br(ultimo)} ${unidade}.`;
}
