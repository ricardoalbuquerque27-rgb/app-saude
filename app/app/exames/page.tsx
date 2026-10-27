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
import { PageHeader, Modal, Field, EmptyState } from "@/components/ui";
import { todayISO, formatDate } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { linhaDoLaudo, type Sex } from "@/lib/examRanges";
import { exameParaGravar, notasDoExame } from "@/lib/exames";
import type { ItemTranscrito } from "@/lib/laudo";
import { meuPerfil } from "@/lib/perfil";
import OQueEOExame from "@/components/OQueEOExame";

function ageFromBirth(birth?: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 130 ? age : null;
}

// A leitura do laudo só transcreve (rota analyze-exam): sem resumo,
// interpretação, recomendação nem situação, que eram juízo para o paciente.
type ExamAnalysis = { itens: ItemTranscrito[] };

// O paciente vê onde o valor fica na faixa do laudo, e nada mais: sem selo de
// Normal, Atenção ou Alterado (spec do uso pretendido). Fora da faixa é aviso.
function LinhaDoLaudo({ valor, referencia }: { valor: unknown; referencia: unknown }) {
  const l = linhaDoLaudo(valor, referencia);
  return <p className={`text-xs ${l.fora ? "text-app-atencao" : "text-app-texto-2"}`}>{l.texto}</p>;
}

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
  const [notes, setNotes] = useState("");
  const [profileCtx, setProfileCtx] = useState<{ sex: Sex; age: number | null }>({
    sex: null,
    age: null,
  });

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

  // Recarrega quando a IA registra um exame.
  useLiveRefresh("exames", load);

  // Perfil (sexo/idade): o `status` gravado é o juízo da nutricionista, que
  // usa a tabela do app (com sexo e idade) quando o laudo não tem faixa.
  useEffect(() => {
    (async () => {
      const data = await meuPerfil(supabase, "sex, birth_date");
      setProfileCtx({
        sex: (data?.sex as Sex) ?? null,
        age: ageFromBirth(data?.birth_date),
      });
    })();
  }, [supabase]);

  function resetForm() {
    setDate(todayISO());
    setTitle("");
    setExamType("");
    setResultValue("");
    setUnit("");
    setReference("");
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
      ...exameParaGravar(
        { titulo: title, valor: resultValue, unidade: unit, referencia: reference, data: date, tipo: examType, notas: notes },
        profileCtx
      ),
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
        ...exameParaGravar(
          { titulo: it.nome, valor: it.valor, unidade: it.unidade, referencia: it.referencia, data: today, tipo: "Exame (IA)", notas: null },
          profileCtx
        ),
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

      <div className="card mb-6">
        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-app-texto">
              Ler exame com IA
            </p>
            <p className="mt-0.5 text-sm text-app-texto-2">
              Envie o PDF ou uma foto do exame. A IA copia os resultados e a
              faixa que o laudo traz.
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
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {analyzeError}
          </p>
        )}

        {analysis && (
          <div className="mt-4 space-y-4 border-t border-app-linha pt-4">
            {analysis.itens.length === 0 && (
              <p className="text-sm text-app-texto-2">
                Não deu para ler resultados neste arquivo. Tente uma foto mais nítida ou o PDF.
              </p>
            )}

            {analysis.itens.length > 0 && (
              <div>
                <p className="eyebrow mb-1">Resultados</p>
                <div className="divide-y divide-app-linha">
                  {analysis.itens.map((it, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p>
                          <span className="font-medium text-app-texto">{it.nome}</span>
                          {it.valor && (
                            <span className="tabular text-app-texto-2">
                              {" "}
                              — {it.valor}
                              {it.unidade ? ` ${it.unidade}` : ""}
                            </span>
                          )}
                        </p>
                        <LinhaDoLaudo valor={it.valor} referencia={it.referencia} />
                      </div>
                      <div className="shrink-0">
                        <OQueEOExame nome={it.nome} />
                      </div>
                    </div>
                  ))}
                </div>
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
                <span className="text-xs font-medium text-app-primaria">
                  {savedMsg}
                </span>
              )}
            </div>

            <p className="text-[11px] text-app-texto-2">
              Leitura automática por IA — pode conter erros e não substitui a
              avaliação de um médico.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-app-texto-2">
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
            const notas = notasDoExame(ex);
            return (
              <div
                key={ex.id}
                className="card flex items-start gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-primaria-fundo text-app-primaria">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-app-texto">{ex.title}</p>
                  <p className="tabular text-xs text-app-texto-2">
                    {formatDate(ex.date)}
                    {ex.exam_type ? ` · ${ex.exam_type}` : ""}
                  </p>
                  {ex.result_value && (
                    <p className="tabular mt-1 text-sm font-semibold text-app-texto">
                      {ex.result_value}
                      {ex.unit ? ` ${ex.unit}` : ""}
                    </p>
                  )}
                  <LinhaDoLaudo valor={ex.result_value} referencia={ex.reference_range} />
                  {notas && <p className="mt-1 text-xs text-app-texto-2">{notas}</p>}
                  <div className="mt-2">
                    <OQueEOExame nome={ex.title} />
                  </div>
                </div>
                <button
                  onClick={() => remove(ex.id)}
                  aria-label={`Excluir exame ${ex.title}`}
                  className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
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
                max={todayISO()}
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
          {resultValue.trim() && reference.trim() && (
            <div className="-mt-2">
              <LinhaDoLaudo valor={resultValue} referencia={reference} />
            </div>
          )}
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
