"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { LogOut, Loader2, Check, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PageHeader, Field } from "@/components/ui";
import PwaSettings from "@/components/PwaSettings";
import { meuPerfil } from "@/lib/perfil";
import { todayISO } from "@/lib/date";

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
  const [role, setRole] = useState("patient");
  const [crn, setCrn] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [waterGoal, setWaterGoal] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [proteinGoal, setProteinGoal] = useState("");
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [metasDoNutri, setMetasDoNutri] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    const { data: pres } = await supabase
      .from("prescriptions")
      .select("id")
      .limit(1)
      .maybeSingle();
    setMetasDoNutri(!!pres);

    const data = await meuPerfil(supabase);
    const p = data as Profile | null;
    if (p) {
      setFullName(p.full_name ?? "");
      setCpf(p.cpf ? formatCPF(p.cpf) : "");
      setOriginalCpf(p.cpf ?? "");
      setHeight(p.height_cm?.toString() ?? "");
      setBirthDate(p.birth_date ?? "");
      setSex(p.sex ?? "");
      setRole(p.role ?? "patient");
      setCrn(p.crn ?? "");
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
      role: role === "nutritionist" ? "nutritionist" : "patient",
      // Só o nutricionista tem CRN. Para o paciente a chave nem vai: o upsert
      // não toca na coluna, em vez de gravar nulo por cima de um CRN que ele
      // ainda tenha de quando era nutricionista. Vazio grava nulo.
      ...(role === "nutritionist" ? { crn: crn.trim() || null } : {}),
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
    // Navegação dura: ver comentário no login. Depois de sair, nenhuma tela
    // renderizada para o usuário anterior pode sobreviver no cache.
    window.location.assign("/login");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-app-texto-2">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Perfil" subtitle="Seus dados e metas." />

      {/* Quem é: as iniciais, o nome e o e-mail num cartão só. A faixa de
          degradê e o nome por cima da borda dela saíram com a cor decorativa. */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-app-primaria-fundo text-lg font-semibold text-app-primaria">
          {initials(fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-app-texto">
            {fullName || "Sem nome"}
          </p>
          <p className="truncate text-sm text-app-texto-2">
            {email}
          </p>
          {memberSince && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-app-texto-2">
              <CalendarClock className="h-3.5 w-3.5" />
              Membro desde{" "}
              {/* Com o fuso: sem ele, quem está fora do Brasil via outro mês na
                  noite do dia 1º. */}
              {new Date(memberSince).toLocaleDateString("pt-BR", {
                month: "short",
                year: "numeric",
                timeZone: "America/Sao_Paulo",
              })}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <h2 className="section-title">Dados</h2>
        <Field label="Tipo de conta">
          <div className="flex gap-2">
            {[
              { v: "patient", label: "Sou paciente" },
              { v: "nutritionist", label: "Sou nutricionista" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setRole(o.v)}
                className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-medium transition ${
                  role === o.v
                    ? "border-app-primaria bg-app-primaria-fundo text-app-primaria"
                    : "border-app-campo text-app-texto-2 hover:bg-app-primaria-fundo"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-app-texto-2">
            Nutricionista acompanha pacientes; paciente registra a própria rotina.
            Ao salvar, a navegação do app muda.
          </p>
        </Field>
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
        {role === "nutritionist" && (
          <Field label="CRN (aparece no prontuário)">
            <input
              className="input"
              type="text"
              value={crn}
              onChange={(e) => setCrn(e.target.value)}
              placeholder="CRN-3 12345"
              maxLength={30}
            />
          </Field>
        )}
        {/* Os campos vazios dizem a unidade ("em cm", "kcal por dia"), e não um
            valor de exemplo: "175" ao lado de dados reais lia-se como dado
            salvo, e o nutricionista podia tomar a altura de exemplo pela da
            paciente. Vale para as metas, mais abaixo. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altura (cm)">
            <input
              type="number"
              className="input"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="em cm"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              className="input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={todayISO()}
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
          <p className="mt-1 text-xs text-app-texto-2">
            Usado para ajustar as faixas de referência dos seus exames (junto
            com a idade). Não é exibido para ninguém.
          </p>
        </Field>

        <h2 className="section-title pt-2">Metas</h2>
        {metasDoNutri && (
          <p className="rounded-lg bg-app-primaria-fundo px-3 py-2 text-xs text-app-texto-2">
            Estas metas foram definidas pelo seu nutricionista. Você pode
            alterá-las, mas vale combinar antes — ele acompanha esses números.{" "}
            <Link
              href="/app/nutricionista?aba=metas"
              className="font-semibold text-app-primaria underline underline-offset-2 hover:no-underline"
            >
              Ver em Meu plano
            </Link>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso alvo (kg)">
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightGoal}
              onChange={(e) => setWeightGoal(e.target.value)}
              placeholder="em kg"
            />
          </Field>
          <Field label="Calorias/dia">
            <input
              type="number"
              className="input"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              placeholder="kcal por dia"
            />
          </Field>
          <Field label="Proteína/dia (g)">
            <input
              type="number"
              className="input"
              value={proteinGoal}
              onChange={(e) => setProteinGoal(e.target.value)}
              placeholder="g por dia"
            />
          </Field>
          <Field label="Água/dia (ml)">
            <input
              type="number"
              className="input"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              placeholder="ml por dia"
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
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
        className="btn-ghost mt-6 min-h-[44px] w-full py-2.5 text-app-perigo hover:bg-app-perigo-fundo"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </div>
  );
}
