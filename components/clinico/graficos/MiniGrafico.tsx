import { diasEntre } from "@/lib/evolucao";
import type { FaixaNumerica } from "@/lib/exames";

// O minigráfico da coluna Tendência do comparativo de exames (aba Clínico):
// uma linha com um ponto por resultado, sobre a faixa de referência
// sombreada. Quem chama só o monta com 3 resultados ou mais na mesma unidade
// (`serie` de compararExames): com dois pontos o desenho não diz mais do que o
// "valor · data" da coluna Anterior.
//
// SVG simples, sem recharts: são 120×36 px dentro de uma célula de tabela, sem
// eixo nem dica. O que o desenho diz em palavras está no `aria-label`
// (descricaoDaSerie), e a tabela em volta é a versão em texto. Sem hook nem
// evento, então serve a componente de servidor.
//
// A escala vai do menor ao maior valor da série, e a faixa é cortada na borda
// do desenho: uma faixa de 30 a 100 sobre valores de 18 a 38 aparece só de 30
// para cima, e uma série inteira dentro da faixa fica toda sombreada. A faixa é
// a `faixa` da linha (numérica, já lida), nunca relida do texto.
//
// O preenchimento da faixa sozinho não basta: `primaria-fundo` contra o fundo
// da página dá cerca de 1,14:1 no claro e 1,22:1 no escuro, e o limite da faixa
// é informação (WCAG 1.4.11 pede 3:1 para ela). Por isso a borda de cima e a de
// baixo, as que existirem e caírem dentro do desenho, são linhas de 1 px em
// `campo`, o par `campo` sobre `chao` que já passa 3:1 (PARES_GRAFICO). O
// preenchimento fica como está, e o par da linha e dos pontos sobre ele
// (`texto` sobre `primaria-fundo`) também está em PARES_GRAFICO.
//
// Só variáveis do tema clínico: a mesma cor serve ao claro e ao escuro.

const LARGURA = 120;
const ALTURA = 36;
/** Folga das bordas: o raio do ponto (3,5) mais o anel (1,5), e um pouco. */
const FOLGA = 6;

const COR = {
  linha: "var(--clin-texto)",
  anel: "var(--clin-chao)",
  faixa: "var(--clin-primaria-fundo)",
  borda: "var(--clin-campo)",
};

const casa = (n: number) => n.toFixed(1);

export function MiniGrafico({
  serie,
  faixa,
  descricao,
}: {
  serie: { data: string; valor: number }[];
  faixa: FaixaNumerica | null;
  descricao: string;
}) {
  const inicio = serie[0].data;
  // Os pontos ficam onde os dias caem, e não a espaços iguais: 3 laudos em 8
  // meses e 3 em 8 dias não são a mesma linha. Série de um dia só (não
  // acontece com 3 resultados, que são de dias diferentes) não divide por zero.
  const total = Math.max(1, diasEntre(inicio, serie[serie.length - 1].data));
  const valores = serie.map((p) => p.valor);
  // Série plana (três vezes o mesmo valor) ganha uma unidade de cada lado: a
  // linha fica no meio, e a faixa ainda cai do lado certo dela.
  const plana = Math.min(...valores) === Math.max(...valores) ? 1 : 0;
  const piso = Math.min(...valores) - plana;
  const teto = Math.max(...valores) + plana;

  const x = (data: string) => FOLGA + (diasEntre(inicio, data) / total) * (LARGURA - 2 * FOLGA);
  const y = (valor: number) => ALTURA - FOLGA - ((valor - piso) / (teto - piso)) * (ALTURA - 2 * FOLGA);

  const pontos = serie.map((p) => ({ data: p.data, cx: x(p.data), cy: y(p.valor) }));

  // Valor maior fica mais alto (y menor): o teto da faixa é a borda de cima.
  // Sem teto ("a partir de 30") a faixa sobe até a borda do desenho; sem piso,
  // desce até ela. Faixa toda fora do desenho não vira retângulo.
  const topoDaFaixa = Math.max(0, faixa?.max != null ? y(faixa.max) : 0);
  const baseDaFaixa = Math.min(ALTURA, faixa?.min != null ? y(faixa.min) : ALTURA);
  const comFaixa = faixa != null && topoDaFaixa < baseDaFaixa;
  // As bordas: só a que a faixa tem (sem teto, só a de baixo; sem piso, só a de
  // cima) e só a que cai dentro do desenho. Faixa que passa da borda do
  // desenho não ganha linha na borda do desenho.
  const bordas = [faixa?.max, faixa?.min]
    .filter((v): v is number => v != null)
    .map(y)
    .filter((yDaBorda) => yDaBorda > 0 && yDaBorda < ALTURA);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      width={LARGURA}
      height={ALTURA}
      role="img"
      aria-label={descricao}
      className="block shrink-0"
    >
      {comFaixa && (
        <rect
          className="faixa-do-exame"
          x={0}
          y={casa(topoDaFaixa)}
          width={LARGURA}
          height={casa(baseDaFaixa - topoDaFaixa)}
          fill={COR.faixa}
        />
      )}
      {bordas.map((yDaBorda) => (
        <line
          key={yDaBorda}
          className="borda-da-faixa"
          x1={0}
          x2={LARGURA}
          y1={casa(yDaBorda)}
          y2={casa(yDaBorda)}
          stroke={COR.borda}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      ))}
      <polyline
        className="linha-do-exame"
        points={pontos.map((p) => `${casa(p.cx)},${casa(p.cy)}`).join(" ")}
        fill="none"
        stroke={COR.linha}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {pontos.map((p) => (
        <circle
          key={p.data}
          className="ponto-do-exame"
          cx={casa(p.cx)}
          cy={casa(p.cy)}
          r={3.5}
          fill={COR.linha}
          stroke={COR.anel}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
