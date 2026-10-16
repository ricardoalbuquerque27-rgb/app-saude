"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  Plus,
  Trash2,
  Loader2,
  TrendingDown,
  TrendingUp,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BodyMeasurement } from "@/lib/types";
import { PageHeader, Modal, Field, EmptyState } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { todayISO, formatDate } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { meuPerfil } from "@/lib/perfil";
import { comSinal, numeroBR, numeroFixo } from "@/lib/numeros";

// Número do banco em pt-BR, com uma casa fixa: "99.89999999999999cm" (um float
// gravado) e "65.8kg" apareciam com ponto, sem espaço e sem arredondar. O "%"
// fica colado ao número, como no título dos gráficos do nutricionista.
function comUnidadeFixa(valor: unknown, unidade: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return `${String(valor)}${unidade}`;
  return unidade === "%" ? `${numeroFixo(n, 1)}%` : `${numeroFixo(n, 1)} ${unidade}`;
}

const FIELDS: { key: keyof BodyMeasurement; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "% Gordura", unit: "%" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "hip_cm", label: "Quadril", unit: "cm" },
  { key: "chest_cm", label: "Peito", unit: "cm" },
  { key: "arm_cm", label: "Braço", unit: "cm" },
  { key: "thigh_cm", label: "Coxa", unit: "cm" },
  { key: "calf_cm", label: "Panturrilha", unit: "cm" },
  { key: "neck_cm", label: "Pescoço", unit: "cm" },
];

