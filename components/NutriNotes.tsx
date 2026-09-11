"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";

export type Nota = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

// Recados do nutricionista para o paciente. A leitura é confirmada por um
// toque explícito, e não ao simplesmente aparecer na tela: o "lido" que o
// profissional vê do outro lado precisa significar alguma coisa.
export default function NutriNotes({
  notas,
  compact = false,
}: {
  notas: Nota[];
  compact?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function marcarLido(id: string) {
    setBusy(id);
    await supabase
      .from("patient_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    router.refresh();
  }

  if (notas.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "pf-stagger space-y-2"}>
      {notas.map((n) => (
        <div
          key={n.id}
          className="rounded-xl border border-brand-200 bg-white p-3 dark:border-brand-800/50 dark:bg-slate-900/70"
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            <MessageSquare className="h-3 w-3" />
            Recado do seu nutricionista
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
            {n.body}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatDate(n.created_at.slice(0, 10))}
            </span>
            {n.read_at ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <Check className="h-3 w-3" /> lido
              </span>
            ) : (
              <button
                onClick={() => marcarLido(n.id)}
                disabled={busy === n.id}
                className="tappable inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                {busy === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Marcar como lido
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
