import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Groq (gratuito, rápido). Modelo trocável via GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM =
  "Você é um coach de saúde, nutrição e treino analisando os dados dos últimos ~30 dias de um usuário do app Pace Fit. " +
  "Gere uma análise HONESTA, prática e motivadora, em português do Brasil. " +
  "Baseie-se APENAS nos dados fornecidos. Se houver poucos dados, diga isso e recomende o que a pessoa deveria começar a registrar. " +
  "Não invente números. Para alterações em exames, recomende procurar um médico/nutricionista — você não faz diagnóstico.\n\n" +
  "Responda APENAS com JSON válido (sem markdown), exatamente neste formato:\n" +
  "{\n" +
  '  "resumo": "2 a 4 frases com a visão geral do período",\n' +
  '  "pontos_fortes": ["o que está indo bem"],\n' +
  '  "a_melhorar": [{ "area": "Dieta|Treino|Hábitos|Medidas|Exames|Geral", "observacao": "o que os dados mostram", "sugestao": "o que fazer" }],\n' +
  '  "padroes_a_evitar": ["padrões/riscos observados nos dados"],\n' +
  '  "proximos_passos": ["ações concretas e simples para os próximos dias"]\n' +
  "}\n" +
  "Use no máximo 5 itens por lista. Seja específico e use os números dos dados quando fizer sentido.";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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
      { error: "Os relatórios não estão configurados (falta a chave GROQ_API_KEY no servidor)." },
      { status: 503 }
    );
  }

  const uid = user.id;
  const since = isoDaysAgo(30);

  const [profileRes, mealsRes, workoutsRes, logsRes, measRes, examsRes, planRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("meals")
        .select("date, calories, protein_g, carbs_g, fat_g")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("workouts")
        .select("date, name, category, duration_min")
        .eq("user_id", uid)
        .gte("date", since),
      supabase
        .from("daily_logs")
        .select("date, water_ml, sleep_hours, steps, mood")
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
        .select("date, title, exam_type, result_value, unit, reference_range, status")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(25),
      supabase.from("workout_plan").select("day_of_week, sport, title"),
    ]);

  const profile = profileRes.data as any;
  const meals = mealsRes.data ?? [];
  const workouts = workoutsRes.data ?? [];
  const logs = logsRes.data ?? [];
  const meas = measRes.data ?? [];
  const exams = examsRes.data ?? [];
  const plan = planRes.data ?? [];

  const age = profile?.birth_date
    ? Math.floor(
        (Date.now() - new Date(profile.birth_date).getTime()) /
          (365.25 * 24 * 3600 * 1000)
      )
    : null;

  const dietDays = new Set(meals.map((m: any) => m.date)).size;
  const workoutDays = new Set(workouts.map((w: any) => w.date)).size;

  const byCategory: Record<string, number> = {};
  workouts.forEach((w: any) => {
    const k = (w.category || "Sem categoria").trim();
    byCategory[k] = (byCategory[k] || 0) + 1;
  });

  const moodCounts: Record<string, number> = {};
  logs.forEach((l: any) => {
    if (l.mood) moodCounts[l.mood] = (moodCounts[l.mood] || 0) + 1;
  });

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
    },
    periodo_dias: 30,
    dieta: {
      dias_registrados: dietDays,
      media_calorias_por_dia_registrado: avg(
        meals.map((m: any) => Number(m.calories) || 0).filter((n) => n > 0)
      ),
      media_proteina_g: avg(
        meals.map((m: any) => Number(m.protein_g) || 0).filter((n) => n > 0)
      ),
      media_carbo_g: avg(
        meals.map((m: any) => Number(m.carbs_g) || 0).filter((n) => n > 0)
      ),
      media_gordura_g: avg(
        meals.map((m: any) => Number(m.fat_g) || 0).filter((n) => n > 0)
      ),
    },
    treino: {
      total_treinos: workouts.length,
      dias_com_treino: workoutDays,
      por_categoria: byCategory,
      media_duracao_min: avg(
        workouts.map((w: any) => Number(w.duration_min) || 0).filter((n) => n > 0)
      ),
    },
    plano_semanal: plan.map((p: any) => ({
      dia: DAYS[p.day_of_week] ?? p.day_of_week,
      esporte: p.sport,
      treino: p.title,
    })),
    habitos: {
      dias_registrados: new Set(logs.map((l: any) => l.date)).size,
      media_agua_ml: avg(
        logs.map((l: any) => Number(l.water_ml) || 0).filter((n) => n > 0)
      ),
      media_sono_h: avg(
        logs.map((l: any) => Number(l.sleep_hours) || 0).filter((n) => n > 0)
      ),
      media_passos: avg(
        logs.map((l: any) => Number(l.steps) || 0).filter((n) => n > 0)
      ),
      humor: moodCounts,
    },
    medidas: {
      registros: weights.length,
      peso_inicial_kg: firstWeight,
      peso_atual_kg: lastWeight,
      variacao_kg:
        firstWeight != null && lastWeight != null
          ? Math.round((lastWeight - firstWeight) * 10) / 10
          : null,
      gordura_pct_atual:
        meas.length && meas[meas.length - 1].body_fat_pct != null
          ? meas[meas.length - 1].body_fat_pct
          : null,
    },
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
      ? "Analise estes dados do usuário e gere o relatório."
      : "O usuário quase não tem dados registrados. Gere um relatório inicial incentivando o registro e explicando o que acompanhar.") +
    "\n\nDADOS (JSON):\n" +
    JSON.stringify(summary);

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
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
        max_tokens: 2048,
      }),
    });

    if (!groqRes.ok) {
      const status = groqRes.status;
      const detail = await groqRes.text().catch(() => "");
      let reason = detail.slice(0, 200);
      try {
        reason = JSON.parse(detail)?.error?.message || reason;
      } catch {}
      console.error("report groq error:", status, detail.slice(0, 400));
      return NextResponse.json(
        { error: `Erro da IA (${status}): ${reason}` },
        { status: status === 429 ? 429 : 502 }
      );
    }

    const payload = await groqRes.json();
    const text: string = payload?.choices?.[0]?.message?.content ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Não foi possível gerar o relatório. Tente novamente." },
        { status: 502 }
      );
    }

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      result = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
    }

    return NextResponse.json({
      resumo: String(result.resumo ?? ""),
      pontos_fortes: Array.isArray(result.pontos_fortes) ? result.pontos_fortes : [],
      a_melhorar: Array.isArray(result.a_melhorar) ? result.a_melhorar : [],
      padroes_a_evitar: Array.isArray(result.padroes_a_evitar)
        ? result.padroes_a_evitar
        : [],
      proximos_passos: Array.isArray(result.proximos_passos)
        ? result.proximos_passos
        : [],
    });
  } catch (err: any) {
    console.error("report error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao gerar o relatório. Tente novamente." },
      { status: 500 }
    );
  }
}
