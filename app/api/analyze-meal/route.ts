import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo usado para analisar a foto. Pode ser trocado sem editar o código,
// definindo a variável de ambiente ANTHROPIC_MODEL no Vercel.
// Alternativas mais baratas: "claude-sonnet-5" ou "claude-haiku-4-5".
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SCHEMA = {
  type: "object",
  properties: {
    is_food: {
      type: "boolean",
      description: "true se a imagem mostra comida/bebida; false caso contrário",
    },
    description: {
      type: "string",
      description:
        "Descrição curta do prato em português, listando os alimentos e porções estimadas. Ex.: '2 ovos, 50g de arroz, 1 filé de frango grelhado'",
    },
    calories: { type: "number", description: "Total estimado de calorias (kcal)" },
    protein_g: { type: "number", description: "Total estimado de proteína (g)" },
    carbs_g: { type: "number", description: "Total estimado de carboidratos (g)" },
    fat_g: { type: "number", description: "Total estimado de gordura (g)" },
    items: {
      type: "array",
      description: "Alimentos identificados no prato",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do alimento em português" },
          calories: { type: "number", description: "Calorias estimadas do item (kcal)" },
        },
        required: ["name", "calories"],
        additionalProperties: false,
      },
    },
    confidence: {
      type: "string",
      enum: ["alta", "media", "baixa"],
      description: "Nível de confiança da estimativa",
    },
  },
  required: [
    "is_food",
    "description",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "items",
    "confidence",
  ],
  additionalProperties: false,
} as const;

const SYSTEM =
  "Você é um nutricionista que estima o conteúdo nutricional de refeições a partir de uma foto do prato. " +
  "Identifique cada alimento e estime porções realistas com base no tamanho aparente e em referências visuais (talheres, prato). " +
  "Some as calorias e macros de todos os itens. Seja realista: prefira estimativas médias a extremos. " +
  "Responda sempre em português do Brasil. Se a imagem não mostrar comida, defina is_food como false e zere os valores.";

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

  if (!process.env.ANTHROPIC_API_KEY) {
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

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Analise a foto deste prato e estime as calorias e macros de tudo que está nele.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Não foi possível analisar esta imagem." },
        { status: 422 }
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Resposta inesperada da IA." },
        { status: 502 }
      );
    }

    const result = JSON.parse(textBlock.text);

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
    const status = err?.status;
    if (status === 401) {
      return NextResponse.json(
        { error: "Chave da IA inválida. Verifique ANTHROPIC_API_KEY no servidor." },
        { status: 503 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Muitas requisições no momento. Tente novamente em instantes." },
        { status: 429 }
      );
    }
    console.error("analyze-meal error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Falha ao analisar a foto. Tente novamente." },
      { status: 500 }
    );
  }
}
