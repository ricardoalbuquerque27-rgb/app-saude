import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM =
  "Você é o assistente do Pace Fit, um app de saúde e fitness. Você atua como um nutricionista e personal trainer virtual, " +
  "ajudando o usuário com dúvidas sobre alimentação/dieta, treinos, organização da rotina, hábitos (água, sono, humor) e " +
  "como usar o próprio app.\n\n" +
  "Sobre o app Pace Fit, para orientar o usuário:\n" +
  "- Treinos: registrar exercícios, séries, cargas e acompanhar a evolução.\n" +
  "- Dieta: registrar refeições e macros; há um botão para analisar a FOTO do prato e estimar calorias e macros automaticamente.\n" +
  "- Medidas: registrar peso e medidas corporais e ver gráficos.\n" +
  "- Hábitos: acompanhar água, sono e humor no dia a dia.\n" +
  "- Exames: guardar resultados de exames.\n\n" +
  "Como responder:\n" +
  "- Sempre em português do Brasil, com tom amigável, prático e motivador.\n" +
  "- Seja objetivo. Use parágrafos curtos e, quando fizer listas, use hífens simples (-). Evite markdown pesado (nada de **, ##).\n" +
  "- Dê exemplos concretos (porções, substituições, séries) quando ajudar.\n" +
  "- Faça perguntas de acompanhamento quando faltar informação (objetivo, peso, restrições).\n\n" +
  "Importante (segurança): você não substitui um profissional de saúde. Para condições médicas, uso de medicamentos, " +
  "gravidez, ou dietas muito restritivas, oriente a pessoa a procurar um nutricionista ou médico. Não faça diagnósticos.";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "O assistente não está configurado (falta a chave da IA no servidor)." },
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

  // Mantém só as últimas mensagens para limitar o tamanho do contexto.
  const recent = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-20);

  if (recent.length === 0) {
    return NextResponse.json({ error: "Nenhuma mensagem enviada." }, { status: 400 });
  }

  const contents = recent.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.7 },
      }),
    });
  } catch (err: any) {
    console.error("chat fetch error:", err?.message ?? err);
    return NextResponse.json({ error: "Falha ao contatar a IA. Tente novamente." }, { status: 502 });
  }

  if (!geminiRes.ok || !geminiRes.body) {
    const status = geminiRes.status;
    const detail = await geminiRes.text().catch(() => "");
    // Extrai a mensagem de erro do Gemini, se houver.
    let reason = detail.slice(0, 200);
    try {
      const j = JSON.parse(detail);
      reason = j?.error?.message || j?.error?.status || reason;
    } catch {
      // mantém o texto bruto
    }
    console.error("chat gemini error:", status, detail.slice(0, 500));
    if (status === 429) {
      return NextResponse.json(
        { error: "Limite gratuito da IA atingido no momento. Tente novamente mais tarde." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Erro da IA (${status}): ${reason}` },
      { status: 502 }
    );
  }

  // Converte o SSE do Gemini num fluxo de texto puro para o navegador.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
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
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const obj = JSON.parse(jsonStr);
              const text: string =
                obj?.candidates?.[0]?.content?.parts
                  ?.map((p: any) => p?.text ?? "")
                  .join("") ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // ignora linhas parciais/não-JSON
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
