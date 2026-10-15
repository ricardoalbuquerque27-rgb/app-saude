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

// Check-in do treino planejado, para o paciente. Aparece no "Para hoje" da
// Início (compacto) e na leitura do treino. Sem marcação = "sem resposta";
// tocar de novo no mesmo botão desfaz.
//
// `compact` é a linha do "Para hoje": cada sessão é um <li> da lista do
// cartão, com o nome, "{categoria} · do seu nutricionista" (ou "· seu
// treino") e os botões à direita. O treino do nutricionista pede "Fui" e "Não
// fui", porque ele quer distinguir quem faltou de quem só não marcou; o do
// próprio paciente pede só "Fiz" (spec "Início (paciente)", item 3). A
// gravação é a mesma nos dois.
export default function PlanCheckIn({
  sessions,
  date,
  completions,
  compact = false,
  nota = true,
  doNutri = true,
}: {
  sessions: PlanSession[];
  date: string;
  completions: Completion[];
  compact?: boolean;
  /** A explicação do check-in só precisa aparecer uma vez por tela. */
  nota?: boolean;
  /** Só no compacto: a sessão foi prescrita pelo nutricionista (vínculo ativo). */
  doNutri?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Em qual sessão a gravação falhou: no compacto cada sessão é uma linha, e o
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

  if (compact) {
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
          // Apertado é sólido; solto é o secundário. "Não fui" apertado fica
          // no tom de aviso, e não em verde: verde diria que faltar foi bom.
          const botao = (apertado: boolean, aviso = false) =>
            `tappable inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-60 ${
              apertado
                ? aviso
                  ? "border border-app-atencao bg-app-atencao-fundo text-app-atencao"
                  : "bg-app-primaria text-app-sobre-primaria"
                : "border border-app-campo bg-app-cartao text-app-texto hover:bg-app-primaria-fundo"
            }`;
          return (
            <li key={s.id} className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                {/* O nome leva à leitura do treino; os botões ficam aqui, porque
                    confirmar é a ação de um toque. */}
                <Link
                  href={`/app/treino/${s.id}`}
                  className="tappable min-w-0 flex-1 rounded-lg"
                >
                  <span className="block text-[15px] font-semibold text-app-texto">{nome}</span>
                  <span className="block text-[13px] text-app-texto-2">{apoio}</span>
                </Link>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => mark(s, "done")}
                    disabled={loading}
                    aria-pressed={done}
                    className={`${botao(done)} ${pop === s.id && done ? "pf-pop" : ""}`}
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
                      className={`${botao(skipped, true)} ${pop === s.id && skipped ? "pf-pop" : ""}`}
                    >
                      Não fui
                    </button>
                  )}
                </div>
              </div>
              {nota && i === primeiroSemResposta && !current && (
                <p className="mt-2 text-[13px] text-app-texto-2">
                  Seu nutricionista vê essa confirmação.
                </p>
              )}
              {erro && erroEm === s.id && (
                <p className="mt-2 text-[13px] text-app-perigo">{erro}</p>
              )}
            </li>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s, i) => {
        const current = idx[completionKey(s.id, date)];
        const done = current?.status === "done";
        const skipped = current?.status === "skipped";
        const loading = busy === s.id;

        return (
          <div
            key={s.id}
            className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.07] dark:bg-slate-900/70"
          >
            {/* O cabeçalho leva para a tela do treino, onde os exercícios
                cabem com tipografia de ler em pé. Os botões de check-in
                continuam aqui: confirmar é a ação de um toque, e não deve
                exigir abrir outra tela. */}
            <Link
              href={`/app/treino/${s.id}`}
              className="tappable group -m-1 flex items-start gap-2 rounded-lg p-1 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="min-w-0 flex-1">
                <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {s.sport}
                </span>
                {s.title && (
                  <span className="mt-1 block text-sm font-medium text-slate-800 dark:text-slate-200">
                    {s.title}
                  </span>
                )}
              </span>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700 dark:group-hover:text-brand-400" />
            </Link>

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => mark(s, "done")}
                disabled={loading}
                aria-pressed={done}
                className={`tappable flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  pop === s.id && done ? "pf-pop" : ""
                } ${
                  done
                    ? "bg-brand-700 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
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
                className={`tappable flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  pop === s.id && skipped ? "pf-pop" : ""
                } ${
                  skipped
                    ? "bg-rose-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-rose-400 hover:text-rose-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-rose-500 dark:hover:text-rose-300"
                }`}
              >
                <X className="h-3.5 w-3.5" />
                {skipped ? "Não fui" : "Não fui"}
              </button>
            </div>

            {nota && i === primeiroSemResposta && !current && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Seu nutricionista vê essa confirmação.
              </p>
            )}
          </div>
        );
      })}
      {erro && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}
    </div>
  );
}
