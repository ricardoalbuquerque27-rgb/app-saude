"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import { ErroInline } from "./ErroInline";
import type { Mensagem } from "./tipos";

// Conversa de mão dupla com o paciente (visibility "shared"), movida da antiga
// aba Prescrição sem mudar as chamadas ao banco.
export function Conversa({
  pacienteId,
  nutriId,
  mensagens,
}: {
  pacienteId: string;
  nutriId: string;
  mensagens: Mensagem[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: pacienteId,
      author_id: nutriId,
      body,
      visibility: "shared",
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar a mensagem.");
      return;
    }
    // Marca como lidas as respostas do paciente que estavam pendentes. Só
    // aqui, depois de ENVIAR: abrir a conversa não marca nada como lida.
    await supabase
      .from("patient_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("patient_id", pacienteId)
      .eq("visibility", "shared")
      .is("read_at", null)
      .neq("author_id", nutriId);
    setTexto("");
    router.refresh();
  }

  const ordenadas = [...mensagens].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1
  );

  return (
    <div className="card">
      {/* Conversa vazia mostra só a caixa de escrever: o título da seção já
          diz o que é, e um aviso de "nenhuma mensagem" empurrava o campo
          para baixo sem acrescentar nada. */}
      {ordenadas.length > 0 && (
        <ul className="mb-4 space-y-2">
          {ordenadas.map((m: Mensagem) => {
            const meu = m.author_id === nutriId;
            return (
              <li key={m.id} className={`flex ${meu ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    meu
                      ? "bg-brand-700 text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  {/* Carimbo de hora em cor OPACA: `text-white/70` sobre
                      brand-700 compõe #b6d6c5, 3,65:1; brand-100 dá 5,06:1
                      (lib/contraste.ts). No balão do paciente, slate-500 sobre
                      slate-100 dava 4,34:1; slate-600 dá 6,92:1. */}
                  <p
                    className={`mt-1 flex items-center gap-1 text-[11px] ${
                      meu ? "text-brand-100" : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {formatDate(m.created_at.slice(0, 10))}
                    {meu &&
                      (m.read_at ? (
                        <>
                          <Eye className="h-2.5 w-2.5" /> lido
                        </>
                      ) : (
                        <>· não lido</>
                      ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={enviar}>
        <textarea
          className="input min-h-[72px] resize-y"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva para o paciente…"
          maxLength={4000}
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="btn-primary mt-2 w-full py-2.5">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
        <ErroInline mensagem={erro} />
      </form>
    </div>
  );
}
