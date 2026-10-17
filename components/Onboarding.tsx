"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Beef,
  Droplets,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensurePushSubscription } from "@/lib/pushClient";
import { todayISO } from "@/lib/date";

const MEDS = [
  "Ozempic (semaglutida)",
  "Wegovy (semaglutida)",
  "Mounjaro (tirzepatida)",
  "Saxenda (liraglutida)",
  "Rybelsus (semaglutida oral)",
  "Outro",
];

export default function Onboarding({ initialName }: { initialName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<"patient" | "nutritionist">("patient");
  const [saving, setSaving] = useState(false);

  // dados
  const [name, setName] = useState(initialName ?? "");
  const [weight, setWeight] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [waterGoal, setWaterGoal] = useState("2500");
  const [proteinGoal, setProteinGoal] = useState("");
  const [usesPen, setUsesPen] = useState<boolean | null>(null);
  const [med, setMed] = useState(MEDS[0]);
  const [medOther, setMedOther] = useState("");
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState(7);
  const [nextDose, setNextDose] = useState(todayISO());

  const TOTAL = 3;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function finish() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || null,
        weight_goal_kg: weightGoal ? Number(weightGoal) : null,
        daily_water_goal_ml: waterGoal ? Number(waterGoal) : 2500,
        protein_goal_g: proteinGoal ? Number(proteinGoal) : null,
        sex: sex || null,
        birth_date: birthDate || null,
        role,
        onboarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Dados de paciente não se aplicam a uma conta de nutricionista.
    if (role === "nutritionist") {
      router.refresh();
      return;
    }

    if (weight) {
      await supabase.from("body_measurements").insert({
        user_id: user.id,
        date: todayISO(),
        weight_kg: Number(weight),
      });
    }

    if (usesPen) {
      const medication = med === "Outro" ? medOther.trim() || "Medicamento" : med;
      if (freq > 0) await ensurePushSubscription();
      await supabase.from("treatments").insert({
        user_id: user.id,
        medication,
        dose: dose.trim() || null,
        frequency_days: freq,
        start_date: nextDose,
        next_dose_date: nextDose,
        remind_dose: true,
      });
    }

    router.refresh();
  }

  async function skip() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    }
    router.refresh();
  }

  const canNext =
    step === 0 ? true : step === 1 ? true : true; // todas as etapas são opcionais

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-app-linha bg-app-cartao">
        {/* Cabeçalho: o cartão comum, sem o bloco verde com degradê e brilho de
            antes. A marca é o quadrado `primaria` da casca. */}
        <div className="border-b border-app-linha px-6 pb-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primaria text-app-sobre-primaria">
                <Dumbbell className="h-5 w-5" />
              </div>
              <span className="font-semibold text-app-texto">Pace Fit</span>
            </div>
            <button
              onClick={skip}
              disabled={saving}
              className="tappable -mr-3 flex min-h-[44px] items-center rounded-lg px-3 text-[13px] font-medium text-app-texto-2 hover:text-app-texto disabled:opacity-60"
            >
              Pular
            </button>
          </div>
          {/* Progresso */}
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i <= step ? "bg-app-primaria" : "bg-app-linha"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-app-texto">
                  Bem-vindo(a)! 👋
                </h2>
                <p className="mt-1 text-sm text-app-texto-2">
                  Vamos configurar seu app em 1 minuto para deixá-lo sob medida.
                </p>
              </div>
              <FieldLabel>Você é...</FieldLabel>
              <div className="flex gap-2">
                {[
                  { v: "patient" as const, label: "Paciente" },
                  { v: "nutritionist" as const, label: "Nutricionista" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setRole(o.v)}
                    className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-semibold transition ${
                      role === o.v
                        ? "border-app-primaria bg-app-primaria-fundo text-app-primaria"
                        : "border-app-campo text-app-texto hover:bg-app-primaria-fundo"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <FieldLabel>Como podemos te chamar?</FieldLabel>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />

              {role === "nutritionist" ? (
                <p className="rounded-xl bg-app-primaria-fundo px-3 py-2.5 text-sm text-app-texto">
                  Perfeito! Vamos criar sua conta profissional. No próximo passo
                  você já pode convidar seus pacientes.
                </p>
              ) : (
                <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Peso atual (kg)</FieldLabel>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="80"
                  />
                </div>
                <div>
                  <FieldLabel>Meta de peso (kg)</FieldLabel>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={weightGoal}
                    onChange={(e) => setWeightGoal(e.target.value)}
                    placeholder="72"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Sexo biológico</FieldLabel>
                  <select
                    className="input"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value="">Prefiro não dizer</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Data de nascimento</FieldLabel>
                  <input
                    type="date"
                    className="input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={todayISO()}
                  />
                </div>
              </div>
              <p className="text-[13px] text-app-texto-2">
                Usamos sexo e idade só para ajustar as faixas de referência dos
                seus exames. Você pode deixar em branco.
              </p>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-app-texto">Suas metas</h2>
                <p className="mt-1 text-sm text-app-texto-2">
                  Isso ajuda a acompanhar seu dia a dia. Pode ajustar depois.
                </p>
              </div>
              <div>
                <FieldLabel>
                  <Droplets className="mr-1 inline h-3.5 w-3.5" /> Meta de água por
                  dia (ml)
                </FieldLabel>
                <input
                  type="number"
                  className="input"
                  value={waterGoal}
                  onChange={(e) => setWaterGoal(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div>
                <FieldLabel>
                  <Beef className="mr-1 inline h-3.5 w-3.5" /> Meta de proteína por
                  dia (g)
                </FieldLabel>
                <input
                  type="number"
                  className="input"
                  value={proteinGoal}
                  onChange={(e) => setProteinGoal(e.target.value)}
                  placeholder="ex: 110"
                />
                <p className="mt-1.5 text-[13px] text-app-texto-2">
                  Dica: proteína ajuda a preservar músculo. Se não souber, deixe em
                  branco.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-app-texto">Tratamento</h2>
                <p className="mt-1 text-sm text-app-texto-2">
                  Você usa alguma caneta emagrecedora (GLP-1)?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUsesPen(false)}
                  className={`min-h-[44px] rounded-xl border py-3 text-sm font-medium transition ${
                    usesPen === false
                      ? "border-app-primaria bg-app-primaria-fundo text-app-primaria"
                      : "border-app-campo text-app-texto hover:bg-app-primaria-fundo"
                  }`}
                >
                  Não uso
                </button>
                <button
                  type="button"
                  onClick={() => setUsesPen(true)}
                  className={`min-h-[44px] rounded-xl border py-3 text-sm font-medium transition ${
                    usesPen === true
                      ? "border-app-primaria bg-app-primaria-fundo text-app-primaria"
                      : "border-app-campo text-app-texto hover:bg-app-primaria-fundo"
                  }`}
                >
                  Sim, uso
                </button>
              </div>

              {usesPen && (
                <div className="space-y-3 rounded-xl border border-app-linha p-3">
                  <div>
                    <FieldLabel>Medicamento</FieldLabel>
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
                  </div>
                  {med === "Outro" && (
                    <input
                      className="input"
                      value={medOther}
                      onChange={(e) => setMedOther(e.target.value)}
                      placeholder="Nome do medicamento"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Dose</FieldLabel>
                      <input
                        className="input"
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                        placeholder="0,5 mg"
                      />
                    </div>
                    <div>
                      <FieldLabel>Frequência</FieldLabel>
                      <select
                        className="input"
                        value={freq}
                        onChange={(e) => setFreq(Number(e.target.value))}
                      >
                        <option value={7}>Semanal</option>
                        <option value={1}>Diária</option>
                        <option value={14}>Quinzenal</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Próxima aplicação</FieldLabel>
                    <input
                      type="date"
                      className="input"
                      value={nextDose}
                      onChange={(e) => setNextDose(e.target.value)}
                    />
                  </div>
                  <p className="text-[13px] text-app-texto-2">
                    Vamos te lembrar no dia da aplicação. Isso não substitui seu
                    médico.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé / navegação */}
        <div className="flex items-center gap-2 border-t border-app-linha px-6 py-4">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
              className="btn-ghost min-h-[44px] px-3"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          <div className="flex-1" />
          {step < TOTAL - 1 && role === "patient" ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext || saving}
              className="btn-primary px-5 py-2.5"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="btn-primary px-5 py-2.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="label">{children}</label>
  );
}
