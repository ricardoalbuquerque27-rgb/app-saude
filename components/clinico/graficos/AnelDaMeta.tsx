import { textoDoAnel, type ProgressoDaMeta } from "@/lib/evolucao";

// O anel do "Meta de peso" da aba Corpo: quanto do caminho do peso inicial até
// a meta já foi feito. O desenho é o do anel de calorias do app do paciente
// (trilho e arco), mas com as variáveis do tema clínico: o `ProgressRing`
// dele pinta por classe `slate`, que não existe aqui. A conta do arco
// (`progressoDaMeta`) e as frases (`textoDoAnel`) vêm prontas de
// lib/evolucao.ts, com teste.
//
// Sem "use client": não tem estado nem evento, e é desenhado no servidor.

const TAMANHO = 56;
const TRACO = 6;
const RAIO = (TAMANHO - TRACO) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

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
  const { fracao, principal, secundaria, atencao, rotulo } = textoDoAnel(progresso, meta, inicio);

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
