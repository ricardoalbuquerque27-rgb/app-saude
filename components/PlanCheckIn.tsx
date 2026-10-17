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

// O check-in tem UMA regra, igual nas três telas que o mostram (o "Para hoje"
// da Início, a leitura do treino em `treino/[id]` e a semana de Treinos), e
// ela mora só aqui, em `BotoesDoCheckIn`:
//
//   estado         "Fui" ("Fiz" no treino próprio)          "Não fui" (no prescrito, ou já gravado)
//   sem resposta   sólido (o primário)                      secundário
//   feito          confirmado: fundo da principal, check     secundário
//                  e o rótulo "Feito"
//   não fui        secundário                               aviso, com "Não fui"
//
// Antes eram três regras: o mesmo "Fui" sólido queria dizer "sem resposta" na
// Início e na leitura do treino e "respondido" na semana de Treinos; o "Não
// fui" marcado era âmbar num lado e rosa sólido no outro; o treino próprio
// tinha "Fiz" na Início e "Fui/Não fui" em Treinos; e, na linha da Início, o
// confirmado e o sem resposta só se distinguiam por um ícone. O aviso é âmbar,
// e não verde, porque verde diria que faltar foi bom.
//
// No treino próprio, o "Não fui" só aparece quando já está gravado: a semana de
// Treinos oferecia "Não fui" a todo treino, e a sessão do nutri que o paciente
// desvinculou fica como própria. Sem ele, a resposta gravada virava um "Fiz"
// secundário sem nada dizendo que ele não foi, e não havia como desfazê-la.
const SOLIDO = "bg-app-primaria text-app-sobre-primaria hover:[filter:brightness(0.94)]";
const CONFIRMADO = "bg-app-primaria-fundo text-app-primaria";
const SECUNDARIO = "border border-app-campo bg-app-cartao text-app-texto hover:bg-app-primaria-fundo";
const AVISO = "border border-app-atencao bg-app-atencao-fundo text-app-atencao";
// 44 px em todas as telas: é a ação de um toque (o "Fui" da Início tinha 40).
const BOTAO =
  "tappable inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-semibold disabled:opacity-60";

/**
 * Os botões do check-in de uma sessão, com a regra acima. `doNutri` é a sessão
 * prescrita pelo nutricionista com vínculo ativo (`prescribed_by` e o vínculo,
 * como em `montarParaHoje`): ela tem "Fui" e "Não fui". A do próprio paciente
 * tem só "Fiz": "não fui" é uma resposta para o nutricionista, e sem vínculo
 * ninguém a lê (o "Não fui" só aparece nela já gravado, para ser desfeito).
 * `esticar` divide a largura entre os botões (a leitura do treino e a semana
 * de Treinos).
 */
