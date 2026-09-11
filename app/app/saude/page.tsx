"use client";

import { formatDate } from "@/lib/date";
import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  HeartPulse,
  Target,
  Check,
  FileText,
  Salad,
  Dumbbell,
  Droplets,
  Syringe,
  Scale,
  Activity,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Insight = {
  area: string;
  severidade: "bom" | "atencao" | "alerta" | string;
  titulo: string;
  observacao: string;
  conexao: string;
  acao: string;
};
type Analysis = {
  resumo: string;
  prioridades: string[];
  insights: Insight[];
  pontos_fortes: string[];
};
type Row = { id: string; created_at: string; content: Analysis };

const AREA_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Exames: FileText,
  Dieta: Salad,
  Treino: Dumbbell,
  "Hábitos": Droplets,
  Tratamento: Syringe,
  Peso: Scale,
  Geral: Activity,
};

const SEV = {
  bom: {
    ring: "border-brand-200 dark:border-brand-900/50",
    chip: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
    icon: "text-brand-600 dark:text-brand-400",
  },
  atencao: {
    ring: "border-amber-200 dark:border-amber-900/50",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  alerta: {
    ring: "border-rose-200 dark:border-rose-900/50",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
  },
} as const;

function sevStyle(s: string) {
  return SEV[s as keyof typeof SEV] ?? SEV.atencao;
}

export default function SaudePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("health_insights")
      .select("id, created_at, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data as Row[]) ?? [];
    setRows(list);
    setCurrent(list[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível gerar a análise.");
        return;
      }
      const row: Row = {
        id: data.id,
        created_at: data.created_at,
        content: {
          resumo: data.resumo,
          prioridades: data.prioridades ?? [],
          insights: data.insights ?? [],
          pontos_fortes: data.pontos_fortes ?? [],
        },
      };
      setRows((prev) => [row, ...prev]);
      setCurrent(row);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  const a = current?.content;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Inteligência de Saúde"
        subtitle="A IA conecta seus exames, dieta, treino e hábitos e mostra o que importa."
      />

      <button
        onClick={generate}
        disabled={generating}
        className="btn-primary w-full py-3"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando seus dados…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {rows.length ? "Gerar nova análise" : "Gerar minha análise"}
          </>
        )}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !a ? (
        <div className="card flex flex-col items-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <HeartPulse className="h-6 w-6" />
          </div>
          <p className="font-medium text-slate-900 dark:text-white">
            Nenhuma análise ainda
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Toque em “Gerar minha análise” para a IA cruzar seus dados e revelar
            conexões entre eles.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {current && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Análise de {formatDate(current.created_at.slice(0, 10))}
            </p>
          )}

          {/* Resumo */}
          {a.resumo && (
            <div className="card bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/20 dark:to-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200">{a.resumo}</p>
              </div>
            </div>
          )}

          {/* Prioridades */}
          {a.prioridades?.length > 0 && (
            <div className="card">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Prioridades agora
                </h2>
              </div>
              <ol className="space-y-2">
                {a.prioridades.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Insights conectados */}
          {a.insights?.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Conexões encontradas
              </h2>
              {a.insights.map((ins, i) => {
                const Icon = AREA_ICON[ins.area] ?? Activity;
                const st = sevStyle(ins.severidade);
                return (
                  <div key={i} className={`card border ${st.ring}`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 shrink-0 ${st.icon}`} />
                      <h3 className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {ins.titulo}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.chip}`}>
                        {ins.area}
                      </span>
                    </div>
                    {ins.observacao && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {ins.observacao}
                      </p>
                    )}
                    {ins.conexao && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          <b className="font-medium text-slate-600 dark:text-slate-300">
                            Conexão:
                          </b>{" "}
                          {ins.conexao}
                        </span>
                      </p>
                    )}
                    {ins.acao && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {ins.acao}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pontos fortes */}
          {a.pontos_fortes?.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">
                O que já está indo bem 🎉
              </h2>
              <ul className="space-y-1.5">
                {a.pontos_fortes.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Histórico */}
          {rows.length > 1 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Análises anteriores
              </h2>
              <div className="flex flex-wrap gap-2">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setCurrent(r)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      current?.id === r.id
                        ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                    }`}
                  >
                    {formatDate(r.created_at.slice(0, 10))}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Esta análise é educativa e não substitui um profissional de saúde. Para
        exames alterados ou dúvidas sobre medicação, procure seu médico.
      </p>
    </div>
  );
}
