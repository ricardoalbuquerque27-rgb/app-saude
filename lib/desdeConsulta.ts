import { addDaysISO, dataNoBrasil, diasNaJanela, naJanela } from "@/lib/date";
import { computeAdherence, type Completion } from "@/lib/planCheckIn";
import { textoVariacaoPeso } from "@/lib/nutri";
import { dataCurta } from "@/lib/consultas";

// "Desde a última consulta": o que o paciente fez do dia seguinte à última
// consulta realizada até hoje. É a linha que o nutricionista lê antes de
// atender (spec de consultas, "Desde a última consulta").
//
// Fica fora de lib/consultas.ts para aquele módulo não importar lib/nutri.ts,
// que importa ele (os alertas de consulta da fila).

/** Passando disso, olha só os últimos 90 dias: a consulta traz no máximo isso. */
export const MAX_DIAS_DESDE = 90;

export type DadosDesde = {
  /** O dia (São Paulo) da última consulta realizada. */
  desde: string;
  hoje: string;
  /** Datas de qualquer registro (refeição, treino, diário, medida), em qualquer ordem. */
  diasComRegistro: string[];
  /** Medidas com peso, em qualquer ordem, inclusive de antes da consulta. */
  pesos: { date: string; weight_kg: number | string }[];
  plano: { id: string; day_of_week: number; sport?: string | null }[];
  checks: Completion[];
  /** Avisos de mudança na prescrição (prescription_deviations). */
  desvios: { created_at: string }[];
};

export type ResumoDesde = {
  desde: string;
  /** Dias depois da consulta até hoje. */
  dias: number;
  /** Os dias olhados: `dias`, ou 90 se passou disso. */
  janela: number;
  limitado: boolean;
  diasComRegistro: number;
  deltaPeso: number | null;
  treinos: { confirmadas: number; previstas: number } | null;
  mudancas: number;
};

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);
}

export function resumoDesdeUltima(d: DadosDesde): ResumoDesde | null {
  const dias = diasEntre(d.desde, d.hoje);
  // Consulta de hoje (ou datada no futuro): ainda não há "desde".
  if (dias <= 0) return null;
  const janela = Math.min(dias, MAX_DIAS_DESDE);
  const inicio = addDaysISO(d.hoje, -(janela - 1));

  const pesos = [...d.pesos]
    .map((p) => ({ date: p.date, kg: Number(p.weight_kg) }))
    .filter((p) => Number.isFinite(p.kg))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // A base é a última medida antes da janela: com a janela inteira, a de até
  // o dia da consulta; limitada a 90 dias, a de antes desses 90.
  const base = pesos.filter((p) => p.date < inicio).pop();
  const atual = pesos.filter((p) => naJanela(p.date, d.hoje, janela)).pop();
  const deltaPeso =
    base && atual ? Math.round((atual.kg - base.kg) * 10) / 10 : null;

  const datas = Array.from({ length: janela }, (_, i) => addDaysISO(inicio, i));
  const adesao = computeAdherence(
    d.plano.filter((p) => !String(p.sport ?? "").toLowerCase().includes("descanso")),
    d.checks,
    datas,
    d.hoje
  );

  return {
    desde: d.desde,
    dias,
    janela,
    limitado: dias > MAX_DIAS_DESDE,
    diasComRegistro: diasNaJanela(d.diasComRegistro, d.hoje, janela),
    deltaPeso,
    treinos: adesao.previstas > 0 ? { confirmadas: adesao.confirmadas, previstas: adesao.previstas } : null,
    mudancas: d.desvios.filter((x) => naJanela(dataNoBrasil(x.created_at), d.hoje, janela)).length,
  };
}

export function tituloDesde(r: ResumoDesde): string {
  return r.limitado
    ? `Nos últimos ${MAX_DIAS_DESDE} dias (última consulta em ${dataCurta(r.desde)})`
    : `Desde a última consulta (${dataCurta(r.desde)})`;
}

export function textoDesdeUltima(r: ResumoDesde): string {
  const partes: string[] = [];
  partes.push(
    r.diasComRegistro === 0
      ? r.limitado
        ? `Nenhum registro nos últimos ${MAX_DIAS_DESDE} dias`
        : "Nenhum registro desde então"
      : `${r.diasComRegistro} de ${r.janela} dias com registro`
  );
  if (r.deltaPeso != null) partes.push(textoVariacaoPeso(r.deltaPeso));
  if (r.treinos) partes.push(`treinos ${r.treinos.confirmadas} de ${r.treinos.previstas}`);
  if (r.mudancas > 0)
    partes.push(`${r.mudancas} ${r.mudancas === 1 ? "mudança" : "mudanças"} na prescrição`);
  return partes.join(" · ");
}
