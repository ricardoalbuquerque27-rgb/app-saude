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
// Meta de peso
// ---------------------------------------------------------------------------

/**
 * O peso de onde o paciente partiu: o do primeiro dia com peso a partir de
 * `desde`, pela regra de `pesoDoDia` (no dia com as duas medidas, a da
 * consulta). As duas pontas do anel (inicial e atual) usam a mesma regra, para
 * "4,3 de 8,6 kg" bater com o Peso atual ao lado.
 *
 * Não há teto de data aqui: a leitura do corpo já traz só até hoje.
 */
export function pesoInicialDoPeriodo(
  linhas: LinhaDoCorpo[],
  desde: string
): { valor: number; data: string } | null {
  const comPeso = linhas.flatMap((l) => {
    const peso = numero(l.weight_kg);
    return peso == null || l.date < desde
      ? []
      : [{ date: l.date, weight_kg: peso, measured_by: l.measured_by, created_at: l.created_at }];
  });
  if (!comPeso.length) return null;
  const data = comPeso.reduce((menor, l) => (l.date < menor ? l.date : menor), comPeso[0].date);
  const valor = pesoDoDia(comPeso.filter((l) => l.date === data));
  return valor == null ? null : { valor, data };
}

/**
 * Onde o paciente está no caminho do peso inicial até a meta. A direção sai
 * da própria meta (abaixo do inicial é perder, acima é ganhar) e a conta é a
 * mesma nos dois sentidos.
 *
 * - `progresso`: `feito` de `total` kg e a `fracao` (0 a 1) para o arco.
 * - `atingida`: chegou à meta ou passou (no sentido certo), ou está a menos de
 *   0,05 kg dela. `passou` só vem quando passou mais de 0,5 kg; abaixo disso
 *   está dentro da oscilação da balança e "passou 0,3 kg" seria ruído. Quem
 *   está a 200 g da meta ainda é `progresso` (98%): "meta atingida" é para
 *   quem chegou.
 * - `lado-errado`: foi para o lado oposto da meta; `diferenca` é o atual menos
 *   o inicial (+1,2 querendo perder, -1 querendo ganhar), com o anel vazio.
 * - nulo: sem meta, sem peso inicial ou atual, ou meta igual ao inicial (a 1
 *   casa, a que o app mostra): não há caminho a percorrer, e dividir por ele
 *   daria 0/0.
 */
export type ProgressoDaMeta =
  | { tipo: "progresso"; fracao: number; feito: number; total: number }
  | { tipo: "atingida"; passou: number | null }
  | { tipo: "lado-errado"; diferenca: number }
  | null;

export function progressoDaMeta(
  inicial: number | null,
  atual: number | null,
  meta: number | null
): ProgressoDaMeta {
  if (inicial == null || atual == null || meta == null) return null;

  const total = Math.abs(inicial - meta);
  if (umaCasa(total) === 0) return null;

  const perder = meta < inicial;
  const feito = perder ? inicial - atual : atual - inicial;
  // Positivo: já passou da meta (no sentido certo); negativo: falta chegar.
  const alemDaMeta = perder ? meta - atual : atual - meta;

  if (alemDaMeta >= 0 || Math.abs(atual - meta) < 0.05) {
    // Arredonda antes de comparar: 70,1 - 69,6 dá 0.5000000000000071 e
    // viraria "passou da meta em 0,5 kg" por resto de ponto flutuante.
    const passou = umaCasa(alemDaMeta);
    return { tipo: "atingida", passou: passou > 0.5 ? passou : null };
  }
  if (feito < 0) return { tipo: "lado-errado", diferenca: umaCasa(atual - inicial) };

  // A fração sai dos mesmos números que a tela mostra ("4,3 de 8,6"), e o
  // 50% do texto bate com o arco.
  const feitoMostrado = umaCasa(feito);
  const totalMostrado = umaCasa(total);
  return {
    tipo: "progresso",
    fracao: feitoMostrado / totalMostrado,
    feito: feitoMostrado,
    total: totalMostrado,
  };
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
// Variação da cintura e do % de gordura
// ---------------------------------------------------------------------------

/**
 * Quanto a cintura (ou o % de gordura) mudou: o último ponto menos o primeiro
 * do período, em 1 casa. `pontos` vem de `serieDeMedida`, em ordem de data.
 * Nulo com menos de 2 pontos: não há com o que comparar.
 *
 * Em 1 casa aqui, e não no componente: 30,4 - 34,0 dá -3.5999999999999943, e
 * o título "−3,6 pontos" saía com o resto de ponto flutuante.
 */
export function variacaoDaMedida(pontos: PontoDeMedida[]): number | null {
  if (pontos.length < 2) return null;
  return umaCasa(pontos[pontos.length - 1].valor - pontos[0].valor);
}

// ---------------------------------------------------------------------------
// Eixos dos gráficos
// ---------------------------------------------------------------------------

/**
 * Quantos dias de `de` até `ate` (YYYY-MM-DD), negativo se `ate` vem antes.
 *
 * Em UTC (`Date.UTC`) e não em hora local: dois dias em hora local diferem em
 * 23 ou 25 horas na virada do horário de verão, e dividir por 24 h dava 0,96
 * ou 1,04. É a posição de cada ponto no eixo X, que conta dias desde o início.
 */
export function diasEntre(de: string, ate: string): number {
  const ms = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(ate) - ms(de)) / 86_400_000);
}

const MESES_ABREVIADOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * As marcas do eixo X: o dia 1 de cada mês dentro de [desde, ate], na posição
 * em dias desde `desde`. O janeiro leva o ano ("jan/27") quando o período
 * atravessa um ano: sem ele, "dez jan fev" não diz de que janeiro se trata.
 */
export function marcasDeMes(desde: string, ate: string): { dia: number; rotulo: string }[] {
  if (desde > ate) return [];
  const viraOAno = desde.slice(0, 4) !== ate.slice(0, 4);
  const marcas: { dia: number; rotulo: string }[] = [];
  let [ano, mes] = desde.split("-").map(Number);
  // Começa no mês de `desde`: o dia 1 dele só entra se `desde` for o dia 1.
  for (;;) {
    const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
    if (primeiro > ate) break;
    if (primeiro >= desde) {
      const nome = MESES_ABREVIADOS[mes - 1];
      marcas.push({
        dia: diasEntre(desde, primeiro),
        rotulo: viraOAno && mes === 1 ? `${nome}/${String(ano).slice(2)}` : nome,
      });
    }
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return marcas;
}

/**
 * As marcas do eixo Y do peso: inteiros, de 1, 2, 5, 10, 20 ou 50 em 50, o
 * menor passo que dá `alvo` marcas ou menos dentro de [min, max]. No celular o
 * alvo é 3: com mais, os números se atropelam. Sempre pelo menos duas.
 */
export function marcasDoEixo(min: number, max: number, alvo: number): number[] {
  for (const passo of [1, 2, 5, 10, 20, 50]) {
    const primeira = Math.ceil(min / passo);
    const ultima = Math.floor(max / passo);
    if (ultima - primeira + 1 > alvo) continue;
    const marcas: number[] = [];
    for (let i = primeira; i <= ultima; i++) marcas.push(i * passo);
    if (marcas.length >= 2) return marcas;
  }
  return [min, max];
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
