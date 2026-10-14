"use client";

import { ComposedChart, Line, ReferenceLine, CartesianGrid, XAxis, YAxis } from "recharts";
import { dataCurta } from "@/lib/consultas";
import { diasEntre, marcasDoEixo, variacaoDaMedida, type PontoDeMedida } from "@/lib/evolucao";
import { comSinal, comUnidade, numeroBR } from "@/lib/numeros";
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

// Cintura ou % de gordura: o mesmo desenho do gráfico do peso, menor. Uma
// linha por todas as medidas; o ponto cheio é a da consulta (o nutri mediu), o
// vazado é a de casa (o paciente anotou). Quem chama só monta este gráfico com
// 2 medidas ou mais.

export function GraficoMedida({
  nome,
  unidade,
  pontos,
  descricao,
}: {
  nome: string;
  unidade: string;
  pontos: PontoDeMedida[];
  descricao: string;
}) {
  const inicio = pontos[0].data;
  const fim = pontos[pontos.length - 1].data;
  // Duas medidas no mesmo dia dão um período de 0 dia: o eixo precisa de largura.
  const total = Math.max(1, diasEntre(inicio, fim));
  const { ref, largura, altura, ponteiro, xDe, eventos } = useGrafico(total, (compacto) => (compacto ? 150 : 170));

  const dados = pontos.map((p) => ({ dia: diasEntre(inicio, p.data), valor: p.valor, data: p.data, daConsulta: p.daConsulta }));
  const valores = pontos.map((p) => p.valor);
  const min = Math.floor(Math.min(...valores) - 1);
  const max = Math.ceil(Math.max(...valores) + 1);
  const marcasY = marcasDoEixo(min, max, 3);
  const marcasX = marcasDoEixoX(inicio, fim, total);
  const rotuloX: Record<number, string> = {};
  marcasX.forEach((m) => (rotuloX[m.dia] = m.rotulo));

  // O ponto mais perto do ponteiro: com poucas medidas por gráfico, a dica é
  // do ponto, e não de uma semana.
  const ativo = ponteiro
    ? dados.reduce((perto, d) => (Math.abs(d.dia - ponteiro.dia) < Math.abs(perto.dia - ponteiro.dia) ? d : perto), dados[0])
    : null;

  const ultimo = pontos[pontos.length - 1].valor;
  const variacao = variacaoDaMedida(pontos);
  // % de gordura varia em pontos percentuais; cintura, na própria unidade.
  const unidadeDaVariacao = unidade === "%" ? "pontos" : unidade;
  const valorDoTitulo = comUnidade(ultimo, unidade);
  const textoDaVariacao =
    variacao == null
      ? null
      : variacao === 0
        ? `igual a ${dataCurta(inicio)}`
        : `${comSinal(variacao)} ${unidadeDaVariacao} desde ${dataCurta(inicio)}`;

  return (
    <figure className="min-w-0">
      <figcaption>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold text-clin-texto">{nome}</span>
          <span className="text-[14px] tabular-nums text-clin-texto-2">
            <strong className="font-semibold text-clin-texto">{valorDoTitulo}</strong>
            {textoDaVariacao ? ` · ${textoDaVariacao}` : ""}
          </span>
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-clin-texto-2">
          <li className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" width="14" height="12" viewBox="0 0 14 12" className="shrink-0">
              <circle cx="7" cy="6" r="4.5" fill={COR.texto} stroke={COR.chao} strokeWidth="1.5" />
            </svg>
            consulta
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" width="14" height="12" viewBox="0 0 14 12" className="shrink-0">
              <circle cx="7" cy="6" r="3.5" fill={COR.chao} stroke={COR.primaria} strokeWidth="2" />
            </svg>
            casa
          </li>
        </ul>
      </figcaption>

      <div
        ref={ref}
        // A altura de antes da medida vem da classe (ver GraficoPeso).
        className={`relative mt-3 touch-pan-y select-none ${largura > 0 ? "" : "h-[150px] sm:h-[170px]"}`}
        style={largura > 0 ? { height: altura } : undefined}
        {...eventos}
      >
        {largura > 0 && (
          <>
            <ComposedChart width={largura} height={altura} margin={MARGEM} role="img" aria-label={descricao}>
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
                domain={[min, max]}
                ticks={marcasY}
                tickFormatter={(v: number) => numeroBR(v)}
                tick={TICK}
                tickLine={false}
                axisLine={false}
                width={LARGURA_Y}
              />
              {ativo && <ReferenceLine x={ativo.dia} stroke={COR.campo} strokeWidth={1} />}
              <Line
                data={dados}
                dataKey="valor"
                type="linear"
                stroke={COR.primaria}
                strokeWidth={2}
                isAnimationActive={false}
                activeDot={false}
                dot={(p: any) =>
                  p.payload.daConsulta ? (
                    <circle
                      key={p.key}
                      className="ponto-consulta"
                      cx={p.cx}
                      cy={p.cy}
                      r={5}
                      fill={COR.texto}
                      stroke={COR.chao}
                      strokeWidth={2}
                    />
                  ) : (
                    <circle
                      key={p.key}
                      className="ponto-casa"
                      cx={p.cx}
                      cy={p.cy}
                      r={4}
                      fill={COR.chao}
                      stroke={COR.primaria}
                      strokeWidth={2}
                    />
                  )
                }
              />
            </ComposedChart>

            {ponteiro && ativo && (
              <CaixaDaDica x={xDe(ativo.dia)} largura={largura}>
                <p className="font-semibold">{comUnidade(ativo.valor, unidade)}</p>
                <p className="text-clin-texto-2">
                  {ativo.daConsulta ? "medida na consulta" : "medida de casa"} · {dataCurta(ativo.data)}
                </p>
              </CaixaDaDica>
            )}
          </>
        )}
      </div>
    </figure>
  );
}
