import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isAbortError } from "@/lib/aiHttp";
import { nomeValido, pedidoDaExplicacao, respostaDaExplicacao } from "@/lib/explicacaoDeExame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// O "O que é?" da página Exames. A IA só recebe o nome do exame, então não tem
// como falar do resultado do paciente; e a resposta passa pela checagem de
// `respostaDaExplicacao` antes de chegar à tela (spec do uso pretendido).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const nome = nomeValido(body?.nome);
  if (!nome) {
    return NextResponse.json({ error: "Nome do exame inválido." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "A IA não está configurada (falta a chave GROQ_API_KEY no servidor)." },
      { status: 503 }
    );
  }

  const to = withTimeout(20_000);
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
        messages: pedidoDaExplicacao(nome),
        temperature: 0.2,
        max_tokens: 120,
      }),
    });
    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => "");
      console.error("explicar-exame groq error:", groqRes.status, detail.slice(0, 400));
      return NextResponse.json({ error: "Erro da IA." }, { status: 502 });
    }
    const payload = await groqRes.json();
    const conteudo: string = payload?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ texto: respostaDaExplicacao(conteudo) });
  } catch (err: any) {
    if (isAbortError(err)) {
      return NextResponse.json({ error: "A IA demorou demais para responder." }, { status: 504 });
    }
    console.error("explicar-exame error:", err?.message ?? err);
    return NextResponse.json({ error: "Falha ao explicar o exame." }, { status: 502 });
  } finally {
    to.clear();
  }
}
