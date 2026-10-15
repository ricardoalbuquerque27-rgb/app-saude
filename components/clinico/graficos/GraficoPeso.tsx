"use client";

import type { ReactNode } from "react";
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
import { dataCurta } from "@/lib/consultas";
import {
  diasEntre,
  marcasDoEixo,
  rotuloDoPeso,
  type escalaDoPeso,
  type PontoDeConsulta,
  type SemanaDePeso,
  type TituloDoPeso,
} from "@/lib/evolucao";
import { comSinal, numeroBR } from "@/lib/numeros";
import {
  ALTURA_X,
  CaixaDaDica,
  COR,
  FOLGA,
  LARGURA_Y,
  MARGEM,
  marcasDoEixoX,
  TICK,
  useGrafico,
} from "./base";

// O gráfico do peso da aba Corpo (média semanal, pontos da consulta, meta). As
// peças que ele divide com o GraficoMedida (medir a largura, a geometria, a
// dica e as marcas do eixo X) moram em ./base.
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
  // "média da semana de dd/mm" quando a média não é desta semana nem da anterior.
  const rotulo = rotuloDoPeso(semanas, titulo);
  const textoDaVariacao =
    variacao == null ? null : variacao === 0 ? `igual à ${origem}` : `${comSinal(variacao)} kg desde a ${origem}`;

  return (
    <figure className="min-w-0">
      <figcaption>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold text-clin-texto">Peso</span>
          <span className="text-[14px] tabular-nums text-clin-texto-2">
            {rotulo}{" "}
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
                tickFormatter={(v: number) => numeroBR(v)}
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
              {/* Em `campo`, o par com 3:1 sobre o fundo (PARES_GRAFICO): em
                  `linha` a marca de cada consulta dava 1,24:1 e quase sumia. */}
              {diasDeConsulta.map((d) => (
                <ReferenceLine
                  key={d}
                  x={d}
                  className="linha-de-consulta"
                  stroke={COR.campo}
                  strokeWidth={1}
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
                // Sem `key`: o recharts embrulha cada ponto num grupo próprio,
                // com a chave pela posição.
                shape={(p: any) => (
                  <circle
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
                  Semana de {dataCurta(faixaAtiva.s.inicio)} a {dataCurta(faixaAtiva.s.fim)}
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
                {consultasDaFaixa.map((c, i) => (
                  <p key={`${c.data}-${i}`} className="mt-1 border-t border-clin-linha pt-1">
                    consulta de {dataCurta(c.data)}: <strong className="font-semibold">{numeroBR(c.valor)} kg</strong>
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
