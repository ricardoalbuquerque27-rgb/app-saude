"use client";

import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ListChecks,
  Loader2,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/ui";

type Improve = { area: string; observacao: string; sugestao: string };
type Report = {
  resumo: string;
  pontos_fortes: string[];
  a_melhorar: Improve[];
  padroes_a_evitar: string[];
  proximos_passos: string[];
};

export default function RelatoriosPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Falha ao gerar o relatório.");
        return;
      }
      setReport(data as Report);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Análise da sua evolução com sugestões da IA."
        action={
          <button onClick={generate} disabled={loading} className="btn-primary">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {report ? "Atualizar" : "Gerar relatório"}
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!report && !loading && (
        <div className="card flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <BarChart3 className="h-7 w-7" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Seu relatório inteligente
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            A IA analisa seus treinos, dieta, hábitos, medidas e exames dos últimos
            30 dias e traz pontos fortes, o que melhorar e padrões a evitar.
          </p>
          <button
            onClick={generate}
            className="btn-primary mt-5 px-5 py-2.5"
          >
            <Sparkles className="h-4 w-4" /> Gerar relatório
          </button>
        </div>
      )}

      {loading && (
        <div className="card flex flex-col items-center py-16 text-center">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-brand-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Analisando seus dados… isso leva alguns segundos.
          </p>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-6">
          {report.resumo && (
            <div className="card border-brand-200 bg-brand-50/50 dark:border-brand-900/40 dark:bg-brand-950/20">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                <Sparkles className="h-3.5 w-3.5" /> Resumo
              </p>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {report.resumo}
              </p>
            </div>
          )}

          {report.pontos_fortes.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <TrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Pontos fortes
              </h2>
              <ul className="space-y-2">
                {report.pontos_fortes.map((p, i) => (
                  <li
                    key={i}
                    className="card flex items-start gap-3 py-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.a_melhorar.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                O que melhorar
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {report.a_melhorar.map((m, i) => (
                  <div key={i} className="card">
                    <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {m.area}
                    </span>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {m.observacao}
                    </p>
                    {m.sugestao && (
                      <p className="mt-2 border-t border-slate-100 pt-2 text-sm font-medium text-slate-800 dark:border-slate-800 dark:text-slate-200">
                        💡 {m.sugestao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.padroes_a_evitar.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Padrões a evitar
              </h2>
              <ul className="space-y-2">
                {report.padroes_a_evitar.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.proximos_passos.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <CheckCircle2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                Próximos passos
              </h2>
              <ol className="space-y-2">
                {report.proximos_passos.map((p, i) => (
                  <li
                    key={i}
                    className="card flex items-start gap-3 py-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            Análise gerada por IA a partir dos seus registros. Não substitui um
            profissional de saúde.
          </p>
        </div>
      )}
    </div>
  );
}
