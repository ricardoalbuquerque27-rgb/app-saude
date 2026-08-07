"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Upload,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/lib/types";
import {
  PageHeader,
  Modal,
  Field,
  EmptyState,
  formatDate,
} from "@/components/ui";
import { todayISO } from "@/lib/date";

const STATUS = [
  { value: "normal", label: "Normal", cls: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" },
  { value: "atencao", label: "Atenção", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "alterado", label: "Alterado", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

type ExamItem = {
  nome: string;
  valor?: string;
  unidade?: string;
  referencia?: string;
  status?: string;
};
type ExamAnalysis = {
  resumo: string;
  itens: ExamItem[];
  interpretacao: string[];
  recomendacoes: string[];
};

function fileToData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1600;
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            const scale = maxSide / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("img"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    }
  });
}

export default function ExamesPage() {
  const supabase = createClient();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [unit, setUnit] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("normal");
  const [notes, setNotes] = useState("");

  // Análise de exame por IA
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [savingItems, setSavingItems] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exams")
      .select("*")
      .order("date", { ascending: false });
    setExams((data ?? []) as Exam[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setDate(todayISO());
    setTitle("");
    setExamType("");
    setResultValue("");
    setUnit("");
    setReference("");
    setStatus("normal");
    setNotes("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("exams").insert({
      user_id: user.id,
      date,
      title: title.trim(),
      exam_type: examType.trim() || null,
      result_value: resultValue.trim() || null,
      unit: unit.trim() || null,
      reference_range: reference.trim() || null,
      status,
      notes: notes.trim() || null,
    });
    setSaving(false);
    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este exame?")) return;
    await supabase.from("exams").delete().eq("id", id);
    await load();
  }

  async function analyzeExam(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setSavedMsg(null);
    try {
      const data = await fileToData(file);
      const res = await fetch("/api/analyze-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: data }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAnalyzeError(json?.error ?? "Falha ao ler o exame.");
        return;
      }
      setAnalysis(json as ExamAnalysis);
    } catch {
      setAnalyzeError("Não foi possível processar o arquivo. Tente outro.");
    } finally {
      setAnalyzing(false);
    }
  }

  const statusCounts = {
    alterado: exams.filter((e) => e.status === "alterado").length,
    atencao: exams.filter((e) => e.status === "atencao").length,
    normal: exams.filter((e) => !e.status || e.status === "normal").length,
  };

  async function saveAnalysisItems() {
    if (!analysis?.itens?.length) return;
    setSavingItems(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingItems(false);
      return;
    }
    const today = todayISO();
    const rows = analysis.itens
      .filter((it) => it.nome)
      .map((it) => ({
        user_id: user.id,
        date: today,
        title: it.nome,
        exam_type: "Exame (IA)",
        result_value: it.valor ?? null,
        unit: it.unidade ?? null,
        reference_range: it.referencia ?? null,
        status: ["normal", "atencao", "alterado"].includes(it.status ?? "")
          ? (it.status as string)
          : "normal",
        notes: null,
      }));
    if (rows.length) await supabase.from("exams").insert(rows);
    setSavingItems(false);
    setSavedMsg(`${rows.length} item(ns) salvo(s) no histórico.`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Exames"
        subtitle="Guarde resultados e acompanhe seus indicadores."
        action={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Novo exame
          </button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={analyzeExam}
      />

      <div className="card mb-6 border-brand-200 bg-brand-50/50 dark:border-brand-900/40 dark:bg-brand-950/20">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              Ler exame com IA
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Envie o PDF ou uma foto do exame. A IA lê, explica em linguagem
              simples e destaca o que está fora da referência.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="btn-primary mt-3"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {analyzing ? "Lendo exame…" : "Enviar PDF ou foto"}
            </button>
          </div>
        </div>

        {analyzeError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {analyzeError}
          </p>
        )}

        {analysis && (
          <div className="mt-4 space-y-4 border-t border-brand-200/60 pt-4 dark:border-brand-900/30">
            {analysis.resumo && (
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {analysis.resumo}
              </p>
            )}

            {analysis.itens.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Resultados
                </p>
                <div className="space-y-1.5">
                  {analysis.itens.map((it, i) => {
                    const st =
                      STATUS.find((s) => s.value === it.status) ?? STATUS[0];
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {it.nome}
                          </span>
                          {(it.valor || it.unidade) && (
                            <span className="text-slate-600 dark:text-slate-400">
                              {" "}
                              — {it.valor}
                              {it.unidade ? ` ${it.unidade}` : ""}
                            </span>
                          )}
                          {it.referencia && (
                            <span className="text-slate-400">
                              {" "}
                              (ref.: {it.referencia})
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {analysis.interpretacao.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  O que significa
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.interpretacao.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recomendacoes.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recomendações
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.recomendacoes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {analysis.itens.length > 0 && (
                <button
                  onClick={saveAnalysisItems}
                  disabled={savingItems}
                  className="btn-ghost"
                >
                  {savingItems ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar no histórico
                </button>
              )}
              {savedMsg && (
                <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                  {savedMsg}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Leitura automática por IA — pode conter erros e não substitui a
              avaliação de um médico.
            </p>
          </div>
        )}
      </div>

      {!loading && exams.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="card py-3 text-center">
            <p className="tabular text-2xl font-bold text-rose-600 dark:text-rose-400">
              {statusCounts.alterado}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Alterados</p>
          </div>
          <div className="card py-3 text-center">
            <p className="tabular text-2xl font-bold text-amber-600 dark:text-amber-400">
              {statusCounts.atencao}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Em atenção</p>
          </div>
          <div className="card py-3 text-center">
            <p className="tabular text-2xl font-bold text-brand-600 dark:text-brand-400">
              {statusCounts.normal}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Normais</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Nenhum exame registrado"
          description="Adicione resultados de exames de sangue, indicadores e mais."
        />
      ) : (
        <div className="space-y-3">
          {exams.map((ex) => {
            const st = STATUS.find((s) => s.value === ex.status) ?? STATUS[0];
            const key = st.value;
            const accent =
              key === "alterado"
                ? "border-l-rose-400 dark:border-l-rose-500/70"
                : key === "atencao"
                  ? "border-l-amber-400 dark:border-l-amber-500/70"
                  : "border-l-brand-400 dark:border-l-brand-500/70";
            const iconTint =
              key === "alterado"
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                : key === "atencao"
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300";
            return (
              <div
                key={ex.id}
                className={`card flex items-start gap-3 border-l-4 ${accent}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTint}`}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {ex.title}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(ex.date)}
                    {ex.exam_type ? ` · ${ex.exam_type}` : ""}
                  </p>
                  {ex.result_value && (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">
                        {ex.result_value}
                        {ex.unit ? ` ${ex.unit}` : ""}
                      </span>
                      {ex.reference_range && (
                        <span className="text-slate-400">
                          {" "}
                          (ref.: {ex.reference_range})
                        </span>
                      )}
                    </p>
                  )}
                  {ex.notes && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {ex.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(ex.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Novo exame"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Tipo">
              <input
                className="input"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                placeholder="Sangue, imagem..."
              />
            </Field>
          </div>
          <Field label="Nome do exame / indicador">
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Colesterol total, Glicemia..."
              required
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Resultado">
              <input
                className="input"
                value={resultValue}
                onChange={(e) => setResultValue(e.target.value)}
                placeholder="180"
              />
            </Field>
            <Field label="Unidade">
              <input
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mg/dL"
              />
            </Field>
            <Field label="Referência">
              <input
                className="input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="< 200"
              />
            </Field>
          </div>
          <Field label="Situação">
            <div className="flex gap-2">
              {STATUS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    status === s.value
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Observações">
            <textarea
              className="input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações, orientações do médico..."
            />
          </Field>
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar exame
          </button>
        </form>
      </Modal>
    </div>
  );
}
