import { avisoDoAnel, rotuloDoAnel } from "@/lib/anel";
import type { PapelDasCalorias } from "@/lib/nutri";

// Anel de progresso (SVG puro, sem dependências), da Início, da Dieta e dos
// Hábitos. O anel é sempre `app-primaria` sobre trilho `app-linha` (spec "Anel
// e macros"): a cor por anel de antes (âmbar, azul, rosa) era enfeite, e o
// tom 500 de duas delas nem passava 3:1 sobre o cartão.
//
// `pct` é a razão crua (consumido ÷ meta) e pode passar de 1: o desenho corta
// em 1, mas o aviso precisa do valor de verdade. Cortado antes de chegar
// aqui, "acima do limite" nunca apareceria.
//
// É um <figure> com o rótulo no <figcaption>: o número do centro e o nome do
// anel ficam juntos para o leitor de tela, e o SVG, que só repete o número,
// sai da árvore de acessibilidade.
export function ProgressRing({
  pct,
  centerMain,
  centerSub,
  label,
  papel = null,
  avisoAcima = false,
}: {
  pct: number;
  centerMain: string;
  centerSub?: string;
  label: string;
  /** Só o anel de calorias leva o papel; proteína e água passam `null`. */
  papel?: PapelDasCalorias;
  /** Ligado só quando o papel é "limite": passar da meta é bom num piso. */
  avisoAcima?: boolean;
}) {
  const size = 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cru = Number.isFinite(pct) ? pct : 0;
  const desenhado = Math.max(0, Math.min(1, cru));
  const offset = c * (1 - desenhado);
  const aviso = avisoDoAnel(cru, avisoAcima);

  return (
    <figure className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-app-linha"
          />
          {desenhado > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              className="stroke-app-primaria"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-[17px] font-semibold leading-none text-app-texto">
            {centerMain}
          </span>
          {centerSub && (
            <span className="tabular mt-1 text-[13px] leading-none text-app-texto-2">
              {centerSub}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-2 text-[13px] font-medium leading-tight text-app-texto-2">
        {rotuloDoAnel(label, papel)}
      </figcaption>
      {aviso && (
        <p className="mt-0.5 text-[13px] font-medium leading-tight text-app-atencao">{aviso}</p>
      )}
    </figure>
  );
}
