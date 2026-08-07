// Anel de progresso (SVG puro, sem dependências). Usado no resumo do dia.
export function ProgressRing({
  pct,
  centerMain,
  centerSub,
  label,
  colorClass,
}: {
  pct: number; // 0..1
  centerMain: string;
  centerSub?: string;
  label: string;
  colorClass: string; // ex: "text-amber-500"
}) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct || 0));
  const offset = c * (1 - clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={colorClass}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold leading-none text-slate-900 dark:text-white">
            {centerMain}
          </span>
          {centerSub && (
            <span className="mt-0.5 text-[10px] leading-none text-slate-400">
              {centerSub}
            </span>
          )}
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </div>
  );
}
