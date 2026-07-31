"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/lib/types";
import {
  PageHeader,
  Modal,
  Field,
  EmptyState,
  formatDate,
} from "@/components/ui";

const STATUS = [
  { value: "normal", label: "Normal", cls: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" },
  { value: "atencao", label: "Atenção", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "alterado", label: "Alterado", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

export default function ExamesPage() {
  const supabase = createClient();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [unit, setUnit] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("normal");
  const [notes, setNotes] = useState("");

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
    setDate(new Date().toISOString().slice(0, 10));
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
            return (
              <div key={ex.id} className="card flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
