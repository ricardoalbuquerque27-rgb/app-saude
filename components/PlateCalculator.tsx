"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Modal, Field } from "@/components/ui";

// Anilhas comuns em kg (academias no Brasil).
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// Calcula as anilhas por lado para atingir o peso alvo com uma barra.
function platesPerSide(target: number, bar: number): { plate: number; count: number }[] {
  let perSide = (target - bar) / 2;
  if (!Number.isFinite(perSide) || perSide <= 0) return [];
  const result: { plate: number; count: number }[] = [];
  for (const p of PLATES) {
    const n = Math.floor(perSide / p + 1e-9);
    if (n > 0) {
      result.push({ plate: p, count: n });
      perSide -= n * p;
    }
  }
  return result;
}

export default function PlateCalculator() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [bar, setBar] = useState("20");

  const t = Number(target);
  const b = Number(bar) || 20;
  const perSide = useMemo(() => platesPerSide(t, b), [t, b]);
  const somaLado = perSide.reduce((s, x) => s + x.plate * x.count, 0);
  const real = b + somaLado * 2;
  const sobra = t > 0 ? Math.round((t - real) * 100) / 100 : 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        <Calculator className="h-4 w-4" /> Anilhas
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Calculadora de anilhas">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso total (kg)">
              <input
                type="number"
                inputMode="decimal"
                className="input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="60"
              />
            </Field>
            <Field label="Barra (kg)">
              <input
                type="number"
                inputMode="decimal"
                className="input"
                value={bar}
                onChange={(e) => setBar(e.target.value)}
                placeholder="20"
              />
            </Field>
          </div>

          {t > 0 && t >= b ? (
            perSide.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Por lado da barra:
                </p>
                <div className="flex flex-wrap gap-2">
                  {perSide.map((x) => (
                    <span
                      key={x.plate}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    >
                      {x.count}× {x.plate} kg
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Total montado: {real} kg
                  {sobra !== 0 && ` · faltam ${sobra} kg (sem anilha exata)`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Só a barra ({b} kg) — sem anilhas.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Informe um peso total maior que a barra.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
