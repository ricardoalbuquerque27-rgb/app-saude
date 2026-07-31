"use client";

import { useEffect, useState, useCallback } from "react";
import { Scale, Plus, Trash2, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BodyMeasurement } from "@/lib/types";
import {
  PageHeader,
  Modal,
  Field,
  EmptyState,
  formatDate,
} from "@/components/ui";
import { TrendChart } from "@/components/charts";

const FIELDS: { key: keyof BodyMeasurement; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "% Gordura", unit: "%" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "hip_cm", label: "Quadril", unit: "cm" },
  { key: "chest_cm", label: "Peito", unit: "cm" },
  { key: "arm_cm", label: "Braço", unit: "cm" },
  { key: "thigh_cm", label: "Coxa", unit: "cm" },
];

export default function MedidasPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metric, setMetric] = useState<keyof BodyMeasurement>("weight_kg");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .order("date", { ascending: false });
    setRows((data ?? []) as BodyMeasurement[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = asc
    .filter((r) => r[metric] != null)
    .map((r) => ({
      label: formatDate(r.date).slice(0, 5),
      value: Number(r[metric]),
    }));

  const latest = rows[0];
  const previous = rows[1];
  const currentWeight = latest?.weight_kg ?? null;
  const weightDiff =
    latest?.weight_kg != null && previous?.weight_kg != null
      ? Number(latest.weight_kg) - Number(previous.weight_kg)
      : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { user_id: user.id, date };
    FIELDS.forEach((f) => {
      const v = form[f.key as string];
      payload[f.key] = v ? Number(v) : null;
    });
    await supabase.from("body_measurements").insert(payload);
    setSaving(false);
    setOpen(false);
    setForm({});
    setDate(new Date().toISOString().slice(0, 10));
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este registro?")) return;
    await supabase.from("body_measurements").delete().eq("id", id);
    await load();
  }

  const metricLabel = FIELDS.find((f) => f.key === metric)?.label ?? "";
  const metricUnit = FIELDS.find((f) => f.key === metric)?.unit ?? "";

  return (
    <div>
      <PageHeader
        title="Peso e medidas"
        subtitle="Acompanhe sua evolução corporal."
        action={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Registrar
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Peso atual
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {currentWeight ?? "—"}
            <span className="ml-1 text-sm font-medium text-slate-400">
              {currentWeight ? "kg" : ""}
            </span>
          </p>
          {weightDiff != null && (
            <p
              className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                weightDiff <= 0 ? "text-brand-600" : "text-rose-500"
              }`}
            >
              {weightDiff <= 0 ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {weightDiff > 0 ? "+" : ""}
              {weightDiff.toFixed(1)} kg desde o último
            </p>
          )}
        </div>
        {latest?.body_fat_pct != null && (
          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              % Gordura
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {latest.body_fat_pct}
              <span className="ml-1 text-sm font-medium text-slate-400">%</span>
            </p>
          </div>
        )}
        {latest?.waist_cm != null && (
          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Cintura
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {latest.waist_cm}
              <span className="ml-1 text-sm font-medium text-slate-400">cm</span>
            </p>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Evolução — {metricLabel}
          </h2>
          <select
            className="input max-w-[160px]"
            value={metric as string}
            onChange={(e) => setMetric(e.target.value as keyof BodyMeasurement)}
          >
            {FIELDS.map((f) => (
              <option key={f.key as string} value={f.key as string}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {chartData.length > 1 ? (
          <TrendChart data={chartData} unit={metricUnit} color="#8b5cf6" />
        ) : (
          <div className="flex h-[240px] items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
            Registre pelo menos 2 medições para ver o gráfico.
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-10 w-10" />}
          title="Nenhuma medição registrada"
          description="Comece registrando seu peso e medidas atuais."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(r.date)}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {FIELDS.filter((f) => r[f.key] != null).map((f) => (
                    <span key={f.key as string}>
                      {f.label}: {String(r[f.key])}
                      {f.unit}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => remove(r.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setForm({});
        }}
        title="Registrar medidas"
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Data">
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <Field key={f.key as string} label={`${f.label} (${f.unit})`}>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={form[f.key as string] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key as string]: e.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </form>
      </Modal>
    </div>
  );
}
