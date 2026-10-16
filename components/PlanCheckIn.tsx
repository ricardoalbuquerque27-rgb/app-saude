"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  setPlanCheck,
  indexCompletions,
  completionKey,
  type CheckStatus,
  type Completion,
  type PlanSession,
} from "@/lib/planCheckIn";

// Os três estilos de botão do check-in, iguais nas três formas (linha, compacta
// e padrão): "Fui" é o primário (sólido) e "Não fui" o secundário. Depois de
// responder, o sólido fica com a resposta; "Não fui" marcado vai para o tom de
// aviso (verde diria que faltar foi bom) e "Fui" volta a secundário.
const SOLIDO = "bg-app-primaria text-app-sobre-primaria hover:[filter:brightness(0.94)]";
const SECUNDARIO = "border border-app-campo bg-app-cartao text-app-texto hover:bg-app-primaria-fundo";
const AVISO = "border border-app-atencao bg-app-atencao-fundo text-app-atencao";

// Check-in do treino planejado, para o paciente. Aparece no "Para hoje" da
// Início (`linha`), na leitura do treino (`compact`, só os botões) e na aba
// Plano. Sem marcação = "sem resposta"; tocar de novo no mesmo botão desfaz.
//
// `linha` é a forma da Início: cada sessão é um <li> da lista do cartão "Para
// hoje", com o nome, "{categoria} · do seu nutricionista" (ou "· seu treino")
// e os botões à direita. Mora numa prop própria, e não no `compact`, porque o
// `compact` é o da página do treino (app/app/treino/[id]): redesenhá-lo lá
// punha um <li> fora de lista, repetia o nome e a nota e dava "Fui/Não fui"
// ao treino do próprio paciente.
export default function PlanCheckIn({
  sessions,
  date,
  completions,
  compact = false,
  nota = true,
  linha = false,
  doNutri = true,
}: {
  sessions: PlanSession[];
  date: string;
  completions: Completion[];
  compact?: boolean;
  /** A explicação do check-in só precisa aparecer uma vez por tela. */
  nota?: boolean;
  /** A forma de linha do "Para hoje" da Início (só dentro de um <ul>). */
  linha?: boolean;
  /** Só na `linha`: a sessão foi prescrita pelo nutricionista (vínculo ativo). */
  doNutri?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Em qual sessão a gravação falhou: na `linha` cada sessão é uma linha, e o
  // aviso vai na linha dela.
  const [erroEm, setErroEm] = useState<string | null>(null);
  // Guarda qual sessão acabou de ser salva, para dar o "pop" de confirmação.
  const [pop, setPop] = useState<string | null>(null);
  const idx = indexCompletions(completions);

  async function mark(session: PlanSession, status: CheckStatus) {
    setBusy(session.id);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      return;
    }
    const current = idx[completionKey(session.id, date)] ?? null;
    // Tocar no botão já ativo desfaz a marcação.
    const next: CheckStatus | null = current?.status === status ? null : status;

    const { error } = await setPlanCheck(
      supabase,
      user.id,
      session,
      date,
      next,
      current
    );
    setBusy(null);
    if (error) {
      setErro("Não foi possível salvar. Tente de novo.");
      setErroEm(session.id);
      return;
    }
    if (next !== null) {
      setPop(session.id);
      setTimeout(() => setPop(null), 400);
    }
    window.dispatchEvent(
      new CustomEvent("pf-data-changed", { detail: { areas: ["treinos"] } })
    );
    router.refresh();
  }

  if (sessions.length === 0) return null;

  // A nota explica o mecanismo do check-in: vale uma vez por tela, e só faz
  // sentido junto de um treino que ainda PRECISA de resposta. Prender ao
  // índice 0 escondia a nota quando o primeiro já estava respondido e o
  // segundo não.
  const primeiroSemResposta = sessions.findIndex(
    (s) => !idx[completionKey(s.id, date)]
  );

  if (linha) {
    return (
      <>
        {sessions.map((s, i) => {
          const current = idx[completionKey(s.id, date)];
          const done = current?.status === "done";
          const skipped = current?.status === "skipped";
          const loading = busy === s.id;
          const nome = s.title || s.sport || "Treino";
          const origem = doNutri ? "do seu nutricionista" : "seu treino";
          const apoio = s.title && s.sport ? `${s.sport} · ${origem}` : origem;
          // A hierarquia da maquete (estilos no topo do arquivo). O "Fiz" do
          // treino próprio é secundário até ser marcado, como na maquete.
          const BASE =
            "tappable inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-60";
          const estiloFeito = doNutri ? (skipped ? SECUNDARIO : SOLIDO) : done ? SOLIDO : SECUNDARIO;
          return (
            <li key={s.id} className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                {/* O nome leva à leitura do treino; os botões ficam aqui, porque
                    confirmar é a ação de um toque. */}
                <Link href={`/app/treino/${s.id}`} className="tappable min-w-0 flex-1 rounded-lg">
                  <span className="block text-[15px] font-semibold text-app-texto">{nome}</span>
                  <span className="block text-[13px] text-app-texto-2">{apoio}</span>
                </Link>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => mark(s, "done")}
                    disabled={loading}
                    aria-pressed={done}
                    className={`${BASE} ${estiloFeito} ${pop === s.id && done ? "pf-pop" : ""}`}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : done ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : null}
                    {doNutri ? "Fui" : "Fiz"}
                  </button>
                  {doNutri && (
                    <button
                      type="button"
                      onClick={() => mark(s, "skipped")}
                      disabled={loading}
                      aria-pressed={skipped}
                      className={`${BASE} ${skipped ? AVISO : SECUNDARIO} ${pop === s.id && skipped ? "pf-pop" : ""}`}
                    >
                      {skipped && <X className="h-4 w-4" aria-hidden="true" />}
                      Não fui
                    </button>
                  )}
                </div>
              </div>
              {nota && i === primeiroSemResposta && !current && (
                <p className="mt-2 text-[13px] text-app-texto-2">Seu nutricionista vê essa confirmação.</p>
              )}
              {erro && erroEm === s.id && <p className="mt-2 text-[13px] text-app-perigo">{erro}</p>}
            </li>
          );
        })}
      </>
    );
  }

  // Compacta (leitura do treino) e padrão. O padrão não tem tela hoje, mas
  // segue a mesma linguagem: sessões separadas por traço, sem um cartão por
  // sessão (quem o usar o põe dentro de um `.card`). Os botões têm 44 px nas
  // duas: é a ação de um toque, e o `py-1.5` de antes dava ~30 px.
  const BOTAO =
    "tappable flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold disabled:opacity-60";

  return (
    <div className={compact ? "" : "divide-y divide-app-linha"}>
      {sessions.map((s, i) => {
        const current = idx[completionKey(s.id, date)];
        const done = current?.status === "done";
        const skipped = current?.status === "skipped";
        const loading = busy === s.id;

        return (
          <div
            key={s.id}
            className={compact ? "mt-2 flex gap-1.5" : "py-3 first:pt-0 last:pb-0"}
          >
            {/* O cabeçalho leva para a tela do treino, onde os exercícios
                cabem com tipografia de ler em pé. Os botões de check-in
                continuam aqui: confirmar é a ação de um toque, e não deve
                exigir abrir outra tela. */}
            {!compact && (
              <Link
                href={`/app/treino/${s.id}`}
                className="tappable group -m-1 flex min-h-[44px] items-start gap-2 rounded-lg p-1 hover:bg-app-primaria-fundo"
              >
                <span className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-app-primaria-fundo px-2.5 py-0.5 text-[11px] font-semibold text-app-primaria">
                    {s.sport}
                  </span>
                  {s.title && (
                    <span className="mt-1 block text-sm font-medium text-app-texto">
                      {s.title}
                    </span>
                  )}
                </span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-app-texto-2 transition group-hover:translate-x-0.5 group-hover:text-app-primaria" />
              </Link>
            )}

            <div className={compact ? "flex w-full gap-1.5" : "mt-2.5 flex gap-2"}>
              <button
                onClick={() => mark(s, "done")}
                disabled={loading}
                aria-pressed={done}
                className={`${BOTAO} ${done ? SOLIDO : SECUNDARIO} ${
                  pop === s.id && done ? "pf-pop" : ""
                }`}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {done ? "Fui treinar" : "Fui"}
              </button>
              <button
                onClick={() => mark(s, "skipped")}
                disabled={loading}
                aria-pressed={skipped}
                className={`${BOTAO} ${skipped ? AVISO : SECUNDARIO} ${
                  pop === s.id && skipped ? "pf-pop" : ""
                }`}
              >
                <X className="h-3.5 w-3.5" />
                Não fui
              </button>
            </div>

            {nota && i === primeiroSemResposta && !compact && !current && (
              <p className="mt-2 text-[13px] text-app-texto-2">
                Seu nutricionista vê essa confirmação.
              </p>
            )}
          </div>
        );
      })}
      {erro && <p className="pt-2 text-[13px] text-app-perigo">{erro}</p>}
    </div>
  );
}
