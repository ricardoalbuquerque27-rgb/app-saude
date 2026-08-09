import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isAbortError } from "@/lib/aiHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel de diagnóstico: informa se as variáveis de ambiente do servidor
// estão configuradas (apenas true/false — NUNCA expõe os valores) e faz uma
// verificação ao vivo da chave do Groq. Protegido por login.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const has = (v?: string | null) => typeof v === "string" && v.trim().length > 0;

  // Verificação ao vivo da chave do Groq (a mais crítica para o chat/ações).
  let groqStatus: "ok" | "invalid" | "unreachable" | "absent" = "absent";
  const groqKey = process.env.GROQ_API_KEY;
  if (has(groqKey)) {
    const to = withTimeout(8000);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
        signal: to.signal,
      });
      groqStatus = res.ok ? "ok" : res.status === 401 ? "invalid" : "unreachable";
    } catch (err) {
      groqStatus = isAbortError(err) ? "unreachable" : "unreachable";
    } finally {
      to.clear();
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    groq: {
      present: has(groqKey),
      status: groqStatus,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    gemini: {
      present: has(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    },
    supabase: {
      url: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
      anon: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    push: {
      publicKey: has(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      privateKey: has(process.env.VAPID_PRIVATE_KEY),
      subject: has(process.env.VAPID_SUBJECT),
    },
    cron: {
      present: has(process.env.CRON_SECRET),
    },
  });
}
