import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo do Google Gemini usado para analisar a foto. Pode ser trocado sem
// editar o código, definindo a variável GEMINI_MODEL no Vercel.
// Opções do nível gratuito: "gemini-2.5-flash" ou "gemini-2.0-flash".
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM =
  "Você é um nutricionista que estima o conteúdo nutricional de refeições a partir de uma foto do prato. " +
  "Identifique cada alimento e estime porções realistas com base no tamanho aparente e em referências visuais (talheres, prato). " +
  "Some as calorias e macros de todos os itens. Seja realista: prefira estimativas médias a extremos. " +
  "Responda SEMPRE em português do Brasil.\n\n" +
  "Responda APENAS com um JSON válido, sem texto extra e sem markdown, exatamente neste formato:\n" +
  "{\n" +
  '  "is_food": true,\n' +
  '  "description": "descrição curta listando os alimentos e porções, ex.: 2 ovos, 50g de arroz, 1 filé de frango",\n' +
  '  "calories": 0,\n' +
  '  "protein_g": 0,\n' +
  '  "carbs_g": 0,\n' +
  '  "fat_g": 0,\n' +
  '  "items": [{ "name": "nome do alimento", "calories": 0 }],\n' +
  '  "confidence": "alta"\n' +
  "}\n" +
  'Os números são estimativas (calorias em kcal, macros em gramas). "confidence" deve ser "alta", "media" ou "baixa". ' +
  'Se a imagem NÃO mostrar comida, retorne is_food=false e todos os números em 0.';

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  // Exige usuário autenticado para evitar uso indevido da chave da API.
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
      { error: "A análise por foto não está configurada (falta a chave da IA no servidor)." },
      { status: 503 }
    );
  }

  let mediaType: string | undefined;
  let base64: string | undefined;
  try {
    const body = (await request.json()) as { image?: string };
    const dataUrl = body.image ?? "";
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (match) {
      mediaType = match[1];
      base64 = match[2];
    }
  } catch {
    // corpo inválido tratado abaixo
  }

  if (!base64 || !mediaType || !MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: "Imagem inválida. Envie uma foto JPEG, PNG ou WebP." },
      { status: 400 }
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mediaType, data: base64 } },
              {
                text: "Analise a foto deste prato e estime as calorias e macros de tudo que está nele.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!geminiRes.ok) {
      const status = geminiRes.status;
      if (status === 400 || status === 403) {
        return NextResponse.json(
          { error: "Chave da IA inválida ou sem permissão. Verifique GEMINI_API_KEY no servidor." },
          { status: 503 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "Limite gratuito da IA atingido no momento. Tente novamente mais tarde." },
          { status: 429 }
        );
      }
      const detail = await geminiRes.text().catch(() => "");
      console.error("gemini error:", status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "Falha ao analisar a foto. Tente novamente." },
        { status: 502 }
      );
    }

    const payload = await geminiRes.json();
    const text: string | undefined =
      payload?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("") || undefined;

    if (!text) {
      return NextResponse.json(
        { error: "Não foi possível analisar esta imagem. Tente outra foto." },
        { status: 422 }
      );
    }

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      // Remove cercas de markdown caso o modelo as inclua.
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      result = JSON.parse(cleaned);
    }

    if (result.is_food === false) {
      return NextResponse.json(
        { error: "Não identifiquei comida nesta foto. Tente outra imagem do prato." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      description: String(result.description ?? ""),
      calories: Math.round(Number(result.calories) || 0),
      protein_g: Math.round(Number(result.protein_g) || 0),
      carbs_g: Math.round(Number(result.carbs_g) || 0),
      fat_g: Math.round(Number(result.fat_g) || 0),
      items: Array.isArray(result.items) ? result.items : [],
      confidence: result.confidence ?? "media",
    });
  } catch (err: any) {
    console.error("analyze-meal error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao analisar a foto. Tente novamente." },
      { status: 500 }
    );
  }
}
