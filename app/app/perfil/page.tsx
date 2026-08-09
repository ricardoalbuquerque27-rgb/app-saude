"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Check, User, Target, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PageHeader, Field } from "@/components/ui";
import PwaSettings from "@/components/PwaSettings";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}
function formatCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function validateCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PF";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function PerfilPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [originalCpf, setOriginalCpf] = useState("");
  const [height, setHeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [waterGoal, setWaterGoal] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [proteinGoal, setProteinGoal] = useState("");
  const [memberSince, setMemberSince] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    const { data } = await supabase.from("profiles").select("*").maybeSingle();
    const p = data as Profile | null;
    if (p) {
      setFullName(p.full_name ?? "");
      setCpf(p.cpf ? formatCPF(p.cpf) : "");
      setOriginalCpf(p.cpf ?? "");
      setHeight(p.height_cm?.toString() ?? "");
      setBirthDate(p.birth_date ?? "");
      setSex(p.sex ?? "");
      setWeightGoal(p.weight_goal_kg?.toString() ?? "");
      setWaterGoal(p.daily_water_goal_ml?.toString() ?? "");
      setCalorieGoal(p.daily_calorie_goal?.toString() ?? "");
      setProteinGoal(p.protein_goal_g?.toString() ?? "");
      setMemberSince(p.created_at ?? null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits && !validateCPF(cpfDigits)) {
      setError("CPF inválido. Confira os números digitados.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // Só checa disponibilidade se o CPF mudou
    if (cpfDigits && cpfDigits !== originalCpf) {
      const { data: disponivel } = await supabase.rpc("cpf_disponivel", {
        p_cpf: cpfDigits,
      });
      if (disponivel === false) {
        setSaving(false);
        setError("Este CPF já está cadastrado em outra conta.");
        return;
      }
    }

    const { error: upErr } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim() || null,
      cpf: cpfDigits || null,
      height_cm: height ? Number(height) : null,
      birth_date: birthDate || null,
      sex: sex || null,
      weight_goal_kg: weightGoal ? Number(weightGoal) : null,
      daily_water_goal_ml: waterGoal ? Number(waterGoal) : 2500,
      daily_calorie_goal: calorieGoal ? Number(calorieGoal) : null,
      protein_goal_g: proteinGoal ? Number(proteinGoal) : null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (upErr) {
      setError(
        upErr.message?.toLowerCase().includes("cpf")
          ? "Este CPF já está cadastrado em outra conta."
          : "Não foi possível salvar. Tente novamente."
      );
      return;
    }
    setOriginalCpf(cpfDigits);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Perfil" subtitle="Seus dados e metas." />

      {/* Cabeçalho premium */}
      <div className="card mb-6 overflow-hidden p-0">
        <div className="h-20 bg-gradient-to-r from-brand-500 to-brand-700" />
        <div className="-mt-9 flex items-end gap-4 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white ring-4 ring-white shadow-lg dark:ring-slate-900">
            {initials(fullName)}
          </div>
          <div className="min-w-0 pb-1">
            <p className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {fullName || "Sem nome"}
            </p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {email}
            </p>
            {memberSince && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                Membro desde{" "}
                {new Date(memberSince).toLocaleDateString("pt-BR", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <User className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Dados
        </h2>
        <Field label="Nome completo">
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label="CPF">
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altura (cm)">
            <input
              type="number"
              className="input"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              className="input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Sexo biológico">
          <select
            className="input"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
          >
            <option value="">Prefiro não informar</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Usado para ajustar as faixas de referência dos seus exames (junto
            com a idade). Não é exibido para ninguém.
          </p>
        </Field>

        <h2 className="flex items-center gap-2 pt-2 font-semibold text-slate-900 dark:text-white">
          <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Metas
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso alvo (kg)">
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightGoal}
              onChange={(e) => setWeightGoal(e.target.value)}
              placeholder="75"
            />
          </Field>
          <Field label="Calorias/dia">
            <input
              type="number"
              className="input"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              placeholder="2000"
            />
          </Field>
          <Field label="Proteína/dia (g)">
            <input
              type="number"
              className="input"
              value={proteinGoal}
              onChange={(e) => setProteinGoal(e.target.value)}
              placeholder="110"
            />
          </Field>
          <Field label="Água/dia (ml)">
            <input
              type="number"
              className="input"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              placeholder="2500"
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "Salvo!" : "Salvar alterações"}
        </button>
      </form>

      <PwaSettings />

      <button
        onClick={signOut}
        className="btn-ghost mt-6 w-full py-2.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </div>
  );
}
