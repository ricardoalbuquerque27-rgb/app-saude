"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoDoPonteiro, type ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";
import {
  diasEntre,
  marcasDeMes,
  marcasDoEixo,
  type escalaDoPeso,
  type PontoDeConsulta,
  type SemanaDePeso,
  type TituloDoPeso,
} from "@/lib/evolucao";

// O gráfico do peso da aba Corpo (média semanal, pontos da consulta, meta) e
// as peças que o GraficoMedida reaproveita: medir a largura, a geometria, a
// dica e as marcas do eixo X.
//
// Só variáveis do tema clínico (`var(--clin-*)`): o escuro funciona sem uma
// segunda lista de cores, e os pares têm contraste testado em
// lib/temaClinico.ts (PARES_GRAFICO). Cor nunca é a única diferença: casa é
// linha, consulta é ponto cheio, meta é traço.
//
// A dica (hover no computador, toque no celular) é própria, e não o Tooltip do
// recharts. O eixo X conta dias desde o início do acompanhamento, e a semana
// do tooltip do recharts é a do ponto mais PERTO, que nas pontas, onde a
// semana é cortada pelo período, não é a semana do dia sob o cursor. Aqui o
// dia sai da posição do ponteiro (a mesma geometria que o gráfico usa) e a
// semana é a que contém o dia.

export const COR = {
  texto: "var(--clin-texto)",
  texto2: "var(--clin-texto-2)",
  chao: "var(--clin-chao)",
  linha: "var(--clin-linha)",
  campo: "var(--clin-campo)",
  primaria: "var(--clin-primaria)",
  fundoDaPrimaria: "var(--clin-primaria-fundo)",
};

export const TICK = { fontSize: 11, fill: COR.texto2 };

export const MARGEM = { top: 12, right: 10, bottom: 0, left: 0 };
export const LARGURA_Y = 34;
export const ALTURA_X = 24;
/** Folga do eixo X, em px, nas duas pontas: o ponto do dia 0 não encosta nos números do eixo Y. */
export const FOLGA = 10;
/** Abaixo disto o gráfico é de celular: menos marcas, menos altura. */
export const LARGURA_COMPACTA = 520;

/** Onde o gráfico desenha, em px dentro da caixa: o recharts usa a mesma conta. */
export function geometria(largura: number, altura: number) {
  return {
    esq: MARGEM.left + LARGURA_Y + FOLGA,
    dir: largura - MARGEM.right - FOLGA,
    topo: MARGEM.top,
    base: altura - MARGEM.bottom - ALTURA_X,
  };
}

/** "70,3": vírgula, no máximo uma casa. */
export const numeroBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "+1,2" ou "−4,3" (menos de verdade, U+2212). */
export const comSinal = (n: number) => `${n < 0 ? "−" : "+"}${numeroBR(Math.abs(n))}`;

/** "13/10" de "2026-10-13". */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Marcas do eixo X: o dia 1 de cada mês. Com menos de duas (período curto), as
 * duas pontas em dd/mm: um eixo sem rótulo não diz de quando é o gráfico.
 */
export function marcasDoEixoX(inicio: string, fim: string, total: number): { dia: number; rotulo: string }[] {
  const meses = marcasDeMes(inicio, fim);
  return meses.length >= 2
    ? meses
    : [
        { dia: 0, rotulo: ddmm(inicio) },
        { dia: total, rotulo: ddmm(fim) },
      ];
}

/**
 * A caixa do gráfico: mede a largura (o recharts desenha em px) e guarda onde
 * o ponteiro está, em dias. Mouse: segue o cursor e some ao sair. Toque: um
 * toque mostra a dica e ela fica até outro toque fora do gráfico (o dedo
 * levantado dispara `pointerleave`, e apagar ali tiraria a dica na hora).
 * `touch-action: pan-y` deixa a página rolar na vertical e arrastar na
 * horizontal passa o dedo pelas semanas.
 */
export function useGrafico(total: number, alturaDe: (compacto: boolean) => number) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [ponteiro, setPonteiro] = useState<{ dia: number; x: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.floor(el.getBoundingClientRect().width));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const aberta = ponteiro !== null;
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPonteiro(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  const compacto = largura > 0 && largura < LARGURA_COMPACTA;
  const altura = alturaDe(compacto);
  const g = geometria(largura, altura);

  function ler(e: EventoDoPonteiro<HTMLDivElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - caixa.left;
    const y = e.clientY - caixa.top;
    if (x < g.esq - FOLGA || x > g.dir + FOLGA || y < 0 || y > g.base) return null;
    const dia = Math.round(((x - g.esq) / (g.dir - g.esq)) * total);
    return { dia: Math.min(total, Math.max(0, dia)), x };
  }
  const aoPonteiro = (e: EventoDoPonteiro<HTMLDivElement>) => {
    const p = ler(e);
    if (p) setPonteiro(p);
    else if (e.pointerType === "mouse") setPonteiro(null);
  };
  const aoSair = (e: EventoDoPonteiro<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setPonteiro(null);
  };

  return {
    ref,
    largura,
    altura,
    compacto,
    g,
    ponteiro,
    /** x de um dia, em px dentro da caixa. */
    xDe: (dia: number) => g.esq + (dia / total) * (g.dir - g.esq),
    eventos: { onPointerMove: aoPonteiro, onPointerDown: aoPonteiro, onPointerLeave: aoSair },
  };
}

