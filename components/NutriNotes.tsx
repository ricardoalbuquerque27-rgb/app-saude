"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, dataNoBrasil } from "@/lib/date";

export type Nota = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_id: string;
};

// Conversa com o nutricionista, do lado do paciente.
//
// `compact` é a versão que aparece no "Para hoje" da Início: mostra só o que
// chegou e ainda não foi lido, com confirmação de leitura. A conversa
// completa, com campo de resposta, fica na aba Conversa de "Meu plano".
//
// Compacta, cada recado é um <li>: quem a usa a põe dentro da lista do "Para
// hoje" (um <ul> com traço entre as linhas), e cada recado é uma linha que
// conta na contagem de pendentes. Fora de uma lista ela não serve.
export default function NutriNotes({
  notas,
  meuId,
  nutriId,
  nutriNome,
  compact = false,
}: {
  notas: Nota[];
  meuId: string;
  nutriId?: string | null;
  /** Nome do nutricionista, para o título "Recado de {primeiro nome}" (só na compacta). */
  nutriNome?: string;
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

  // ---- Versão compacta: recados não lidos, no "Para hoje" da Início ----
  if (compact) {
    if (notas.length === 0) return null;
    // "de {primeiro nome}", nunca "do"/"da": o app não sabe o gênero de
    // quem atende (spec, "Nome do nutricionista"). Sem nome, só "Recado".
    const primeiroNome = nutriNome?.trim().split(/\s+/)[0] ?? "";
    const titulo = primeiroNome ? `Recado de ${primeiroNome}` : "Recado";
    return (
      <>
        {notas.map((n) => (
          <li key={n.id} className="px-4 py-3.5">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[15px] font-semibold text-app-texto">{titulo}</span>
              <span className="text-[13px] text-app-texto-2">· seu nutricionista</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-app-texto">
              {n.body}
            </p>
            <p className="mt-1 text-[13px] text-app-texto-2">
              {formatDate(dataNoBrasil(n.created_at))}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => marcarLido(n.id)}
                disabled={busy === n.id}
                className="btn-ghost px-3.5"
              >
                {busy === n.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Li o recado
              </button>
              <Link
                href="/app/nutricionista"
                className="tappable inline-flex min-h-[40px] items-center rounded-lg px-1.5 text-sm font-semibold text-app-primaria hover:underline"
              >
                Ver Meu plano
              </Link>
            </div>
          </li>
        ))}
      </>
    );
  }

  // ---- Conversa completa ----
  const ordenadas = [...notas].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1
  );

  return (
    <div className="card">
      {ordenadas.length === 0 ? (
        <p className="mb-4 text-sm text-app-texto-2">
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
                  // A minha em `primaria` sólido; a do nutricionista em `pagina`
                  // com borda, porque sobre o cartão (branco) o cinza da
                  // página quase não aparece sozinho.
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    meu
                      ? "bg-app-primaria text-app-sobre-primaria"
                      : "border border-app-linha bg-app-pagina text-app-texto"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <p
                    // `opacity` e não `/70` na cor: as cores do app são variáveis, e
                    // o branco a 70% sobre a primária do escuro (um verde claro)
                    // sumiria. 80% da cor `sobre-primaria` fica a ~5:1 nos dois temas.
                    className={`tabular mt-1 text-[13px] ${
                      meu ? "opacity-80" : "text-app-texto-2"
                    }`}
                  >
                    {formatDate(dataNoBrasil(n.created_at))}
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
            <p className="mt-1 text-[13px] text-app-perigo">{erro}</p>
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
