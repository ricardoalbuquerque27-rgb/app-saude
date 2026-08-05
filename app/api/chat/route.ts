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
        messages: [{ role: "system", content: SYSTEM }, ...recent],
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
