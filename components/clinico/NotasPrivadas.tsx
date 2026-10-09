"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dataNoBrasil, formatDate } from "@/lib/date";
import { ErroInline } from "./ErroInline";
import type { Mensagem } from "./tipos";

// Notas que o paciente nunca vê (visibility "private"), movidas da antiga aba
// Prescrição sem mudar as chamadas ao banco. O erro de salvar e o
// de excluir aparecem no mesmo lugar, embaixo do campo de texto.
export function NotasPrivadas({
  pacienteId,
  nutriId,
  notas,
}: {
  pacienteId: string;
  nutriId: string;
  notas: Mensagem[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: pacienteId,
      author_id: nutriId,
      body,
      visibility: "private",
    });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar a nota.");
      return;
    }
    setTexto("");
    router.refresh();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("patient_notes").delete().eq("id", id);
    if (error) setErro("Não foi possível excluir a nota.");
    else router.refresh();
  }

  return (
    <div className="card">
      <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        Só você vê. Use para anamnese, conduta e o que observar no próximo
        retorno — o paciente não tem acesso a nada aqui.
      </p>

      <form onSubmit={salvar} className="mb-4">
        <textarea
          aria-label="Nota privada"
          className="input min-h-[90px] resize-y"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: relata compulsão à noite; revisar distribuição de carboidrato no jantar."
          maxLength={4000}
        />
        <button type="submit" disabled={salvando || !texto.trim()} className="btn-primary mt-2 w-full py-2.5">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Salvar nota
        </button>
        <ErroInline mensagem={erro} />
      </form>

      {notas.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma nota ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {notas.map((n: Mensagem) => (
            <li
              key={n.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/[0.07] dark:bg-slate-800/40"
            >
              <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                {n.body}
              </p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDate(dataNoBrasil(n.created_at))}
                </span>
                <button
                  onClick={() => excluir(n.id)}
                  className="tappable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-1 text-slate-500 hover:text-rose-600"
                  aria-label="Excluir nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
