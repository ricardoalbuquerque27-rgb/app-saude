"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, User as UserIcon, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como está minha dieta hoje?",
  "Sugira um treino para hoje",
  "Estou perto da minha meta de peso?",
  "O que posso melhorar nos meus hábitos?",
];

export default function AssistentePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    setInput("");

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    // Adiciona a mensagem do usuário + um espaço para a resposta da IA.
    setMessages([...history, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Falha ao falar com o assistente.");
        // remove o placeholder vazio da resposta
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }

      if (!acc.trim()) {
        setMessages((prev) => prev.slice(0, -1));
        setError("O assistente não respondeu. Tente novamente.");
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col lg:min-h-[calc(100dvh-7rem)]">
      <PageHeader
        title="Assistente"
        subtitle="Tire dúvidas sobre dieta, treino e uso do app."
      />

      <div className="flex-1 space-y-4 pb-4">
        {messages.length === 0 && (
          <div>
            <div className="card flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Bot className="h-5 w-5" />
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300">
                <p className="font-medium text-slate-900 dark:text-white">
                  Olá! Sou seu assistente do Pace Fit 🥗💪
                </p>
                <p className="mt-1">
                  Conheço seus dados (peso, dieta, treinos, hábitos e exames) e uso
                  isso para dar respostas sob medida. Como posso ajudar hoje?
                </p>
              </div>
            </div>

            <p className="mb-2 mt-5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5" /> Sugestões
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                m.role === "user"
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
              }`}
            >
              {m.role === "user" ? (
                <UserIcon className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              {m.content ||
                (loading && i === messages.length - 1 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  ""
                ))}
            </div>
          </div>
        ))}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-16 z-10 flex items-end gap-2 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur lg:bottom-0 dark:border-slate-800 dark:bg-slate-950/95"
      >
        <textarea
          className="input max-h-32 min-h-[44px] flex-1 resize-none"
          rows={1}
          placeholder="Escreva sua pergunta…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary h-[44px] px-4"
          aria-label="Enviar"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      <p className="pb-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
        O assistente pode errar e não substitui um profissional de saúde.
      </p>
    </div>
  );
}
