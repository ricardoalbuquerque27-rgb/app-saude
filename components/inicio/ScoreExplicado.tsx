import { ChevronDown } from "lucide-react";
import type { HealthScore } from "@/lib/healthScore";

// O Score do dia que se explica (spec "Início (paciente)", item 5). Era um
// número grande colorido por faixa e uma legenda em caixa alta, sem dizer de
// onde vinha: o paciente via "52" e não sabia o que fazer. Agora é o `summary`
// de um <details> (nativo, sem JavaScript, como o cardápio era), à direita do
// título "Seu dia", e ao abrir mostra os quatro pilares com a dica de cada um.
//
// O pilar sem registro diz que é padrão ("sem registro hoje · conta 40"):
// sono, refeição e bem-estar sem nada contam um valor fixo, e mostrado como
// medida ele parecia um dado do dia do paciente.
//
// O `summary` fica por cima da linha do título (posição absoluta, à direita) e
// o conteúdo aberto desce na largura toda, entre o título e o cartão dos
// anéis. Quem usa põe o título (28 px de altura) e este componente juntos num
// `relative`. O `summary` tem 44 px de alvo, centrado na linha do título:
// sobra 8 px acima e abaixo, e a posição absoluta não empurra nada.
export function ScoreExplicado({ health }: { health: HealthScore }) {
  return (
    <details className="group">
      <summary className="tappable absolute -top-2 right-0 flex h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-1 text-[13px] text-app-texto-2 [&::-webkit-details-marker]:hidden">
        score {health.score} · {health.label.toLowerCase()}
        <ChevronDown aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="card mt-2.5 p-0">
        <ul className="divide-y divide-app-linha">
          {health.pillars.map((p) => (
            <li key={p.key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-app-texto">{p.label}</span>
                <span className="tabular text-[15px] font-semibold text-app-texto">{p.value}</span>
              </div>
              {/* A barra repete o valor, que já está escrito ao lado. */}
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-app-linha">
                <div className="h-full rounded-full bg-app-primaria" style={{ width: `${p.value}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-app-texto-2">
                {p.semRegistro ? `sem registro hoje · conta ${p.value}` : p.tip}
              </p>
            </li>
          ))}
        </ul>
        <p className="border-t border-app-linha px-4 py-3 text-[13px] text-app-texto-2">
          O score é a média dos quatro, de 0 a 100, com o que você registrou hoje e nesta semana.
        </p>
      </div>
    </details>
  );
}
