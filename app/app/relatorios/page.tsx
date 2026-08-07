"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ListChecks,
  Loader2,
  BarChart3,
  History,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui";

type Improve = { area: string; observacao: string; sugestao: string };
type Report = {
  resumo: string;
  pontos_fortes: string[];
  a_melhorar: Improve[];
  padroes_a_evitar: string[];
  proximos_passos: string[];
};
type ReportRow = { id: string; created_at: string; content: Report };

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RelatoriosPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("reports")
      .select("id, created_at, content")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as ReportRow[];
    setReports(rows);
    setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    setLoadingList(false);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/report", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Falha ao gerar o relatório.");
        return;
      }
      // Recarrega e seleciona o mais novo
      const { data: rows } = await supabase
        .from("reports")
        .select("id, created_at, content")
        .order("created_at", { ascending: false });
      const list = (rows ?? []) as unknown as ReportRow[];
      setReports(list);
      setSelectedId(list[0]?.id ?? null);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function removeReport(id: string) {
    if (!confirm("Excluir este relatório do histórico?")) return;
    await supabase.from("reports").delete().eq("id", id);
    setReports((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setSelectedId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }

  const current = reports.find((r) => r.id === selectedId) ?? null;
  const report = current?.content ?? null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Análise da sua evolução com sugestões da IA."
        action={
          <button onClick={generate} disabled={generating} className="btn-primary">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar relatório
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {generating && (
        <div className="card mb-6 flex flex-col items-center py-16 text-center">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-brand-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Analisando seus dados… isso leva alguns segundos.
          </p>
        </div>
      )}

      {!generating && !loadingList && reports.length === 0 && (
        <div className="card flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <BarChart3 className="h-7 w-7" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Seu relatório inteligente
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            A IA analisa seus treinos, dieta, hábitos, medidas e exames dos últimos
            30 dias e traz pontos fortes, o que melhorar e padrões a evitar. Cada
            relatório fica salvo no histórico para você comparar sua evolução.
          </p>
          <button onClick={generate} className="btn-primary mt-5 px-5 py-2.5">
            <Sparkles className="h-4 w-4" /> Gerar relatório
          </button>
        </div>
      )}

      {!generating && reports.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Relatório selecionado */}
          <div className="space-y-6 lg:col-span-2">
            {report && (
              <>
                {current && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-slate-400">
                      Relatório de {formatDateTime(current.created_at)}
                    </p>
                    <span className="chip">Últimos 30 dias</span>
                  </div>
                )}

                {report.resumo && (
                  <div className="card bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/20 dark:to-slate-900">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                          Resumo
                        </p>
                        <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                          {report.resumo}
                        </p>
                      </div>
                    </div>
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
              </>
            )}
          </div>

          {/* Histórico */}
          <div className="lg:col-span-1">
            <div className="card lg:sticky lg:top-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <History className="h-5 w-5 text-slate-400" /> Histórico
              </h2>
              <div className="space-y-2">
                {reports.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                        active
                          ? "border-brand-400 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-950/30"
                          : "border-slate-200 hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedId(r.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatDateTime(r.created_at)}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {r.content?.resumo || "Relatório"}
                        </p>
                      </button>
                      <button
                        onClick={() => removeReport(r.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
