"use client";

import { useState } from "react";
import { Utensils, Check, Loader2, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ItemCardapioPaciente = {
  id: string;
  meal_type: string;
  position: number;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

// O cardápio prescrito, do lado do paciente. O ganho principal é o botão
// "Comi isso": em vez de digitar a refeição, ele confirma o que já foi
// prescrito e vira um registro normal em `meals`.
export default function MealPlanView({
  nome,
  observacao,
  itens,
  date,
  jaRegistrados,
  onRegistrado,
}: {
  nome: string;
  observacao: string | null;
  itens: ItemCardapioPaciente[];
  date: string;
  /** meal_type das refeições já registradas hoje, para não duplicar. */
  jaRegistrados: string[];
  onRegistrado: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tipos = Array.from(new Set(itens.map((i) => i.meal_type)));

  async function comiIsso(item: ItemCardapioPaciente) {
    setBusy(item.id);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      return;
    }
    const { error } = await supabase.from("meals").insert({
      user_id: user.id,
      date,
      meal_type: item.meal_type,
      description: item.description,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    });
    setBusy(null);
    if (error) {
      setErro("Não foi possível registrar. Tente de novo.");
      return;
    }
    onRegistrado();
  }

  if (itens.length === 0) return null;

  return (
    <div className="card card-accent mb-5 pl-6">
      <h2 className="section-title mb-1">
        <span className="icon-badge">
          <Utensils className="h-4 w-4" />
        </span>
        {nome}
      </h2>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-brand-700 dark:text-brand-300">
        <Stethoscope className="h-3 w-3" />
        Prescrito pelo seu nutricionista
      </p>

      {observacao && (
        <p className="mb-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
          {observacao}
        </p>
      )}

      <div className="space-y-3">
        {tipos.map((tipo) => {
          const opcoes = itens
            .filter((i) => i.meal_type === tipo)
            .sort((a, b) => a.position - b.position);
          const feito = jaRegistrados.includes(tipo);

          return (
            <div key={tipo}>
              <div className="mb-1.5 flex items-center gap-2">
                <p className="eyebrow">{tipo}</p>
                {feito && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    <Check className="h-2.5 w-2.5" /> registrado
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {opcoes.map((o, i) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/[0.07] dark:bg-slate-900/60"
                  >
                    {opcoes.length > 1 && (
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Opção {i + 1}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                      {o.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {[
                          o.calories ? `${Math.round(Number(o.calories))} kcal` : null,
                          o.protein_g ? `${Math.round(Number(o.protein_g))} g prot` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <button
                        onClick={() => comiIsso(o)}
                        disabled={busy === o.id}
                        className="tappable inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      >
                        {busy === o.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Comi isso
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {erro && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}
    </div>
  );
}
