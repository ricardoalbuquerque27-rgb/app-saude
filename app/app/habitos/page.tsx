"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyLog, Profile } from "@/lib/types";
import { PageHeader, Field } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { todayISO, formatDate } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { meuPerfil } from "@/lib/perfil";
import { numeroBR } from "@/lib/numeros";

// Litros em pt-BR, com até duas casas: a mesma conta da Início ("1,45 L"), onde
// o passo é um copo de 250 ml e "1,2" depois de "+250 ml" não mudaria. Aqui era
// `toFixed(1)` com ponto ("1.2 / 2.5 L", "💧 1.2L").
const litros = (ml: number) => numeroBR(ml / 1000, 2);

const MOODS = [
  { value: "otimo", label: "😄 Ótimo" },
  { value: "bem", label: "🙂 Bem" },
  { value: "neutro", label: "😐 Neutro" },
  { value: "cansado", label: "😴 Cansado" },
  { value: "mal", label: "😞 Mal" },
];

function ScalePicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number | null | undefined;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const opts = [];
  for (let i = min; i <= max; i++) opts.push(i);
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`tabular h-11 w-11 rounded-lg border text-sm font-semibold transition ${
            value === n
              ? "border-app-primaria bg-app-primaria text-app-sobre-primaria"
              : "border-app-campo bg-app-cartao text-app-texto hover:bg-app-primaria-fundo"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function HabitosPage() {
  const supabase = createClient();
  const [date, setDate] = useState(todayISO());
  const [log, setLog] = useState<Partial<DailyLog>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<DailyLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: current }, { data: prof }, { data: hist }] = await Promise.all([
      supabase.from("daily_logs").select("*").eq("date", date).maybeSingle(),
      meuPerfil(supabase).then((p) => ({ data: p })),
      supabase
        .from("daily_logs")
        .select("*")
        .order("date", { ascending: false })
        .limit(7),
    ]);
    setLog((current as DailyLog) ?? { date, water_ml: 0 });
    setProfile((prof as Profile) ?? null);
    setHistory((hist ?? []) as DailyLog[]);
    setLoading(false);
  }, [supabase, date]);

  useEffect(() => {
    load();
  }, [load]);

  // Recarrega quando a IA registra água/hábitos.
  useLiveRefresh("habitos", load);

  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const water = log.water_ml ?? 0;
  const waterPct = Math.min(100, Math.round((water / waterGoal) * 100));

  async function persist(patch: Partial<DailyLog>) {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const next = { ...log, ...patch };
    setLog(next);
    await supabase.from("daily_logs").upsert(
      {
        user_id: user.id,
        date,
        water_ml: next.water_ml ?? 0,
        sleep_hours: next.sleep_hours ?? null,
        steps: next.steps ?? null,
        mood: next.mood ?? null,
        energy: next.energy ?? null,
        stress: next.stress ?? null,
        pain: next.pain ?? null,
        notes: next.notes ?? null,
      },
      { onConflict: "user_id,date" }
    );
    setSaving(false);
    // Atualiza histórico em segundo plano
    const { data: hist } = await supabase
      .from("daily_logs")
      .select("*")
      .order("date", { ascending: false })
      .limit(7);
    setHistory((hist ?? []) as DailyLog[]);
  }

  function addWater(ml: number) {
    persist({ water_ml: Math.max(0, water + ml) });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-app-texto-2">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hábitos"
        subtitle="Água, sono, humor e atividade do dia."
        action={
          <input
            type="date"
            className="input max-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
          />
        }
      />

      {/* Água */}
      <div className="card mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Água</h2>
          {waterPct >= 100 && (
            <span className="rounded-full bg-app-primaria-fundo px-2.5 py-0.5 text-xs font-semibold text-app-primaria">
              Meta batida 💧
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          <ProgressRing
            pct={water / waterGoal}
            centerMain={litros(water)}
            centerSub={`/ ${litros(waterGoal)} L`}
            label="Hoje"
          />
          <div className="flex-1">
            <div className="grid grid-cols-3 gap-2">
              {[200, 300, 500].map((ml) => (
                <button
                  key={ml}
                  onClick={() => addWater(ml)}
                  className="btn-ghost flex-col gap-0.5 py-2 text-xs"
                >
                  <Plus className="h-4 w-4" /> {ml}ml
                </button>
              ))}
            </div>
            <button
              onClick={() => addWater(-200)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl text-xs font-medium text-app-texto-2 transition hover:bg-app-primaria-fundo disabled:opacity-40"
              disabled={water <= 0}
            >
              <Minus className="h-3.5 w-3.5" /> Remover 200ml
            </button>
          </div>
        </div>
      </div>

      {/* Dois números não precisam de dois cartões com ícone e título cada.
          Lado a lado também no celular: os campos são curtos. Vazios, dizem a
          unidade ("em horas"), e não um valor de exemplo: "8" e "8000" liam-se
          como dado salvo, o mesmo problema dos campos do Perfil. */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sono (horas)">
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              className="input"
              value={log.sleep_hours ?? ""}
              onChange={(e) =>
                setLog((p) => ({
                  ...p,
                  sleep_hours: e.target.value ? Number(e.target.value) : null,
                }))
              }
              onBlur={() => persist({ sleep_hours: log.sleep_hours })}
              placeholder="em horas"
            />
          </Field>
          <Field label="Passos no dia">
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={log.steps ?? ""}
              onChange={(e) =>
                setLog((p) => ({
                  ...p,
                  steps: e.target.value ? Number(e.target.value) : null,
                }))
              }
              onBlur={() => persist({ steps: log.steps })}
              placeholder="em passos"
            />
          </Field>
        </div>
      </div>

      {/* Humor e bem-estar respondem à mesma pergunta — "como você está
          hoje?" — e estavam em dois cartões, com dois títulos e dois
          ícones. Viraram um. */}
      <div className="card mb-4">
        <h2 className="section-title mb-3">Como você está hoje?</h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => persist({ mood: m.value })}
              className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium transition ${
                log.mood === m.value
                  ? "border-app-primaria bg-app-primaria-fundo text-app-primaria"
                  : "border-app-campo text-app-texto-2 hover:bg-app-primaria-fundo"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>


        <div className="mt-4 space-y-3 border-t border-app-linha pt-4">
          <div>
            <label className="label">Energia (1 = baixa · 5 = alta)</label>
            <ScalePicker
              value={log.energy}
              min={1}
              max={5}
              onChange={(v) => persist({ energy: v })}
            />
          </div>
          <div>
            <label className="label">Estresse (1 = baixo · 5 = alto)</label>
            <ScalePicker
              value={log.stress}
              min={1}
              max={5}
              onChange={(v) => persist({ stress: v })}
            />
          </div>
          <div>
            <label className="label">Dor (0 = nenhuma · 10 = máxima)</label>
            <ScalePicker
              value={log.pain}
              min={0}
              max={10}
              onChange={(v) => persist({ pain: v })}
            />
          </div>
        </div>
      </div>

      {saving && (
        <p className="mb-4 flex items-center gap-2 text-xs text-app-texto-2">
          <Loader2 className="h-3 w-3 animate-spin" /> salvando...
        </p>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-3">Últimos dias</h2>
          <div className="divide-y divide-app-linha">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="tabular font-medium text-app-texto">
                  {formatDate(h.date)}
                </span>
                <div className="tabular flex flex-wrap gap-x-3 text-xs text-app-texto-2">
                  <span>💧 {litros(h.water_ml ?? 0)} L</span>
                  {/* Na mesma linha da água: vírgula também ("7,4 h", não "7.4h"). */}
                  {h.sleep_hours != null && <span>😴 {numeroBR(Number(h.sleep_hours))} h</span>}
                  {h.steps != null && <span>👟 {h.steps}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
