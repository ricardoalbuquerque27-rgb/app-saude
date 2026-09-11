"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Check, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";

export type Nota = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_id: string;
};

// Conversa com o nutricionista, do lado do paciente.
//
// `compact` é a versão que aparece no bloco "Hoje": mostra só o que chegou e
// ainda não foi lido, com confirmação de leitura. A conversa completa, com
// campo de resposta, fica na página "Meu nutricionista".
export default function NutriNotes({
  notas,
  meuId,
  nutriId,
  compact = false,
}: {
  notas: Nota[];
  meuId: string;
  nutriId?: string | null;
  compact?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function marcarLido(id: string) {
    setBusy(id);
    await supabase
      .from("patient_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    router.refresh();
  }

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body || !nutriId) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: meuId,
      author_id: meuId,
      body,
      visibility: "shared",
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar. Tente de novo.");
      return;
    }
    setTexto("");
    router.refresh();
  }

  // ---- Versão compacta: avisos não lidos no dashboard ----
  if (compact) {
    if (notas.length === 0) return null;
    return (
      <div className="space-y-2">
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
                Li o recado
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- Conversa completa ----
  const ordenadas = [...notas].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1
  );

  return (
    <div className="card">
      {ordenadas.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Nenhuma mensagem ainda. Você pode escrever para o seu nutricionista
          aqui.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {ordenadas.map((n) => {
            const meu = n.author_id === meuId;
            return (
              <li
                key={n.id}
                className={`flex ${meu ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    meu
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      meu ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {formatDate(n.created_at.slice(0, 10))}
                    {!meu && !n.read_at ? " · novo" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nutriId && (
        <form onSubmit={responder}>
          <textarea
            className="input min-h-[72px] resize-y"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva para o seu nutricionista…"
            maxLength={4000}
          />
          {erro && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{erro}</p>
          )}
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="btn-primary mt-2 w-full py-2.5"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
