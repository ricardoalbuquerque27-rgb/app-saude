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
import { todayISO, addDaysISO } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";

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
    next = addDaysISO(next, freq);
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

  // Recarrega quando a IA registra a dose da caneta.
  useLiveRefresh("tratamento", load);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-app-texto-2">
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
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <Syringe className="h-4 w-4" />
          </div>
          <div className="text-sm text-app-texto-2">
            <p className="font-semibold text-app-texto">
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
        <h2 className="section-title">Configurar tratamento</h2>
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
        <label className="flex items-center gap-3 rounded-xl border border-app-linha p-3">
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="h-4 w-4 accent-app-primaria"
          />
          <span className="flex items-center gap-1.5 text-sm text-app-texto">
            <Bell className="h-4 w-4" /> Receber lembrete no dia da aplicação
          </span>
        </label>
        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Começar acompanhamento
        </button>
      </form>

      <p className="flex items-start gap-1.5 text-xs text-app-texto-2">
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
      {/* Próxima aplicação: o cartão comum, com o botão principal. O bloco
          verde com degradê, sombra e brilho era o único destaque decorativo
          do app; o que importa aqui é a data e o botão. */}
      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-app-texto-2">
              <Syringe className="h-4 w-4" /> {treatment.medication}
              {treatment.dose ? ` · ${treatment.dose}` : ""}
            </p>
            <h2 className="tabular mt-2 text-2xl font-semibold text-app-texto">{nextLabel}</h2>
            <p className="tabular mt-0.5 text-sm text-app-texto-2">
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
        <h2 className="section-title mb-3">
          <TrendingDown className="h-5 w-5 text-app-primaria" />
          Progresso desde o início
        </h2>
        {startWeight != null && currentWeight != null ? (
          <div className="grid grid-cols-3 divide-x divide-app-linha text-center">
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
          <p className="text-sm text-app-texto-2">
            Registre seu peso em{" "}
            <Link href="/app/medidas" className="font-medium text-app-primaria hover:underline">
              Medidas
            </Link>{" "}
            para ver sua evolução aqui.
          </p>
        )}
      </div>

      {/* Efeitos colaterais */}
      <SideEffectsCard effects={effects} onChange={onChange} />

      <p className="flex items-start gap-1.5 text-xs text-app-texto-2">
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
      ? "text-app-primaria"
      : highlight === "bad"
        ? "text-app-perigo"
        : "text-app-texto";
  return (
    <div className="px-1 py-1">
      <p className="text-xs font-medium text-app-texto-2">{label}</p>
      <p className={`tabular mt-0.5 text-xl font-semibold ${color}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-app-texto-2">{unit}</span>}
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
      .update({ next_dose_date: addDaysISO(today, treatment.frequency_days) })
      .eq("id", treatment.id);
    setSaving(false);
    onChange();
  }

  return (
    <button
      onClick={apply}
      disabled={appliedToday || saving}
      className="btn-primary mt-5 w-full py-3 disabled:opacity-80"
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
          <Beef className="h-5 w-5 text-app-primaria" />
          <h2 className="section-title">Proteína de hoje</h2>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="inline-flex min-h-[44px] items-center text-xs font-medium text-app-primaria hover:underline"
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
            <p className="tabular text-2xl font-semibold text-app-texto">
              {Math.round(proteinToday)}
              <span className="text-sm font-medium text-app-texto-2"> / {proteinGoal} g</span>
            </p>
            {low && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Proteína baixa
              </span>
            )}
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-app-linha">
            <div
              className={`h-full rounded-full transition-all ${low ? "bg-app-atencao" : "bg-app-primaria"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-app-texto-2">
            Proteína é essencial para preservar músculo durante o tratamento.{" "}
            <Link href="/app/dieta" className="font-medium text-app-primaria hover:underline">
              Registrar refeição
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-app-texto-2">
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
      <h2 className="section-title mb-3">
        <Activity className="h-5 w-5 text-app-primaria" />
        Como você está hoje?
      </h2>

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
          <p className="mb-2 text-xs font-medium text-app-texto-2">
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
                <span className="tabular text-[11px] text-app-texto-2">
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
      <span className="text-sm text-app-texto">{label}</span>
      <div className="flex gap-1">
        {SEV.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => onChange(s.v)}
            className={`min-h-[44px] rounded-lg px-2.5 text-xs font-medium transition ${
              value === s.v
                ? "bg-app-primaria text-app-sobre-primaria"
                : "bg-app-pagina text-app-texto-2 hover:bg-app-primaria-fundo"
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
        className="btn-ghost h-11 w-11 shrink-0 px-0"
        aria-label="Editar tratamento"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-app-linha bg-app-cartao p-5 text-app-texto sm:rounded-2xl">
            <h3 className="mb-4 text-[17px] font-semibold">Editar tratamento</h3>
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
              <label className="flex items-center gap-3 rounded-xl border border-app-linha p-3">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(e) => setRemind(e.target.checked)}
                  className="h-4 w-4 accent-app-primaria"
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
              className="mt-2 min-h-[44px] w-full rounded-xl text-sm font-medium text-app-perigo hover:bg-app-perigo-fundo"
            >
              Encerrar tratamento
            </button>
          </div>
        </div>
      )}
    </>
  );
}
