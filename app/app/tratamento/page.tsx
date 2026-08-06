"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Syringe,
  Loader2,
  Check,
  CalendarClock,
  Beef,
  TrendingDown,
  Activity,
  Bell,
  Pencil,
  ArrowRight,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Field } from "@/components/ui";
import type { Treatment, SideEffect } from "@/lib/types";
import { ensurePushSubscription } from "@/lib/pushClient";

const MEDS = [
  "Ozempic (semaglutida)",
  "Wegovy (semaglutida)",
  "Mounjaro (tirzepatida)",
  "Saxenda (liraglutida)",
  "Rybelsus (semaglutida oral)",
  "Trulicity (dulaglutida)",
  "Victoza (liraglutida)",
  "Outro",
];

const SEV = [
  { v: 0, label: "Nenhum" },
  { v: 1, label: "Leve" },
  { v: 2, label: "Moderado" },
  { v: 3, label: "Intenso" },
];
const SEV_COLOR = [
  "bg-slate-200 dark:bg-slate-700",
  "bg-amber-300",
  "bg-orange-400",
  "bg-rose-500",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromISO: string, toISO: string) {
  return Math.round(
    (new Date(toISO + "T00:00:00").getTime() -
      new Date(fromISO + "T00:00:00").getTime()) /
      86400000
  );
}
// Avança next_dose a partir de start até ficar >= hoje
function computeNextDose(startISO: string, freq: number) {
  const today = todayISO();
  let next = startISO;
  if (freq <= 0) return next;
  let guard = 0;
  while (daysBetween(next, today) > 0 && guard < 1000) {
    next = addDays(next, freq);
    guard++;
  }
  return next;
}
function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function TratamentoPage() {
  const [loading, setLoading] = useState(true);
  const [treatment, setTreatment] = useState<Treatment | null>(null);

  // dados de apoio
  const [proteinToday, setProteinToday] = useState(0);
  const [proteinGoal, setProteinGoal] = useState<number | null>(null);
  const [startWeight, setStartWeight] = useState<number | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [effects, setEffects] = useState<SideEffect[]>([]);
  const [appliedToday, setAppliedToday] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = todayISO();

    const [tRes, profRes, mealsRes, weightsRes, effRes, doseRes] =
      await Promise.all([
        supabase
          .from("treatments")
          .select("*")
          .eq("user_id", user.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("profiles").select("protein_goal_g").eq("id", user.id).maybeSingle(),
        supabase.from("meals").select("protein_g").eq("user_id", user.id).eq("date", today),
        supabase
          .from("body_measurements")
          .select("date, weight_kg")
          .eq("user_id", user.id)
          .not("weight_kg", "is", null)
          .order("date", { ascending: true }),
        supabase
          .from("side_effects")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(14),
        supabase
          .from("dose_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", today)
          .limit(1),
      ]);

    const t = tRes.data as Treatment | null;
    setTreatment(t);
    setProteinGoal(profRes.data?.protein_goal_g ?? null);
    setProteinToday(
      (mealsRes.data ?? []).reduce((s, m) => s + (Number(m.protein_g) || 0), 0)
    );

    const weights = weightsRes.data ?? [];
    setCurrentWeight(weights.length ? weights[weights.length - 1].weight_kg : null);
    if (t) {
      const afterStart = weights.find((w) => w.date >= t.start_date);
      setStartWeight((afterStart ?? weights[0])?.weight_kg ?? null);
    }
    setEffects((effRes.data as SideEffect[]) ?? []);
    setAppliedToday((doseRes.data ?? []).length > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Tratamento"
        subtitle="Acompanhe sua caneta (GLP-1) com segurança e resultado."
      />
      {treatment ? (
        <ActiveTreatment
          treatment={treatment}
          appliedToday={appliedToday}
          proteinToday={proteinToday}
          proteinGoal={proteinGoal}
          startWeight={startWeight}
          currentWeight={currentWeight}
          effects={effects}
          onChange={load}
        />
      ) : (
        <SetupTreatment onCreated={load} />
      )}
    </div>
  );
}

/* ------------------------- Configuração inicial ------------------------- */

function SetupTreatment({ onCreated }: { onCreated: () => void }) {
  const [med, setMed] = useState(MEDS[0]);
  const [medOther, setMedOther] = useState("");
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState(7);
  const [start, setStart] = useState(todayISO());
  const [remind, setRemind] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const medication = med === "Outro" ? medOther.trim() || "Medicamento" : med;
    const next = computeNextDose(start, freq);

    if (remind) await ensurePushSubscription();

    const { error } = await supabase.from("treatments").insert({
      user_id: user.id,
      medication,
      dose: dose.trim() || null,
      frequency_days: freq,
      start_date: start,
      next_dose_date: next,
      remind_dose: remind,
    });
    setSaving(false);
    if (!error) onCreated();
  }

  return (
    <div className="space-y-5">
      <div className="card border-brand-200 bg-brand-50/50 dark:border-brand-900/50 dark:bg-brand-950/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Syringe className="h-5 w-5" />
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              Modo Caneta
            </p>
            <p className="mt-1">
              Feito para quem usa Ozempic, Mounjaro, Wegovy e similares. Lembra da
              aplicação, acompanha efeitos colaterais, cuida da sua proteína (pra
              não perder músculo) e mostra sua evolução.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Configurar tratamento
        </h2>
        <Field label="Medicamento">
          <select
            className="input"
            value={med}
            onChange={(e) => setMed(e.target.value)}
          >
            {MEDS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        {med === "Outro" && (
          <Field label="Qual medicamento?">
            <input
              className="input"
              value={medOther}
              onChange={(e) => setMedOther(e.target.value)}
              placeholder="Nome do medicamento"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dose">
            <input
              className="input"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="ex: 0,5 mg"
            />
          </Field>
          <Field label="Frequência">
            <select
              className="input"
              value={freq}
              onChange={(e) => setFreq(Number(e.target.value))}
            >
              <option value={7}>Semanal (7 dias)</option>
              <option value={1}>Diária</option>
              <option value={14}>Quinzenal (14 dias)</option>
            </select>
          </Field>
        </div>
        <Field label="Data da próxima aplicação">
          <input
            type="date"
            className="input"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
            <Bell className="h-4 w-4" /> Receber lembrete no dia da aplicação
          </span>
        </label>
        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Começar acompanhamento
        </button>
      </form>

      <p className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O Pace Fit ajuda a organizar seu tratamento, mas não substitui seu médico.
        Doses e mudanças devem ser sempre orientadas por um profissional.
      </p>
    </div>
  );
}

/* --------------------------- Tratamento ativo --------------------------- */

function ActiveTreatment({
  treatment,
  appliedToday,
  proteinToday,
  proteinGoal,
  startWeight,
  currentWeight,
  effects,
  onChange,
}: {
  treatment: Treatment;
  appliedToday: boolean;
  proteinToday: number;
  proteinGoal: number | null;
  startWeight: number | null;
  currentWeight: number | null;
  effects: SideEffect[];
  onChange: () => void;
}) {
  const next = treatment.next_dose_date ?? todayISO();
  const daysToNext = daysBetween(todayISO(), next);

  const nextLabel = useMemo(() => {
    if (appliedToday) return "Aplicada hoje ✓";
    if (daysToNext < 0) return `Atrasada (${fmt(next)})`;
    if (daysToNext === 0) return "Hoje é o dia!";
    if (daysToNext === 1) return "Amanhã";
    return `Em ${daysToNext} dias`;
  }, [daysToNext, next, appliedToday]);

  const weightDiff =
    startWeight != null && currentWeight != null
      ? +(currentWeight - startWeight).toFixed(1)
      : null;

  return (
    <div className="space-y-5">
      {/* Hero — próxima aplicação */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-brand-50/80">
              <Syringe className="h-4 w-4" /> {treatment.medication}
              {treatment.dose ? ` · ${treatment.dose}` : ""}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{nextLabel}</h2>
            <p className="mt-0.5 text-sm text-brand-50/90">
              Próxima aplicação: {fmt(next)}
            </p>
          </div>
          <EditTreatment treatment={treatment} onChange={onChange} />
        </div>
        <ApplyButton
          treatment={treatment}
          appliedToday={appliedToday}
          onChange={onChange}
        />
      </section>

      {/* Proteína */}
      <ProteinCard
        proteinToday={proteinToday}
        proteinGoal={proteinGoal}
        onChange={onChange}
      />

      {/* Progresso de peso */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Progresso desde o início
          </h2>
        </div>
        {startWeight != null && currentWeight != null ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Inicial" value={`${startWeight}`} unit="kg" />
            <Stat label="Atual" value={`${currentWeight}`} unit="kg" />
            <Stat
              label="Variação"
              value={`${weightDiff! > 0 ? "+" : ""}${weightDiff}`}
              unit="kg"
              highlight={weightDiff! < 0 ? "good" : weightDiff! > 0 ? "bad" : undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registre seu peso em{" "}
            <Link href="/app/medidas" className="font-medium text-brand-700 hover:underline dark:text-brand-400">
              Medidas
            </Link>{" "}
            para ver sua evolução aqui.
          </p>
        )}
      </div>

      {/* Efeitos colaterais */}
      <SideEffectsCard effects={effects} onChange={onChange} />

      <p className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Em caso de efeitos fortes ou persistentes, procure seu médico. O Pace Fit
        não substitui acompanhamento profissional.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: "good" | "bad";
}) {
  const color =
    highlight === "good"
      ? "text-brand-600 dark:text-brand-400"
      : highlight === "bad"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-900 dark:text-white";
  return (
    <div className="rounded-xl bg-slate-50 py-3 dark:bg-slate-800/40">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tracking-tight ${color}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

function ApplyButton({
  treatment,
  appliedToday,
  onChange,
}: {
  treatment: Treatment;
  appliedToday: boolean;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (appliedToday || saving) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = todayISO();
    await supabase.from("dose_logs").insert({
      user_id: user.id,
      treatment_id: treatment.id,
      date: today,
      dose: treatment.dose,
    });
    await supabase
      .from("treatments")
      .update({ next_dose_date: addDays(today, treatment.frequency_days) })
      .eq("id", treatment.id);
    setSaving(false);
    onChange();
  }

  return (
    <button
      onClick={apply}
      disabled={appliedToday || saving}
      className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/95 py-3 font-semibold text-brand-700 shadow transition hover:bg-white disabled:opacity-80"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : appliedToday ? (
        <Check className="h-4 w-4" />
      ) : (
        <Syringe className="h-4 w-4" />
      )}
      {appliedToday ? "Aplicação registrada" : "Registrar aplicação"}
    </button>
  );
}

function ProteinCard({
  proteinToday,
  proteinGoal,
  onChange,
}: {
  proteinToday: number;
  proteinGoal: number | null;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(proteinGoal?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function saveGoal() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ protein_goal_g: goal ? Number(goal) : null })
      .eq("id", user.id);
    setSaving(false);
    setEditing(false);
    onChange();
  }

  const pct = proteinGoal ? Math.min(100, (proteinToday / proteinGoal) * 100) : 0;
  const low = proteinGoal != null && proteinToday < proteinGoal * 0.6;

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beef className="h-5 w-5 text-rose-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Proteína de hoje
          </h2>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          {proteinGoal ? "Editar meta" : "Definir meta"}
        </button>
      </div>

      {editing ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Meta diária de proteína (g)">
              <input
                type="number"
                className="input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="ex: 110"
              />
            </Field>
          </div>
          <button onClick={saveGoal} disabled={saving} className="btn-primary px-4 py-2.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </button>
        </div>
      ) : proteinGoal ? (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {Math.round(proteinToday)}
              <span className="text-sm font-medium text-slate-400"> / {proteinGoal} g</span>
            </p>
            {low && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Proteína baixa
              </span>
            )}
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${low ? "bg-amber-400" : "bg-rose-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Proteína é essencial para preservar músculo durante o tratamento.{" "}
            <Link href="/app/dieta" className="font-medium text-brand-700 hover:underline dark:text-brand-400">
              Registrar refeição
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Defina uma meta de proteína para acompanhar todos os dias e proteger sua
          massa muscular.
        </p>
      )}
    </div>
  );
}

function SideEffectsCard({
  effects,
  onChange,
}: {
  effects: SideEffect[];
  onChange: () => void;
}) {
  const today = todayISO();
  const todayEntry = effects.find((e) => e.date === today);
  const [nausea, setNausea] = useState(todayEntry?.nausea ?? 0);
  const [appetite, setAppetite] = useState(todayEntry?.appetite ?? 0);
  const [fatigue, setFatigue] = useState(todayEntry?.fatigue ?? 0);
  const [notes, setNotes] = useState(todayEntry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("side_effects").upsert(
      {
        user_id: user.id,
        date: today,
        nausea,
        appetite,
        fatigue,
        notes: notes.trim() || null,
      },
      { onConflict: "user_id,date" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChange();
  }

  const history = [...effects].reverse(); // mais antigo -> recente

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-violet-500" />
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Como você está hoje?
        </h2>
      </div>

      <div className="space-y-3">
        <SevRow label="Náusea" value={nausea} onChange={setNausea} />
        <SevRow label="Falta de apetite" value={appetite} onChange={setAppetite} />
        <SevRow label="Cansaço" value={fatigue} onChange={setFatigue} />
      </div>

      <textarea
        className="input mt-3 min-h-[44px]"
        rows={2}
        placeholder="Outras observações (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button onClick={save} disabled={saving} className="btn-primary mt-3 w-full py-2.5">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saved ? "Salvo!" : "Salvar como estou hoje"}
      </button>

      {history.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Últimos dias (náusea)
          </p>
          <div className="flex items-end gap-1">
            {history.map((e) => (
              <div key={e.id} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-8 w-full rounded ${SEV_COLOR[e.nausea] ?? SEV_COLOR[0]}`}
                  title={`${fmt(e.date)}: ${SEV[e.nausea]?.label ?? "-"}`}
                  style={{ opacity: 0.5 + e.nausea * 0.16 }}
                />
                <span className="text-[9px] text-slate-400">
                  {e.date.slice(8, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SevRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
      <div className="flex gap-1">
        {SEV.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => onChange(s.v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              value === s.v
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditTreatment({
  treatment,
  onChange,
}: {
  treatment: Treatment;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dose, setDose] = useState(treatment.dose ?? "");
  const [freq, setFreq] = useState(treatment.frequency_days);
  const [remind, setRemind] = useState(treatment.remind_dose);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    if (remind && !treatment.remind_dose) await ensurePushSubscription();
    await supabase
      .from("treatments")
      .update({ dose: dose.trim() || null, frequency_days: freq, remind_dose: remind })
      .eq("id", treatment.id);
    setSaving(false);
    setOpen(false);
    onChange();
  }

  async function endTreatment() {
    if (!confirm("Encerrar este tratamento? Você poderá começar outro depois."))
      return;
    const supabase = createClient();
    await supabase.from("treatments").update({ active: false }).eq("id", treatment.id);
    setOpen(false);
    onChange();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25"
        aria-label="Editar tratamento"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 text-slate-900 shadow-xl sm:rounded-2xl dark:bg-slate-900 dark:text-white">
            <h3 className="mb-4 text-lg font-bold">Editar tratamento</h3>
            <div className="space-y-3">
              <Field label="Dose">
                <input
                  className="input"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="ex: 1,0 mg"
                />
              </Field>
              <Field label="Frequência">
                <select
                  className="input"
                  value={freq}
                  onChange={(e) => setFreq(Number(e.target.value))}
                >
                  <option value={7}>Semanal (7 dias)</option>
                  <option value={1}>Diária</option>
                  <option value={14}>Quinzenal (14 dias)</option>
                </select>
              </Field>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(e) => setRemind(e.target.checked)}
                  className="h-4 w-4 accent-brand-500"
                />
                <span className="flex items-center gap-1.5 text-sm">
                  <Bell className="h-4 w-4" /> Lembrete no dia da aplicação
                </span>
              </label>
            </div>
            <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full py-2.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
            <button
              onClick={endTreatment}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              Encerrar tratamento
            </button>
          </div>
        </div>
      )}
    </>
  );
}
