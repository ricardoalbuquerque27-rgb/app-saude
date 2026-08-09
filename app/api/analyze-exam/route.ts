import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isAbortError, parseModelJson } from "@/lib/aiHttp";
import { classifyExam, type Sex } from "@/lib/examRanges";

function ageFromBirth(birth?: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 130 ? age : null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const SYSTEM =
  "Você é um assistente de saúde que ajuda a pessoa a ENTENDER um exame (geralmente exame de sangue ou laboratorial). " +
  "Leia o documento/imagem, extraia os resultados e compare com os valores de referência que aparecem nele. " +
  "Explique em linguagem SIMPLES, em português do Brasil, o que os principais achados significam. " +
  "IMPORTANTE (segurança): você NÃO faz diagnóstico e NÃO substitui um médico. Sempre oriente confirmar com um profissional de saúde, " +
  "principalmente se houver valores alterados. Não recomende medicamentos.\n\n" +
  "Responda APENAS com JSON válido (sem markdown), exatamente neste formato:\n" +
  "{\n" +
  '  "resumo": "2 a 4 frases com a visão geral do exame",\n' +
  '  "itens": [{ "nome": "ex.: Colesterol total", "valor": "180", "unidade": "mg/dL", "referencia": "< 200", "status": "normal|atencao|alterado" }],\n' +
  '  "interpretacao": ["explicações simples do que os principais resultados indicam"],\n' +
  '  "recomendacoes": ["orientações gerais e hábitos; SEMPRE inclua procurar um médico para avaliação"]\n' +
  "}\n" +
  'Marque "status" como "alterado" quando o valor estiver claramente fora da referência, "atencao" quando estiver no limite, e "normal" quando estiver dentro. ' +
  "Se não conseguir ler o exame, retorne resumo explicando e listas vazias.";

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

    // Reclassifica cada item com nossas faixas de referência (personalizadas
    // por sexo e idade), em vez de confiar no palpite da IA.
    const { data: prof } = await supabase
      .from("profiles")
      .select("sex, birth_date")
      .eq("id", user.id)
      .maybeSingle();
    const ctx = {
      sex: (prof?.sex as Sex) ?? null,
      age: ageFromBirth(prof?.birth_date),
    };
    const rawItens = Array.isArray(result.itens) ? result.itens : [];
    const itens = rawItens.map((it: any) => {
      const cls = classifyExam({
        name: String(it?.nome ?? ""),
        value: it?.valor,
        unit: it?.unidade,
        reference: it?.referencia,
        ctx,
      });
      if (!cls.matched) return it; // mantém o que a IA leu
      return {
        ...it,
        status: cls.status,
        referencia: cls.faixa || it?.referencia,
        explicacao: cls.explicacao,
      };
    });

    return NextResponse.json({
      resumo: String(result.resumo ?? ""),
      itens,
      interpretacao: Array.isArray(result.interpretacao) ? result.interpretacao : [],
      recomendacoes: Array.isArray(result.recomendacoes) ? result.recomendacoes : [],
    });
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
