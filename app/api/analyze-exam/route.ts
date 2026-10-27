import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isAbortError, parseModelJson } from "@/lib/aiHttp";
import { transcricaoDoLaudo } from "@/lib/laudo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// Só a transcrição: o juízo do exame é da nutricionista, e o paciente vê a
// posição do valor na faixa do laudo, calculada no app (spec do uso
// pretendido). O prompt antigo pedia "interpretação" e "recomendações".
const SYSTEM =
  "Você transcreve um laudo de exame (de sangue ou laboratorial). Leia o documento ou a imagem e copie, para cada resultado, o nome, o valor, a unidade e a faixa de referência exatamente como estão impressos. " +
  "Não explique, não interprete, não classifique e não recomende nada. " +
  'Responda APENAS com JSON válido (sem markdown), neste formato: {"itens": [{"nome": "Colesterol total", "valor": "180", "unidade": "mg/dL", "referencia": "< 190"}]}. ' +
  'Se não houver faixa impressa, use null. Se não conseguir ler o laudo, devolva {"itens": []}.';

const MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
      { error: "A leitura de exames não está configurada (falta a chave GEMINI_API_KEY no servidor)." },
      { status: 503 }
    );
  }

  let mediaType: string | undefined;
  let base64: string | undefined;
  try {
    const body = (await request.json()) as { file?: string };
    const dataUrl = body.file ?? "";
    const match = /^data:([a-zA-Z/+.-]+);base64,(.+)$/.exec(dataUrl);
    if (match) {
      mediaType = match[1];
      base64 = match[2];
    }
  } catch {
    // tratado abaixo
  }

  if (!base64 || !mediaType || !MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: "Arquivo inválido. Envie um PDF ou uma foto (JPEG/PNG) do exame." },
      { status: 400 }
    );
  }

  // Limite de tamanho (~8MB de base64 ≈ 6MB de arquivo)
  if (base64.length > 8_500_000) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Envie um PDF/foto menor (até ~6MB)." },
      { status: 413 }
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const to = withTimeout(45_000);
  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      signal: to.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mediaType, data: base64 } },
              { text: "Leia este exame e gere a análise no formato pedido." },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok) {
      const status = geminiRes.status;
      const detail = await geminiRes.text().catch(() => "");
      let reason = detail.slice(0, 200);
      try {
        reason = JSON.parse(detail)?.error?.message || reason;
      } catch {}
      console.error("analyze-exam gemini error:", status, detail.slice(0, 400));
      return NextResponse.json(
        { error: `Erro da IA (${status}): ${reason}` },
        { status: status === 429 ? 429 : 502 }
      );
    }

    const payload = await geminiRes.json();
    const text: string =
      payload?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("") ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Não foi possível ler o exame. Tente uma foto mais nítida ou o PDF." },
        { status: 422 }
      );
    }

    const result = parseModelJson(text);
    if (!result) {
      return NextResponse.json(
        { error: "A IA retornou uma resposta inválida. Tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({ itens: transcricaoDoLaudo(result) });
  } catch (err: any) {
    if (isAbortError(err)) {
      return NextResponse.json(
        { error: "A IA demorou demais para responder. Tente um arquivo menor." },
        { status: 504 }
      );
    }
    console.error("analyze-exam error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao ler o exame. Tente novamente." },
      { status: 500 }
    );
  } finally {
    to.clear();
  }
}
