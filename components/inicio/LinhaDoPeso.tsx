import { dataCurta } from "@/lib/consultas";
import { numeroFixo } from "@/lib/numeros";

// A linha fina do peso dos últimos 30 dias, no Progresso da Início (spec
// "Início (paciente)", item 6): um `polyline` em `app-primaria`, sem eixo nem
// grade, com a primeira e a última data embaixo. É um resumo, não o gráfico:
// quem quer os números abre "Ver medidas". O gráfico de antes (recharts, com
// eixo e dica) pesava na Início e lia as 60 pesagens MAIS ANTIGAS.
//
// O eixo x é o tempo, não a posição na lista: três pesagens na mesma semana e
// uma no fim do mês não ficam igualmente espaçadas, como estavam.

const LARGURA = 320;
const ALTURA = 64;
const FOLGA = 4;

const dia = (data: string) => Date.parse(data + "T12:00:00Z");

export function LinhaDoPeso({ pontos }: { pontos: { data: string; peso: number }[] }) {
  if (pontos.length < 2) return null;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const t0 = dia(primeiro.data);
  const dt = dia(ultimo.data) - t0 || 1;
  const pesos = pontos.map((p) => p.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const x = (data: string) => FOLGA + ((dia(data) - t0) / dt) * (LARGURA - 2 * FOLGA);
  // Peso parado desenha uma reta no meio, em vez de dividir por zero.
  const y = (peso: number) =>
    max === min ? ALTURA / 2 : FOLGA + ((max - peso) / (max - min)) * (ALTURA - 2 * FOLGA);
  const linha = pontos.map((p) => `${x(p.data).toFixed(1)},${y(p.peso).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Peso dos últimos 30 dias, de ${numeroFixo(primeiro.peso)} para ${numeroFixo(ultimo.peso)} kg.`}
        className="block h-16 w-full"
      >
        <polyline
          points={linha}
          fill="none"
          stroke="var(--app-primaria)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          // A largura esticada pelo `preserveAspectRatio="none"` não engrossa
          // o traço.
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div aria-hidden="true" className="tabular mt-1 flex justify-between text-[13px] text-app-texto-2">
        <span>{dataCurta(primeiro.data)}</span>
        <span>{dataCurta(ultimo.data)}</span>
      </div>
    </div>
  );
}
