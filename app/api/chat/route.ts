import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/date";
import { withTimeout, isAbortError } from "@/lib/aiHttp";
import { AI_TOOLS, executeAction, TOOL_AREAS } from "@/lib/aiActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Groq (gratuito, rápido). Modelo trocável via GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM =
  "Você é a Gaia, a assistente de saúde do app. Seu nome vem de Gaia (a Terra): você representa cuidado, " +
  "equilíbrio e vida. Você atua como uma nutricionista e personal trainer virtual, acompanhando o usuário na " +
  "alimentação/dieta, treinos, rotina, hábitos (água, sono, humor), exames e tratamento — e usa as ferramentas do " +
  "app para registrar as coisas por ele.\n\n" +
  "PERSONALIDADE (seja sempre a Gaia):\n" +
  "- Acolhedora, próxima e SEM JULGAMENTO: nunca envergonhe o usuário por peso, comida, recaída ou resultado. " +
  "Todo corpo, meta e ritmo são bem-vindos (inclusive quem usa caneta/GLP-1).\n" +
  "- Adapte o tom ao momento (misture os três jeitos conforme a situação):\n" +
  "  • Conquistas e rotina: motive com energia leve, comemore os pequenos passos e aponte o próximo passo.\n" +
  "  • Deslizes ou dificuldade: fique serena e gentil, tire a pressão e foque no próximo dia.\n" +
  "  • Exames, saúde e tratamento: tom calmo e confiável de especialista — explique simples e reforce procurar um profissional.\n" +
  "- Fale como gente: frases curtas, use o primeiro nome do usuário quando souber. Emojis com moderação e a cara da Gaia (🌱 e 💚 combinam), no máximo 1 por mensagem.\n" +
  "- Você é a mesma Gaia em qualquer tela (é um balão flutuante presente no app todo). Refira-se a si mesma como Gaia quando fizer sentido, sem repetir o nome a cada frase.\n\n" +
  "Sobre o app, para orientar o usuário:\n" +
  "- Treinos: plano semanal (esporte e treinos por dia) e histórico de treinos com exercícios.\n" +
  "- Dieta: registrar refeições e macros; há um botão para analisar a FOTO do prato e estimar calorias e macros.\n" +
  "- Medidas: registrar peso e medidas corporais e ver gráficos.\n" +
  "- Hábitos: acompanhar água, sono e humor.\n" +
  "- Exames: guardar resultados de exames.\n" +
  "- Relatórios: a IA analisa os últimos 30 dias e traz o que melhorar.\n\n" +
  "AÇÕES NO APP (importante): você PODE mexer no app do usuário usando as ferramentas disponíveis:\n" +
  "- Adicionar: treinos ao plano semanal, treino feito, refeições, água, peso, hábitos (sono/humor/energia/estresse/passos), exames e a dose da caneta (GLP-1).\n" +
  "- Concluir o treino planejado de hoje; definir/ajustar metas (peso alvo, calorias, proteína, água).\n" +
  "- Editar e desfazer: corrigir o peso, tirar/corrigir a água, apagar o último registro (refeição, treino, peso, exame) e remover uma sessão do plano semanal.\n" +
  "Assim o usuário não precisa digitar nem mexer nas telas manualmente.\n" +
  "Regras para usar as ferramentas:\n" +
  "- Só execute uma ação quando o usuário pedir claramente (adicionar/salvar/registrar, ou apagar/desfazer/remover/corrigir/mudar). " +
  "Se você acabou de sugerir algo e o usuário ainda não confirmou, PERGUNTE antes (a não ser que ele já tenha pedido).\n" +
  "- Para APAGAR/REMOVER, tenha certeza do que ele quer; confirme em 1 frase o que foi apagado. Nunca apague sem pedido explícito.\n" +
  "- Ao montar um plano semanal, envie todas as sessões de uma vez, com o dia da semana certo e detalhes úteis (exercícios/séries nas observações).\n" +
  "- EXAMES: quando o usuário só mencionar um resultado ou perguntar se está normal (curiosidade), use 'avaliar_exame' (NÃO salva) para responder com a classificação correta e DEPOIS pergunte se ele quer que você adicione na aba Exames. Só use 'registrar_exame' (que salva) quando ele pedir para registrar/salvar ou confirmar que quer adicionar. Nunca classifique exame por conta própria — use sempre as ferramentas.\n" +
  "- Depois de executar, confirme em 1 frase curta o que foi feito e onde o usuário encontra (ex.: 'Pronto! Adicionei na aba Treinos › Plano semanal.').\n" +
  "- Se uma ação falhar, avise com naturalidade e ofereça tentar de novo. Nunca invente que salvou se a ferramenta não confirmou.\n\n" +
  "Como responder:\n" +
  "- Sempre em português do Brasil, com tom amigável, prático e motivador.\n" +
  "- Seja objetivo. Parágrafos curtos e listas com hífens (-). Evite markdown pesado (nada de **, ##).\n" +
  "- Dê exemplos concretos (porções, substituições, séries) quando ajudar.\n\n" +
  "Importante (segurança): você não substitui um profissional de saúde. Para condições médicas, medicamentos, " +
  "gravidez ou dietas muito restritivas, oriente a procurar um nutricionista ou médico. Não faça diagnósticos.";