const LARGURA_DA_DICA = 224;

/** A caixa da dica, ao lado do ponteiro e sempre dentro do gráfico. */
export function CaixaDaDica({ x, largura, children }: { x: number; largura: number; children: ReactNode }) {
  let esquerda = x + 16;
  if (esquerda + LARGURA_DA_DICA > largura) esquerda = x - 16 - LARGURA_DA_DICA;
  esquerda = Math.max(0, Math.min(esquerda, largura - LARGURA_DA_DICA));
  return (
    <div
      role="tooltip"
      style={{ left: esquerda, top: 4, width: LARGURA_DA_DICA }}
      className="pointer-events-none absolute z-10 rounded-md border border-clin-linha bg-clin-chao px-3 py-2 text-[13px] leading-snug tabular-nums text-clin-texto shadow-md"
    >
      {children}
    </div>
  );
}

function Amostra({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="20" height="12" viewBox="0 0 20 12" className="shrink-0">
      {children}
    </svg>
  );
}

/** Texto pequeno sobre o gráfico, com um halo do fundo: legível por cima da linha. */
const SOBRE_O_GRAFICO =
  "pointer-events-none absolute whitespace-nowrap text-[11px] font-medium leading-none text-clin-texto-2 [text-shadow:0_0_3px_var(--clin-chao),0_0_3px_var(--clin-chao),0_0_3px_var(--clin-chao)]";