export function BotoesDoCheckIn({
  status,
  doNutri,
  ocupado,
  pop = false,
  esticar = false,
  onMarcar,
}: {
  /** A resposta gravada: "done", "skipped" ou nenhuma. */
  status: CheckStatus | null;
  doNutri: boolean;
  /** Qual resposta está sendo gravada agora (desliga os dois botões). */
  ocupado: CheckStatus | null;
  /** A resposta acabou de ser salva: o "pop" de confirmação. */
  pop?: boolean;
  esticar?: boolean;
  onMarcar: (status: CheckStatus) => void;
}) {
  const feito = status === "done";
  const naoFui = status === "skipped";
  // Esticado, cada botão fica com metade da largura: no cartão do dia de
  // Treinos em três colunas (1280 px) sobram ~91 px, e "✕ Não fui" com o
  // `px-3` de linha quebrava em duas linhas ("✕ Não / fui").
  const forma = esticar ? "min-w-0 flex-1 gap-1 px-2" : "gap-1.5 px-3";
  const girando = <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  return (
    <>
      <button
        type="button"
        onClick={() => onMarcar("done")}
        disabled={ocupado !== null}
        aria-pressed={feito}
        className={`${BOTAO} ${forma} ${feito ? CONFIRMADO : naoFui ? SECUNDARIO : SOLIDO} ${
          pop && feito ? "pf-pop" : ""
        }`}
      >
        {ocupado === "done" ? girando : feito ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
        {feito ? "Feito" : doNutri ? "Fui" : "Fiz"}
      </button>
      {(doNutri || naoFui) && (
        <button
          type="button"
          onClick={() => onMarcar("skipped")}
          disabled={ocupado !== null}
          aria-pressed={naoFui}
          className={`${BOTAO} ${forma} ${naoFui ? AVISO : SECUNDARIO} ${pop && naoFui ? "pf-pop" : ""}`}
        >
          {ocupado === "skipped" ? girando : naoFui ? <X className="h-4 w-4" aria-hidden="true" /> : null}
          Não fui
        </button>
      )}
    </>
  );
}

/** A resposta gravada numa completion, do jeito que `BotoesDoCheckIn` a recebe. */
export function statusDoCheckIn(c: Completion | undefined | null): CheckStatus | null {
  return c?.status === "done" ? "done" : c?.status === "skipped" ? "skipped" : null;
}

// Check-in do treino planejado, para o paciente. Aparece no "Para hoje" da
// Início (`linha`) e na leitura do treino (`compact`, só os botões); a semana
// de Treinos usa só os `BotoesDoCheckIn`. Sem marcação = "sem resposta"; tocar
// de novo no mesmo botão desfaz.
//
// `linha` é a forma da Início: cada sessão é um <li> da lista do cartão "Para
// hoje", com o nome, "{categoria} · do seu nutricionista" (ou "· seu treino")
// e os botões à direita. Mora numa prop própria, e não no `compact`, porque o
// `compact` é o da página do treino (app/app/treino/[id]): redesenhá-lo lá
// punha um <li> fora de lista e repetia o nome e a nota.
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
  /**
   * A sessão foi prescrita pelo nutricionista, com vínculo ativo: "Fui" e "Não
   * fui". Senão, só "Fiz".
   */
  doNutri?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  // Qual sessão grava, e qual resposta: o giro vai no botão que foi tocado.
  const [busy, setBusy] = useState<{ id: string; status: CheckStatus } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Em qual sessão a gravação falhou: na `linha` cada sessão é uma linha, e o
  // aviso vai na linha dela.
  const [erroEm, setErroEm] = useState<string | null>(null);
  // Guarda qual sessão acabou de ser salva, para dar o "pop" de confirmação.
  const [pop, setPop] = useState<string | null>(null);
  const idx = indexCompletions(completions);

  async function mark(session: PlanSession, status: CheckStatus) {
    setBusy({ id: session.id, status });
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
          const nome = s.title || s.sport || "Treino";
          const origem = doNutri ? "do seu nutricionista" : "seu treino";
          const apoio = s.title && s.sport ? `${s.sport} · ${origem}` : origem;
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
                  <BotoesDoCheckIn
                    status={statusDoCheckIn(current)}
                    doNutri={doNutri}
                    ocupado={busy?.id === s.id ? busy.status : null}
                    pop={pop === s.id}
                    onMarcar={(st) => mark(s, st)}
                  />
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
  // sessão (quem o usar o põe dentro de um `.card`).
  return (
    <div className={compact ? "" : "divide-y divide-app-linha"}>
      {sessions.map((s, i) => {
        const current = idx[completionKey(s.id, date)];

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
                  <span className="inline-block rounded-full bg-app-primaria-fundo px-2.5 py-0.5 text-[13px] font-semibold text-app-primaria">
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
              <BotoesDoCheckIn
                status={statusDoCheckIn(current)}
                doNutri={doNutri}
                ocupado={busy?.id === s.id ? busy.status : null}
                pop={pop === s.id}
                esticar
                onMarcar={(st) => mark(s, st)}
              />
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
