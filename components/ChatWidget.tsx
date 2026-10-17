"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Loader2,
  User as UserIcon,
  Sparkles,
  X,
  Leaf,
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
  // O balão some ao descer (que é quando se está lendo) e volta ao subir ou
  // ao chegar no topo. No computador ele flutua no canto de baixo e cobre o
  // que estiver ali; no celular ele fica encaixado na barra de baixo (ver o
  // botão, adiante), e o esconder ao rolar só tira o que sobrou dele.
  const [escondido, setEscondido] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Começa onde a página REALMENTE está. Com 0, depois de recarregar com a
  // rolagem restaurada pelo navegador, a primeira subida era comparada
  // contra o topo e lida como descida — o balão sumia sem a pessoa ter
  // descido nada.
  const ultimoY = useRef(typeof window === "undefined" ? 0 : window.scrollY);

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
        setError(data?.error ?? "Falha ao falar com a Gaia.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // Marcador fora de banda enviado pelo servidor no fim do stream:
      // "\0PF_REFRESH:treinos,habitos" (o \0 delimita: nunca aparece em
      // texto natural). Removemos do texto e usamos para
      // recarregar as telas abertas.
      const MARKER = /[\s\0]*PF_REFRESH:[a-z,]*[\s\0]*$/i;
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const display = acc.replace(MARKER, "");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: display };
          return copy;
        });
      }

      // Dispara a atualização das telas afetadas.
      const m = acc.match(/PF_REFRESH:([a-z,]+)/i);
      if (m) {
        const areas = m[1].split(",").filter(Boolean);
        if (areas.length) {
          window.dispatchEvent(
            new CustomEvent("pf-data-changed", { detail: { areas } })
          );
        }
      }

      const clean = acc.replace(MARKER, "");
      if (!clean.trim()) {
        setMessages((prev) => prev.slice(0, -1));
        setError("A Gaia não respondeu. Tente novamente.");
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

  useEffect(() => {
    const aoRolar = () => {
      const y = window.scrollY;
      const desceu = y > ultimoY.current + 4;
      const subiu = y < ultimoY.current - 4;
      if (desceu && y > 160) setEscondido(true);
      else if (subiu || y <= 160) setEscondido(false);
      ultimoY.current = y;
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <>
      {/* Botão flutuante (balãozinho).

          Celular (< lg): ENCAIXADO na borda de cima da barra de baixo, à
          direita, com 44×44 px. Antes flutuava a 80 px do fundo, com 56 px,
          em cima do conteúdo: em 390 px cortava o "Registrar" da aplicação
          ("Regis") e cobria o "ver em Meu plano" da Dieta, e um toque ali
          abria a Gaia em vez da ação. A geometria, em 390 px (a barra tem
          61,5 px: 1 de borda, 10 de folga, 22 do ícone, 2 de vão, 16,5 do
          rótulo e 10 de folga, e o "Mais" é a última célula, de 65 px):
          - o balão afunda 10 px na barra, que é a borda (1) mais 9 dos 10 px
            de folga em cima dos ícones. O ícone do "Mais" começa a 11 px da
            borda, então a caixa do balão para 1 px antes dele (a olho são
            ~5,6 px, porque o traço de cima do ícone Menu desenha 4,6 px
            abaixo do topo da caixa). O rótulo começa a 35 px: longe. O ponto
            de novidade do "Mais", quando há, começa a 9 px da borda e fica a
            2,4 px do círculo (só o canto vazio da caixa o cruza);
          - sobram 51,5 px de altura × 65 de largura do "Mais" sem balão
            nenhum por cima (≥ 44×44), e o "Hábitos" não encosta no balão
            (o balão começa em x=330 e a célula dele acaba em 325). Como a
            separação é vertical, vale em qualquer largura (a 320 px o balão
            invade 7 px da célula do "Hábitos", só nos 10 de cima);
          - o balão fica a 16 px da borda direita, na margem da página, e
            sobe só 34 px acima da barra (44 − 10), o que cabe nos 50,5 px
            que o `main` deixa embaixo (pb-28 − a barra), então no fim da
            página ele não cobre a última linha;
          - 10 px e não 8: com 8, o topo do balão (746,5 px) entrava 1,5 px
            no "Registrar" da Início (que acaba em 748 px em 390×844). Em 10
            ele fica a 748,5. Subir para 11 já encostaria no ícone do "Mais".
          `bottom` é a altura da barra mais a safe area menos esses 10 px, a
          mesma conta do AppShell (`--barra-h` + `env(safe-area-inset-bottom)`),
          e não um número solto que só valesse sem o recorte do aparelho.
          Computador (≥ lg): como era, 56 px em bottom-6 right-6. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir a Gaia"
          className={`fixed bottom-[calc(var(--barra-h)_+_env(safe-area-inset-bottom)_-_10px)] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-app-primaria text-app-sobre-primaria transition duration-200 hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6 lg:h-14 lg:w-14 ${
            escondido
              ? "pointer-events-none translate-y-24 opacity-0 focus-visible:translate-y-0 focus-visible:opacity-100"
              : "translate-y-0 opacity-100"
          }`}
        >
          <Leaf className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>
      )}

      {/* Painel do chat. No celular ele acaba 80 px acima do fundo, como era
          com o `bottom-20`: 61,5 da barra e 18,5 de vão, mais a safe area (a
          barra engorda com ela). O balão some enquanto o painel está aberto
          (`!open` acima), então um não cobre o outro. */}
      {open && (
        <div className="fixed inset-x-2 bottom-[calc(var(--barra-h)_+_env(safe-area-inset-bottom)_+_18.5px)] top-16 z-50 flex flex-col overflow-hidden rounded-[14px] border border-app-linha bg-app-cartao shadow-2xl sm:inset-x-auto sm:right-4 sm:top-auto sm:h-[70vh] sm:max-h-[640px] sm:w-[400px] lg:bottom-6 lg:right-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-2 border-b border-app-linha bg-app-cartao px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="icon-badge">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold leading-tight text-app-texto">Gaia</p>
                <p className="text-[13px] text-app-texto-2">Sua companheira de saúde</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="-my-1.5 -mr-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 transition hover:bg-app-primaria-fundo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-app-pagina p-3"
          >
            {messages.length === 0 && (
              <div>
                <div className="rounded-xl border border-app-linha bg-app-cartao p-3 text-sm text-app-texto-2">
                  <p className="font-medium text-app-texto">
                    Oi, eu sou a Gaia 🌱
                  </p>
                  <p className="mt-1">
                    Sua companheira de saúde. Pergunte sobre dieta, treino,
                    hábitos e exames — e peça para eu registrar direto no app
                    (treino, refeição, água, peso, exames e a dose da caneta).
                  </p>
                </div>
                <p className="mb-1.5 mt-3 flex items-center gap-1 text-[13px] font-medium text-app-texto-2">
                  <Sparkles className="h-3 w-3" /> Sugestões
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-lg border border-app-linha bg-app-cartao px-3 py-2 text-left text-[13px] text-app-texto transition hover:border-app-campo hover:bg-app-primaria-fundo"
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
                      ? "bg-app-linha text-app-texto-2"
                      : "bg-app-primaria-fundo text-app-primaria"
                  }`}
                >
                  {m.role === "user" ? (
                    <UserIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Leaf className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-app-primaria text-app-sobre-primaria"
                      : "border border-app-linha bg-app-cartao text-app-texto"
                  }`}
                >
                  {m.content ||
                    (loading && i === messages.length - 1 ? (
                      <Loader2 className="h-4 w-4 animate-spin text-app-texto-2" />
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            ))}

            {error && (
              <p className="rounded-lg bg-app-perigo-fundo px-3 py-2 text-[13px] text-app-perigo">
                {error}
              </p>
            )}
          </div>

          {/* Entrada */}
          <div className="flex items-end gap-2 border-t border-app-linha bg-app-cartao p-2.5">
            <textarea
              className="input max-h-24 min-h-[44px] flex-1 resize-none py-2 text-sm"
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
              className="btn-primary h-11 w-11 shrink-0 justify-center px-0"
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
