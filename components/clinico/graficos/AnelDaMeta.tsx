"use client";

import type { ProgressoDaMeta } from "@/lib/evolucao";

// O anel do "Meta de peso" da aba Corpo: quanto do caminho do peso inicial até
// a meta já foi feito. O desenho é o do anel de calorias do app do paciente
// (trilho e arco), mas com as variáveis do tema clínico: o `ProgressRing`
// dele pinta por classe `slate`, que não existe aqui. A conta do arco não é
// refeita: vem pronta de `progressoDaMeta` (lib/evolucao.ts).

const TAMANHO = 56;
const TRACO = 6;
const RAIO = (TAMANHO - TRACO) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/** "70,3": vírgula, no máximo uma casa. */
const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "12/05" de "2026-05-12". */
function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function AnelDaMeta({
  progresso,
  meta,
  inicio,
}: {
  progresso: ProgressoDaMeta;
  /** A meta de peso, em kg. */
  meta: number;
  /** O dia (YYYY-MM-DD) do peso inicial, de onde o caminho conta. */
  inicio: string;
}) {
  if (!progresso) return null;

  let fracao = 0;
  let principal = `${numero(meta)} kg`;
  let secundaria: string | null = null;
  let atencao = false;
  let rotulo: string;

  if (progresso.tipo === "progresso") {
    // 100% só quando a meta foi atingida: 99,6% arredondaria para "100%" ao
    // lado de "faltam 0,1 kg".
    const pct = Math.min(99, Math.round(progresso.fracao * 100));
    fracao = Math.min(1, progresso.fracao);
    principal = `${numero(meta)} kg · ${pct}%`;
    secundaria = `${numero(progresso.feito)} de ${numero(progresso.total)} kg desde ${ddmm(inicio)}`;
    rotulo = `Progresso até a meta: ${numero(progresso.feito)} de ${numero(progresso.total)} kg, ${pct}%`;
  } else if (progresso.tipo === "atingida") {
    fracao = 1;
    const frase = progresso.passou != null ? `passou da meta em ${numero(progresso.passou)} kg` : "meta atingida";
    principal = `${numero(meta)} kg · ${frase}`;
    rotulo = `Progresso até a meta: ${frase}`;
  } else {
    // Foi para o lado errado: o anel fica vazio, e o texto diz quanto.
    const sinal = progresso.diferenca > 0 ? "+" : "−";
    // Espaço sem quebra antes do "kg": na coluna estreita, "(+0,2" ficava numa
    // linha e "kg)" na outra.
    const frase = `${progresso.diferenca > 0 ? "acima" : "abaixo"} do peso inicial (${sinal}${numero(Math.abs(progresso.diferenca))}\u00a0kg)`;
    secundaria = frase;
    atencao = true;
    rotulo = `Progresso até a meta: ${frase}`;
  }

  return (
    <div className="mt-1 flex items-center gap-3">
      <svg
        role="img"
        aria-label={rotulo}
        width={TAMANHO}
        height={TAMANHO}
        viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
        className="shrink-0"
      >
        <circle
          cx={TAMANHO / 2}
          cy={TAMANHO / 2}
          r={RAIO}
          fill="none"
          stroke="var(--clin-linha)"
          strokeWidth={TRACO}
        />
        {fracao > 0 && (
          <circle
            cx={TAMANHO / 2}
            cy={TAMANHO / 2}
            r={RAIO}
            fill="none"
            stroke="var(--clin-primaria)"
            strokeWidth={TRACO}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUNFERENCIA * fracao} ${CIRCUNFERENCIA}`}
            // O arco nasce às 12h e anda no sentido horário.
            transform={`rotate(-90 ${TAMANHO / 2} ${TAMANHO / 2})`}
          />
        )}
      </svg>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug tabular-nums text-clin-texto">{principal}</p>
        {secundaria && (
          <p
            className={`text-[13px] leading-snug tabular-nums ${
              atencao ? "text-clin-atencao dark:text-clin-atencao" : "text-clin-texto-2"
            }`}
          >
            {secundaria}
          </p>
        )}
      </div>
    </div>
  );
}
