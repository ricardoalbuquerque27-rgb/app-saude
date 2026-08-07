import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isAbortError, parseModelJson } from "@/lib/aiHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM =
  "Você é uma inteligência de saúde do app Pace Fit. Sua especialidade é CONECTAR os dados de diferentes áreas " +
  "(exames, dieta, treino, hábitos, tratamento e peso) para gerar insights que isoladamente não apareceriam. " +
  "Ex.: ligar um exame alterado a um padrão da dieta, ou o sono ao desempenho nos treinos.\n\n" +
  "Regras:\n" +
  "- Português do Brasil, tom claro, prático e acolhedor.\n" +
  "- Baseie-se APENAS nos dados fornecidos. Não invente números. Se faltarem dados, diga o que registrar.\n" +
  "- Você NÃO faz diagnóstico nem prescreve/ajusta medicamentos ou doses. Para exames alterados, condições médicas ou dúvidas sobre a caneta (GLP-1), oriente procurar médico/nutricionista.\n" +
  "- Priorize CONEXÕES entre áreas. Cada insight deve explicar o dado observado e como ele se conecta a outra área.\n\n" +
  "Responda APENAS com JSON válido (sem markdown), exatamente neste formato:\n" +
  "{\n" +
  '  "resumo": "2 a 3 frases com a visão geral conectando as áreas",\n' +
  '  "prioridades": ["até 3 ações mais importantes agora"],\n' +
  '  "insights": [{ "area": "Exames|Dieta|Treino|Hábitos|Tratamento|Peso|Geral", "severidade": "bom|atencao|alerta", "titulo": "curto", "observacao": "o que os dados mostram (com números)", "conexao": "como isso se conecta a outra área", "acao": "o que fazer" }],\n' +
  '  "pontos_fortes": ["o que já está indo bem"]\n' +
  "}\n" +
  "Máximo 6 insights, ordenados do mais importante ao menos. Use os números dos dados quando fizer sentido.";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function avg(nums: number[]) {
  const f = nums.filter((n) => n > 0);
  if (f.length === 0) return null;
  return Math.round((f.reduce((a, b) => a + b, 0) / f.length) * 10) / 10;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "A IA não está configurada (falta a chave GROQ_API_KEY no servidor)." },
      { status: 503 }
    );
  }

  const uid = user.id;
  const since = isoDaysAgo(30);

  const [profileRes, mealsRes, workoutsRes, logsRes, measRes, examsRes, treatRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("meals")
        .select("date, calories, protein_g, carbs_g, fat_g")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("workouts")
        .select("date, category, duration_min")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("daily_logs")
        .select("date, water_ml, sleep_hours, energy, stress, pain, mood")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("body_measurements")
        .select("date, weight_kg, body_fat_pct, waist_cm")
        .eq("user_id", uid)
        .order("date", { ascending: true })
        .limit(90),
      supabase
        .from("exams")
        .select("date, title, result_value, unit, reference_range, status")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(30),
      supabase
        .from("treatments")
        .select("medication, dose, frequency_days, start_date, active")
        .eq("user_id", uid)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const profile = profileRes.data as any;
  const meals = mealsRes.data ?? [];
  const workouts = workoutsRes.data ?? [];
  const logs = logsRes.data ?? [];
  const meas = measRes.data ?? [];
  const exams = examsRes.data ?? [];
  const treat = treatRes.data as any;

  const age = profile?.birth_date
    ? Math.floor(
        (Date.now() - new Date(profile.birth_date).getTime()) /
          (365.25 * 24 * 3600 * 1000)
      )
    : null;

  const weights = meas.filter((m: any) => m.weight_kg != null);
  const firstWeight = weights.length ? weights[0].weight_kg : null;
  const lastWeight = weights.length ? weights[weights.length - 1].weight_kg : null;

  const summary = {
    perfil: {
      idade: age,
      altura_cm: profile?.height_cm ?? null,
      meta_peso_kg: profile?.weight_goal_kg ?? null,
      meta_agua_ml: profile?.daily_water_goal_ml ?? null,
      meta_calorias: profile?.daily_calorie_goal ?? null,
      meta_proteina_g: profile?.protein_goal_g ?? null,
    },
    periodo_dias: 30,
    dieta: {
      dias_registrados: new Set(meals.map((m: any) => m.date)).size,
      media_calorias: avg(meals.map((m: any) => Number(m.calories) || 0)),
      media_proteina_g: avg(meals.map((m: any) => Number(m.protein_g) || 0)),
      media_carbo_g: avg(meals.map((m: any) => Number(m.carbs_g) || 0)),
      media_gordura_g: avg(meals.map((m: any) => Number(m.fat_g) || 0)),
    },
    treino: {
      total: workouts.length,
      dias_com_treino: new Set(workouts.map((w: any) => w.date)).size,
      media_duracao_min: avg(workouts.map((w: any) => Number(w.duration_min) || 0)),
    },
    habitos: {
      dias_registrados: new Set(logs.map((l: any) => l.date)).size,
      media_agua_ml: avg(logs.map((l: any) => Number(l.water_ml) || 0)),
      media_sono_h: avg(logs.map((l: any) => Number(l.sleep_hours) || 0)),
      media_energia_0a3: avg(logs.map((l: any) => Number(l.energy) || 0)),
      media_estresse_0a3: avg(logs.map((l: any) => Number(l.stress) || 0)),
      media_dor_0a3: avg(logs.map((l: any) => Number(l.pain) || 0)),
    },
    peso: {
      registros: weights.length,
      inicial_kg: firstWeight,
      atual_kg: lastWeight,
      variacao_kg:
        firstWeight != null && lastWeight != null
          ? Math.round((lastWeight - firstWeight) * 10) / 10
          : null,
      gordura_pct:
        meas.length && meas[meas.length - 1].body_fat_pct != null
          ? meas[meas.length - 1].body_fat_pct
          : null,
    },
    tratamento: treat
      ? {
          medicamento: treat.medication,
          dose: treat.dose,
          frequencia_dias: treat.frequency_days,
          inicio: treat.start_date,
        }
      : null,
    exames: exams.map((e: any) => ({
      titulo: e.title,
      valor: e.result_value,
      unidade: e.unit,
      referencia: e.reference_range,
      status: e.status,
      data: e.date,
    })),
  };

  const hasAnyData =
    meals.length || workouts.length || logs.length || meas.length || exams.length;

  const userPrompt =
    (hasAnyData
      ? "Analise e conecte estes dados do usuário para gerar os insights de saúde."
      : "O usuário quase não tem dados. Gere insights iniciais explicando o que registrar (dieta, treino, hábitos, exames) para receber uma análise conectada.") +
    "\n\nDADOS (JSON):\n" +
    JSON.stringify(summary);

  const to = withTimeout(45_000);
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: to.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 2400,
      }),
    });

    if (!groqRes.ok) {
      const status = groqRes.status;
      const detail = await groqRes.text().catch(() => "");
      let reason = detail.slice(0, 200);
      try {
        reason = JSON.parse(detail)?.error?.message || reason;
      } catch {}
      console.error("insights groq error:", status, detail.slice(0, 400));
      return NextResponse.json(
        { error: `Erro da IA (${status}): ${reason}` },
        { status: status === 429 ? 429 : 502 }
      );
    }

    const payload = await groqRes.json();
    const text: string = payload?.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Não foi possível gerar a análise. Tente novamente." },
        { status: 502 }
      );
    }

    const result = parseModelJson(text);
    if (!result) {
      return NextResponse.json(
        { error: "A IA retornou uma resposta inválida. Tente novamente." },
        { status: 502 }
      );
    }

    const insight = {
      resumo: String(result.resumo ?? ""),
      prioridades: Array.isArray(result.prioridades) ? result.prioridades : [],
      insights: Array.isArray(result.insights) ? result.insights : [],
      pontos_fortes: Array.isArray(result.pontos_fortes) ? result.pontos_fortes : [],
    };

    const { data: saved } = await supabase
      .from("health_insights")
      .insert({ user_id: uid, content: insight })
      .select("id, created_at")
      .single();

    return NextResponse.json({
      ...insight,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? new Date().toISOString(),
    });
  } catch (err: any) {
    if (isAbortError(err)) {
      return NextResponse.json(
        { error: "A IA demorou demais para responder. Tente novamente." },
        { status: 504 }
      );
    }
    console.error("insights error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao gerar a análise. Tente novamente." },
      { status: 500 }
    );
  }  finally {
    to.clear();
  }
}