export default function MedidasPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metric, setMetric] = useState<keyof BodyMeasurement>("weight_kg");
  // Aviso da exclusão que não aconteceu (recusada pelo banco ou com erro).
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState<Record<string, string>>({});
  const [weightGoal, setWeightGoal] = useState<number | null>(null);

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

  // Recarrega quando a IA registra peso/medidas.
  useLiveRefresh("medidas", load);

  useEffect(() => {
    (async () => {
      const data = await meuPerfil<any>(supabase, "weight_goal_kg");
      setWeightGoal(data?.weight_goal_kg ?? null);
    })();
  }, [supabase]);

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

  // Progresso rumo à meta de peso
  const startWeight = asc.find((r) => r.weight_kg != null)?.weight_kg ?? null;
  const toGoal =
    weightGoal != null && currentWeight != null
      ? Math.round((Number(currentWeight) - weightGoal) * 10) / 10
      : null;
  let goalPct: number | null = null;
  if (
    weightGoal != null &&
    startWeight != null &&
    currentWeight != null &&
    Number(startWeight) !== weightGoal
  ) {
    goalPct = Math.max(
      0,
      Math.min(
        1,
        (Number(startWeight) - Number(currentWeight)) /
          (Number(startWeight) - weightGoal)
      )
    );
  }
  const goalReached = toGoal != null && Math.abs(toGoal) < 0.1;

  // Métricas que já têm ao menos um registro
  const metricsWithData = FIELDS.filter((f) => rows.some((r) => r[f.key] != null));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErroExcluir(null);
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
    setDate(todayISO());
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este registro?")) return;
    setErroExcluir(null);
    // `count: "exact"` porque a RLS não recusa com erro. A medida que o nutri
    // tirou na consulta (measured_by) não é do paciente para apagar, e o banco
    // a esconde do DELETE: afeta zero linhas e devolve `error: null`. Sem
    // contar, a tela recarregava a lista, a linha voltava e ninguém sabia por
    // quê. A tela já não oferece o botão nessas linhas; isto cobre a lista que
    // ficou velha na tela (a medida foi publicada depois de a página abrir).
    const { error, count } = await supabase
      .from("body_measurements")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) {
      setErroExcluir("Não foi possível excluir o registro. Tente de novo.");
      return;
    }
    await load();
    if (count === 0) setErroExcluir("Este registro não pode ser apagado.");
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

      <div className="mb-6 space-y-3">
        {/* Peso + meta */}
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-app-texto-2">
                Peso atual
              </p>
              <p className="tabular mt-1 text-3xl font-semibold text-app-texto">
                {currentWeight != null ? numeroFixo(Number(currentWeight), 1) : "—"}
                <span className="ml-1 text-base font-medium text-app-texto-2">
                  {currentWeight ? "kg" : ""}
                </span>
              </p>
              {weightDiff != null && (
                <p
                  className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                    weightDiff <= 0 ? "text-app-primaria" : "text-app-perigo"
                  }`}
                >
                  {weightDiff <= 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  {comSinal(weightDiff)} kg desde o último
                </p>
              )}
            </div>
            <div className="icon-badge">
              <Scale className="h-4 w-4" />
            </div>
          </div>

          {weightGoal != null ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-medium text-app-texto-2">
                  <Target className="h-3.5 w-3.5 text-app-primaria" />
                  Meta: {numeroBR(weightGoal)} kg
                </span>
                <span className="font-medium text-app-texto-2">
                  {goalReached
                    ? "Meta atingida! 🎉"
                    : toGoal != null
                      ? `faltam ${numeroBR(Math.abs(toGoal))} kg`
                      : ""}
                </span>
              </div>
              {goalPct != null && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-app-linha">
                  <div
                    className="h-full rounded-full bg-app-primaria transition-all"
                    style={{ width: `${Math.round(goalPct * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/app/perfil"
              className="mt-1 inline-flex min-h-[44px] items-center text-xs font-medium text-app-primaria hover:underline"
            >
              Definir meta de peso
            </Link>
          )}
        </div>

        {/* Outras medidas */}
        {(latest?.body_fat_pct != null || latest?.waist_cm != null) && (
          <div className="grid grid-cols-2 gap-3">
            {latest?.body_fat_pct != null && (
              <div className="card">
                <p className="text-xs font-medium text-app-texto-2">
                  % Gordura
                </p>
                <p className="tabular mt-1 text-2xl font-semibold text-app-texto">
                  {numeroFixo(Number(latest.body_fat_pct), 1)}
                  <span className="ml-1 text-sm font-medium text-app-texto-2">%</span>
                </p>
              </div>
            )}
            {latest?.waist_cm != null && (
              <div className="card">
                <p className="text-xs font-medium text-app-texto-2">
                  Cintura
                </p>
                <p className="tabular mt-1 text-2xl font-semibold text-app-texto">
                  {numeroFixo(Number(latest.waist_cm), 1)}
                  <span className="ml-1 text-sm font-medium text-app-texto-2">cm</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <h2 className="section-title mb-3">Evolução — {metricLabel}</h2>
        {metricsWithData.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-1.5">
            {metricsWithData.map((f) => (
              // O botão tem os 44 px de toque; o que se vê é só a pílula de
              // dentro, que continua pequena.
              <button
                key={f.key as string}
                onClick={() => setMetric(f.key)}
                aria-pressed={metric === f.key}
                className="inline-flex min-h-[44px] items-center"
              >
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    metric === f.key
                      ? "border-app-primaria bg-app-primaria text-app-sobre-primaria"
                      : "border-app-linha bg-app-cartao text-app-texto-2 hover:bg-app-primaria-fundo"
                  }`}
                >
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        )}
        {chartData.length > 1 ? (
          <TrendChart data={chartData} unit={metricUnit} />
        ) : (
          <div className="flex h-[240px] items-center justify-center text-center text-sm text-app-texto-2">
            Registre pelo menos 2 medições de {metricLabel.toLowerCase()} para ver o
            gráfico.
          </div>
        )}
      </div>

      {erroExcluir && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {erroExcluir}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-app-texto-2">
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
                <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-app-texto">
                  {formatDate(r.date)}
                  {r.measured_by && (
                    <span className="rounded-full bg-app-primaria-fundo px-2 py-0.5 text-xs font-medium text-app-primaria">
                      Medida na consulta
                    </span>
                  )}
                </p>
                <div className="tabular mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-app-texto-2">
                  {FIELDS.filter((f) => r[f.key] != null).map((f) => (
                    <span key={f.key as string}>
                      {f.label}: {comUnidadeFixa(r[f.key], f.unit)}
                    </span>
                  ))}
                </div>
              </div>
              {/* Medida da consulta é do prontuário: sem excluir (a RLS
                  também recusa, sem erro). */}
              {!r.measured_by && (
                <button
                  onClick={() => remove(r.id)}
                  aria-label={`Excluir registro de ${formatDate(r.date)}`}
                  className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
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
              max={todayISO()}
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