const encoder = new TextEncoder();

// Faz uma chamada streaming ao Groq. Reenvia o texto (content) para o cliente
// conforme chega e acumula eventuais chamadas de ferramenta (tool_calls).
async function streamGroqRound(
  apiKey: string,
  messages: any[],
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<{ toolCalls: { id: string; name: string; args: string }[] }> {
  const to = withTimeout(30_000);
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: to.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: AI_TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
        stream: true,
      }),
    });
  } finally {
    to.clear();
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("chat groq round error:", res.status, detail.slice(0, 300));
    throw new Error(`groq ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolAcc: Record<number, { id: string; name: string; args: string }> = {};

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
        const delta = obj?.choices?.[0]?.delta;
        if (delta?.content) {
          controller.enqueue(encoder.encode(delta.content));
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = (toolAcc[idx] ||= { id: "", name: "", args: "" });
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
          }
        }
      } catch {
        // ignora linhas parciais
      }
    }
  }

  const toolCalls = Object.keys(toolAcc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((k) => toolAcc[k])
    .filter((t) => t.name);
  return { toolCalls };
}

type ChatMessage = { role: "user" | "assistant"; content: string };

// Monta um resumo dos dados do usuário para personalizar as respostas.
async function buildUserContext(supabase: any, uid: string): Promise<string> {
  const today = todayISO();
  const weekAgo = addDaysISO(today, -7);
  const dow = (new Date(today + "T12:00:00").getDay() + 6) % 7;

  const [prof, weight, meals, wkCount, plan, log, exams, treat] =
    await Promise.all([
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
    supabase
      .from("treatments")
      .select("medication, dose, frequency_days")
      .eq("user_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  if (treat.data) {
    const freq =
      treat.data.frequency_days === 7
        ? "semanal"
        : treat.data.frequency_days === 1
          ? "diária"
          : `a cada ${treat.data.frequency_days} dias`;
    parts.push(
      `Tratamento com caneta (GLP-1): usa ${treat.data.medication}${
        treat.data.dose ? ` (${treat.data.dose})` : ""
      }, aplicação ${freq}. ORIENTE de acordo: priorize proteína (preservar músculo), boa hidratação, comer devagar e em menor quantidade, fibras contra constipação, e reforce procurar o médico para ajuste de dose ou efeitos fortes. NUNCA sugira ou altere doses de medicamento.`
    );
  }

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

  // Mensagens da conversa (mutável ao longo das rodadas de ferramentas).
  const convo: any[] = [{ role: "system", content: systemContent }, ...recent];

  // Chamada de sondagem: valida a chave/serviço ANTES de abrir o stream,
  // para conseguirmos devolver erros como JSON (o cliente sabe tratar).
  const to = withTimeout(15_000);
  let probe: Response;
  try {
    probe = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: to.signal,
    });
  } catch (err: any) {
    to.clear();
    if (isAbortError(err)) {
      return NextResponse.json(
        { error: "A IA demorou demais para responder. Tente novamente." },
        { status: 504 }
      );
    }
    console.error("chat probe error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao contatar a IA. Tente novamente." },
      { status: 502 }
    );
  }
  to.clear();
  if (probe.status === 401) {
    return NextResponse.json(
      { error: "Chave da IA inválida. Verifique GROQ_API_KEY no servidor." },
      { status: 503 }
    );
  }

  // Loop de ferramentas: o modelo pode pedir ações (registrar treino, etc.).
  // Cada rodada faz streaming do texto para o cliente; se houver tool_calls,
  // executamos e voltamos ao modelo para ele confirmar em linguagem natural.
  // Áreas do app alteradas por ações bem-sucedidas (para o cliente recarregar).
  const affected = new Set<string>();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let round = 0; round < 5; round++) {
          const { toolCalls } = await streamGroqRound(apiKey, convo, controller);
          if (toolCalls.length === 0) break; // o modelo respondeu em texto

          // Registra a mensagem do assistente com as chamadas de ferramenta.
          convo.push({
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map((t) => ({
              id: t.id,
              type: "function",
              function: { name: t.name, arguments: t.args },
            })),
          });

          // Executa cada ferramenta e devolve o resultado ao modelo.
          for (const t of toolCalls) {
            const result = await executeAction(t.name, t.args, supabase, user.id);
            if (result.ok) {
              if (TOOL_AREAS[t.name]) affected.add(TOOL_AREAS[t.name]);
              if (result.area) {
                (Array.isArray(result.area) ? result.area : [result.area]).forEach(
                  (a) => affected.add(a)
                );
              }
            }
            convo.push({
              role: "tool",
              tool_call_id: t.id,
              content: JSON.stringify(result),
            });
          }
        }
      } catch (err) {
        console.error("chat loop error:", err);
        try {
          controller.enqueue(
            encoder.encode(
              "\n\nDesculpe, tive um problema para concluir agora. Pode tentar de novo?"
            )
          );
        } catch {}
      } finally {
        // Marcador fora de banda: informa ao cliente quais áreas mudaram, para
        // ele recarregar as telas abertas. O ChatWidget remove isto do texto.
        if (affected.size > 0) {
          try {
            controller.enqueue(
              encoder.encode(` PF_REFRESH:${Array.from(affected).join(",")}`)
            );
          } catch {}
        }
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
