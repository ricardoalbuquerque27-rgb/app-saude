import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Groq (gratuito, rápido). Modelo trocável via GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM =
  "Você é o assistente do Pace Fit, um app de saúde e fitness. Você atua como um nutricionista e personal trainer virtual, " +
  "ajudando o usuário com dúvidas sobre alimentação/dieta, treinos, organização da rotina, hábitos (água, sono, humor) e " +
  "como usar o próprio app.\n\n" +
  "Sobre o app Pace Fit, para orientar o usuário:\n" +
  "- Treinos: plano semanal (esporte e treinos por dia) e histórico de treinos com exercícios.\n" +
  "- Dieta: registrar refeições e macros; há um botão para analisar a FOTO do prato e estimar calorias e macros.\n" +
  "- Medidas: registrar peso e medidas corporais e ver gráficos.\n" +
  "- Hábitos: acompanhar água, sono e humor.\n" +
  "- Exames: guardar resultados de exames.\n" +
  "- Relatórios: a IA analisa os últimos 30 dias e traz o que melhorar.\n\n" +
  "Como responder:\n" +
  "- Sempre em português do Brasil, com tom amigável, prático e motivador.\n" +
  "- Seja objetivo. Parágrafos curtos e listas com hífens (-). Evite markdown pesado (nada de **, ##).\n" +
  "- Dê exemplos concretos (porções, substituições, séries) quando ajudar.\n\n" +
  "Importante (segurança): você não substitui um profissional de saúde. Para condições médicas, medicamentos, " +
  "gravidez ou dietas muito restritivas, oriente a procurar um nutricionista ou médico. Não faça diagnósticos.";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Monta um resumo dos dados do usuário para personalizar as respostas.
async function buildUserContext(supabase: any, uid: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const dow = (new Date().getDay() + 6) % 7;

  const [prof, weight, meals, wkCount, plan, log, exams] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, height_cm, birth_date, weight_goal_kg, daily_water_goal_ml, daily_calorie_goal"
      )
      .eq("id", uid)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg, body_fat_pct, date")
      .eq("user_id", uid)
      .not("weight_kg", "is", null)
      .order("date", { ascending: false })
      .limit(1),
    supabase.from("meals").select("calories").eq("user_id", uid).eq("date", today),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("date", weekAgo),
    supabase
      .from("workout_plan")
      .select("sport, title")
      .eq("user_id", uid)
      .eq("day_of_week", dow),
    supabase
      .from("daily_logs")
      .select("water_ml, sleep_hours")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("exams")
      .select("title, result_value, unit, status")
      .eq("user_id", uid)
      .neq("status", "normal")
      .order("date", { ascending: false })
      .limit(5),
  ]);

  const p = prof.data;
  const age = p?.birth_date
    ? Math.floor(
        (Date.now() - new Date(p.birth_date).getTime()) /
          (365.25 * 24 * 3600 * 1000)
      )
    : null;
  const w = (weight.data ?? [])[0];
  const calToday = (meals.data ?? []).reduce(
    (s: number, m: any) => s + (Number(m.calories) || 0),
    0
  );

  const parts: string[] = [];
  if (p?.full_name) parts.push(`Nome: ${p.full_name.split(" ")[0]}`);
  if (age) parts.push(`Idade: ${age}`);
  if (p?.height_cm) parts.push(`Altura: ${p.height_cm} cm`);
  if (w?.weight_kg != null) parts.push(`Peso atual: ${w.weight_kg} kg`);
  if (p?.weight_goal_kg != null) parts.push(`Meta de peso: ${p.weight_goal_kg} kg`);
  if (w?.body_fat_pct != null) parts.push(`Gordura corporal: ${w.body_fat_pct}%`);
  parts.push(
    `Calorias hoje: ${Math.round(calToday)}${
      p?.daily_calorie_goal ? ` (meta ${p.daily_calorie_goal})` : ""
    }`
  );
  if (log.data?.water_ml != null)
    parts.push(
      `Água hoje: ${log.data.water_ml} ml${
        p?.daily_water_goal_ml ? ` (meta ${p.daily_water_goal_ml})` : ""
      }`
    );
  if (log.data?.sleep_hours != null) parts.push(`Sono: ${log.data.sleep_hours} h`);
  parts.push(`Treinos nos últimos 7 dias: ${wkCount.count ?? 0}`);
  if ((plan.data ?? []).length)
    parts.push(
      `Plano de hoje: ${(plan.data ?? [])
        .map((x: any) => x.sport + (x.title ? ` (${x.title})` : ""))
        .join(", ")}`
    );
  if ((exams.data ?? []).length)
    parts.push(
      `Exames alterados recentes: ${(exams.data ?? [])
        .map(
          (e: any) =>
            `${e.title} ${e.result_value ?? ""}${e.unit ?? ""} (${e.status})`
        )
        .join("; ")}`
    );

  return parts.join("\n");
}

export async function POST(request: Request) {
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
      { error: "O assistente não está configurado (falta a chave GROQ_API_KEY no servidor)." },
      { status: 503 }
    );
  }

  let messages: ChatMessage[] = [];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    // tratado abaixo
  }

  const recent = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (recent.length === 0) {
    return NextResponse.json({ error: "Nenhuma mensagem enviada." }, { status: 400 });
  }

  let contexto = "";
  try {
    contexto = await buildUserContext(supabase, user.id);
  } catch {
    // se falhar, segue sem contexto personalizado
  }
  const systemContent =
    SYSTEM +
    (contexto
      ? "\n\nDADOS ATUAIS DO USUÁRIO (use para personalizar quando fizer sentido; não repita tudo sem necessidade e não invente números além destes):\n" +
        contexto
      : "");

  let groqRes: Response;
  try {
    groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemContent }, ...recent],
        temperature: 0.7,
        stream: true,
      }),
    });
  } catch (err: any) {
    console.error("chat fetch error:", err?.message ?? err);
    return NextResponse.json({ error: "Falha ao contatar a IA. Tente novamente." }, { status: 502 });
  }

  if (!groqRes.ok || !groqRes.body) {
    const status = groqRes.status;
    const detail = await groqRes.text().catch(() => "");
    let reason = detail.slice(0, 200);
    try {
      reason = JSON.parse(detail)?.error?.message || reason;
    } catch {}
    console.error("chat groq error:", status, detail.slice(0, 400));
    if (status === 401) {
      return NextResponse.json(
        { error: "Chave da IA inválida. Verifique GROQ_API_KEY no servidor." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `Erro da IA (${status}): ${reason}` },
      { status: status === 429 ? 429 : 502 }
    );
  }

  // Converte o SSE (formato OpenAI) do Groq em texto puro.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const obj = JSON.parse(data);
              const text: string = obj?.choices?.[0]?.delta?.content ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // ignora linhas parciais
            }
          }
        }
      } catch (err) {
        console.error("chat stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
