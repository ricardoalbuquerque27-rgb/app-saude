import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint chamado pelo agendador (Vercel Cron). Envia os lembretes que estão
// no horário de cada usuário. Protegido pelo CRON_SECRET.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET ausente." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID_PRIVATE_KEY ausente." }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Busca (e marca como enviados) os lembretes devidos — função protegida por segredo.
  const { data: due, error } = await supabase.rpc("due_reminders", {
    p_secret: secret,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (due ?? []) as {
    user_id: string;
    first_name: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];

  let sent = 0;
  let pruned = 0;
  for (const r of rows) {
    const payload = {
      title: `Bora, ${r.first_name}! 💪`,
      body: "Registre um treino, refeição ou hábito hoje para manter sua sequência.",
      url: "/app",
      tag: "pacefit-reminder",
    };
    const status = await sendPush(
      { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
      payload
    );
    if (status === 201 || status === 200) {
      sent++;
    } else if (status === 404 || status === 410) {
      await supabase.rpc("prune_push_endpoint", {
        p_secret: secret,
        p_endpoint: r.endpoint,
      });
      pruned++;
    }
  }

  return NextResponse.json({ due: rows.length, sent, pruned });
}