export function GraficoPeso({
  inicio,
  semanas,
  pontosDaConsulta,
  datasDasConsultas,
  meta,
  escala,
  titulo,
  descricao,
}: {
  inicio: string;
  semanas: SemanaDePeso[];
  pontosDaConsulta: PontoDeConsulta[];
  datasDasConsultas: string[];
  meta: number | null;
  escala: ReturnType<typeof escalaDoPeso>;
  titulo: TituloDoPeso;
  descricao: string;
}) {
  const fim = semanas.length ? semanas[semanas.length - 1].fim : inicio;
  const total = Math.max(1, diasEntre(inicio, fim));
  const { ref, largura, altura, compacto, g, ponteiro, xDe, eventos } = useGrafico(total, (c) => (c ? 230 : 280));

  // Cada semana na posição do seu meio, em dias desde o início. As pontas vêm
  // cortadas pelo período (a 1ª começa em `inicio`, a última acaba hoje): o
  // meio é o do trecho que existe, e não o de uma segunda a domingo inteira.
  const faixas = semanas.map((s) => ({ s, x0: diasEntre(inicio, s.inicio), x1: diasEntre(inicio, s.fim) }));
  const linha = faixas.map((f) => ({ dia: (f.x0 + f.x1) / 2, media: f.s.media }));
  const consultas = pontosDaConsulta.map((p) => ({ dia: diasEntre(inicio, p.data), valor: p.valor, data: p.data }));
  const diasDeConsulta = Array.from(new Set(datasDasConsultas.map((d) => diasEntre(inicio, d)))).filter(
    (d) => d >= 0 && d <= total
  );

  // Trechos sem pesagem: a linha para neles. Cada trecho seguido de semanas
  // vazias ganha um "sem pesagem".
  const lacunas: { x0: number; x1: number }[] = [];
  faixas.forEach((f) => {
    if (f.s.media != null) return;
    const ultima = lacunas[lacunas.length - 1];
    if (ultima && ultima.x1 + 1 >= f.x0) ultima.x1 = f.x1;
    else lacunas.push({ x0: f.x0, x1: f.x1 });
  });

  const marcasY = marcasDoEixo(escala.min, escala.max, compacto ? 3 : 6);
  const marcasX = marcasDoEixoX(inicio, fim, total);
  const rotuloX: Record<number, string> = {};
  marcasX.forEach((m) => (rotuloX[m.dia] = m.rotulo));

  const yDe = (v: number) => g.topo + ((escala.max - v) / (escala.max - escala.min)) * (g.base - g.topo);
  const medias = semanas.filter((s) => s.media != null).map((s) => s.media as number);

  // O rótulo da meta fica na ponta da linha em que os dados estão mais longe
  // dela: é onde ele não pisa na linha do peso.
  const ladoDaMeta: "esq" | "dir" =
    meta != null && medias.length
      ? Math.abs(medias[0] - meta) >= Math.abs(medias[medias.length - 1] - meta)
        ? "esq"
        : "dir"
      : "dir";
  const yDaMeta = meta != null && escala.metaNaEscala ? yDe(meta) : null;

  // "sem pesagem" no alto do gráfico, ou embaixo quando a linha está lá em
  // cima; e fora do caminho do rótulo da meta.
  const larguraDoRotulo = 66;
  const rotulosDeLacuna = lacunas.map((l) => {
    const vizinhas = [...faixas]
      .filter((f) => f.s.media != null && (f.x1 < l.x0 || f.x0 > l.x1))
      .sort((a, b) => Math.min(Math.abs(a.x1 - l.x0), Math.abs(a.x0 - l.x1)) - Math.min(Math.abs(b.x1 - l.x0), Math.abs(b.x0 - l.x1)))
      .slice(0, 2);
    const valor = vizinhas.length ? vizinhas.reduce((s, f) => s + (f.s.media as number), 0) / vizinhas.length : null;
    const linhaEmCima = valor != null && valor >= (escala.min + escala.max) / 2;
    let topo = linhaEmCima ? g.base - 18 : g.topo + 4;
    if (yDaMeta != null && Math.abs(topo - yDaMeta) < 22) topo = linhaEmCima ? g.topo + 4 : g.base - 18;
    const centro = xDe((l.x0 + l.x1) / 2);
    const esquerda = Math.max(g.esq - FOLGA, Math.min(centro - larguraDoRotulo / 2, g.dir + FOLGA - larguraDoRotulo));
    return { esquerda, topo };
  });

  const faixaAtiva = ponteiro ? faixas.find((f) => ponteiro.dia >= f.x0 && ponteiro.dia <= f.x1) : undefined;
  const consultasDaFaixa = faixaAtiva
    ? pontosDaConsulta.filter((p) => p.data >= faixaAtiva.s.inicio && p.data <= faixaAtiva.s.fim)
    : [];

  const { variacao } = titulo;
  const origem = titulo.rotulo === "média da semana" ? "1ª semana" : "1ª consulta";
  const textoDaVariacao =
    variacao == null ? null : variacao === 0 ? `igual à ${origem}` : `${comSinal(variacao)} kg desde a ${origem}`;

  return (
    <figure className="min-w-0">
      <figcaption>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold text-clin-texto">Peso</span>
          <span className="text-[14px] tabular-nums text-clin-texto-2">
            {titulo.rotulo}{" "}
            <strong className="font-semibold text-clin-texto">{numeroBR(titulo.valor)} kg</strong>
            {textoDaVariacao ? ` · ${textoDaVariacao}` : ""}
          </span>
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-clin-texto-2">
          {medias.length > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <Amostra>
                <line x1="1" y1="6" x2="19" y2="6" stroke={COR.primaria} strokeWidth="2" />
              </Amostra>
              <span className="hidden sm:inline">média da semana (casa)</span>
              <span className="sm:hidden">semana (casa)</span>
            </li>
          )}
          {pontosDaConsulta.length > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <Amostra>
                <circle cx="10" cy="6" r="4.5" fill={COR.texto} stroke={COR.chao} strokeWidth="1.5" />
              </Amostra>
              <span className="hidden sm:inline">medida na consulta</span>
              <span className="sm:hidden">consulta</span>
            </li>
          )}
          {meta != null && (
            <li className="inline-flex items-center gap-1.5">
              <Amostra>
                <line x1="1" y1="6" x2="19" y2="6" stroke={COR.campo} strokeWidth="1.5" strokeDasharray="4 3" />
              </Amostra>
              <span>meta</span>
            </li>
          )}
        </ul>
      </figcaption>

      <div
        ref={ref}
        // Antes de medir a largura o gráfico não existe (o recharts desenha em
        // px): a altura vem da classe, a mesma de depois, para a página não
        // dar um salto quando o gráfico chega.
        className={`relative mt-3 touch-pan-y select-none ${largura > 0 ? "" : "h-[230px] sm:h-[280px]"}`}
        style={largura > 0 ? { height: altura } : undefined}
        {...eventos}
      >
        {largura > 0 && (
          <>
            <ComposedChart
              width={largura}
              height={altura}
              margin={MARGEM}
              role="img"
              aria-label={descricao}
            >
              <CartesianGrid vertical={false} stroke={COR.linha} />
              <XAxis
                type="number"
                dataKey="dia"
                domain={[0, total]}
                ticks={marcasX.map((m) => m.dia)}
                tickFormatter={(d: number) => rotuloX[d] ?? ""}
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: COR.linha }}
                padding={{ left: FOLGA, right: FOLGA }}
                height={ALTURA_X}
              />
              <YAxis
                type="number"
                domain={[escala.min, escala.max]}
                ticks={marcasY}
                tickFormatter={numeroBR}
                tick={TICK}
                tickLine={false}
                axisLine={false}
                width={LARGURA_Y}
              />
              {faixaAtiva && (
                <ReferenceArea
                  x1={Math.max(0, faixaAtiva.x0 - 0.5)}
                  x2={Math.min(total, faixaAtiva.x1 + 0.5)}
                  fill={COR.fundoDaPrimaria}
                  fillOpacity={1}
                  stroke="none"
                  ifOverflow="hidden"
                />
              )}
              {diasDeConsulta.map((d) => (
                <ReferenceLine
                  key={d}
                  x={d}
                  className="linha-de-consulta"
                  stroke={COR.linha}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              ))}
              {meta != null && escala.metaNaEscala && (
                <ReferenceLine
                  y={meta}
                  className="linha-da-meta"
                  stroke={COR.campo}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              )}
              <Line
                data={linha}
                dataKey="media"
                type="linear"
                stroke={COR.primaria}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                activeDot={false}
                dot={(p: any) =>
                  p.cy == null ? (
                    <g key={p.key} />
                  ) : (
                    <circle
                      key={p.key}
                      className="ponto-semana"
                      cx={p.cx}
                      cy={p.cy}
                      r={2.5}
                      fill={COR.primaria}
                      stroke={COR.chao}
                      strokeWidth={1}
                    />
                  )
                }
              />
              <Scatter
                data={consultas}
                dataKey="valor"
                isAnimationActive={false}
                shape={(p: any) => (
                  <circle
                    key={`${p.payload.data}`}
                    className="ponto-consulta"
                    cx={p.cx}
                    cy={p.cy}
                    r={5}
                    fill={COR.texto}
                    stroke={COR.chao}
                    strokeWidth={2}
                  />
                )}
              />
            </ComposedChart>

            {lacunas.map((l, i) => (
              <span
                key={`lacuna-${l.x0}`}
                aria-hidden="true"
                className={SOBRE_O_GRAFICO}
                style={{ left: rotulosDeLacuna[i].esquerda, top: rotulosDeLacuna[i].topo, width: larguraDoRotulo, textAlign: "center" }}
              >
                sem pesagem
              </span>
            ))}

            {meta != null && yDaMeta != null && (
              <span
                aria-hidden="true"
                className={SOBRE_O_GRAFICO}
                style={{
                  top: yDaMeta > g.topo + 16 ? yDaMeta - 15 : yDaMeta + 5,
                  ...(ladoDaMeta === "esq" ? { left: g.esq } : { right: largura - g.dir }),
                }}
              >
                meta {numeroBR(meta)} kg
              </span>
            )}
            {meta != null && !escala.metaNaEscala && (
              <span
                aria-hidden="true"
                className={SOBRE_O_GRAFICO}
                style={{
                  right: largura - g.dir,
                  ...(escala.metaAcima ? { top: g.topo + 2 } : { top: g.base - 16 }),
                }}
              >
                meta {numeroBR(meta)} kg {escala.metaAcima ? "↑" : "↓"}
              </span>
            )}

            {ponteiro && faixaAtiva && (
              <CaixaDaDica x={ponteiro.x} largura={largura}>
                <p className="font-semibold">
                  Semana de {ddmm(faixaAtiva.s.inicio)} a {ddmm(faixaAtiva.s.fim)}
                </p>
                {faixaAtiva.s.emCurso && <p className="text-clin-texto-2">semana em curso</p>}
                {faixaAtiva.s.media != null ? (
                  <>
                    <p>média {numeroBR(faixaAtiva.s.media)} kg</p>
                    <p className="text-clin-texto-2">
                      {faixaAtiva.s.dias} {faixaAtiva.s.dias === 1 ? "pesagem" : "pesagens"}
                      {faixaAtiva.s.menor != null && faixaAtiva.s.maior != null && faixaAtiva.s.menor !== faixaAtiva.s.maior
                        ? ` · ${numeroBR(faixaAtiva.s.menor)}–${numeroBR(faixaAtiva.s.maior)} kg`
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-clin-texto-2">sem pesagem em casa</p>
                )}
                {consultasDaFaixa.map((c) => (
                  <p key={c.data} className="mt-1 border-t border-clin-linha pt-1">
                    consulta de {ddmm(c.data)}: <strong className="font-semibold">{numeroBR(c.valor)} kg</strong>
                  </p>
                ))}
              </CaixaDaDica>
            )}
          </>
        )}
      </div>
    </figure>
  );
}
