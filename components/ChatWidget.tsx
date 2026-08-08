"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Loader2,
  User as UserIcon,
  Sparkles,
  X,
  MessageCircle,
} from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Monte um treino de musculação e adicione ao meu plano",
  "Registrei 500ml de água agora",
  "Como está minha dieta hoje?",
  "Estou perto da minha meta de peso?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, open]);

  // Permite abrir o chat de qualquer lugar disparando um evento global.
  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("pf-open-chat", openHandler);
    return () => window.removeEventListener("pf-open-chat", openHandler);
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    setInput("");

    const history: ChatMessage[] = [...messages, { role: "user", content }];
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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Botão flutuante (balãozinho) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-300" />
          </span>
        </button>
      )}

      {/* Painel do chat */}
      {open && (
        <div className="fixed inset-x-2 bottom-20 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:inset-x-auto sm:right-4 sm:top-auto sm:h-[70vh] sm:max-h-[640px] sm:w-[400px] lg:bottom-6 lg:right-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Assistente</p>
                <p className="text-[11px] text-brand-50/80">Conhece e registra por você</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-900/40"
          >
            {messages.length === 0 && (
              <div>
                <div className="rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Olá! Sou seu assistente 🥗💪
                  </p>
                  <p className="mt-1">
                    Pergunte sobre dieta, treino e hábitos — e peça para eu
                    registrar direto no app (treino, refeição, água, peso).
                  </p>
                </div>
                <p className="mb-1.5 mt-3 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Sparkles className="h-3 w-3" /> Sugestões
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
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
                className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    m.role === "user"
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  }`}
                >
                  {m.role === "user" ? (
                    <UserIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-200"
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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          {/* Entrada */}
          <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
            <textarea
              className="input max-h-24 min-h-[40px] flex-1 resize-none py-2 text-sm"
              rows={1}
              placeholder="Escreva sua pergunta…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="btn-primary h-10 w-10 shrink-0 justify-center px-0"
              aria-label="Enviar"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
