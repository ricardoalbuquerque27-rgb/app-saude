import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/webpush";
import { pushConfigurado } from "@/lib/vapidPublicKey";
import { notificacaoDaRefeicao } from "@/lib/lembretesDasRefeicoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint chamado pelo agendador (o pacefit-reminders, no pg_cron do
// Supabase, a cada 15 minutos). Envia os lembretes que estão no horário de
// cada usuário: o diário, o da caneta e os das refeições. Protegido pelo
// CRON_SECRET.
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
  if (!pushConfigurado()) {
    return NextResponse.json({ error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente." }, { status: 503 });
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

  async function deliver(
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: Record<string, unknown>
  ) {
    const status = await sendPush(sub, payload);
    if (status === 201 || status === 200) {
      sent++;
    } else if (status === 404 || status === 410) {
      await supabase.rpc("prune_push_endpoint", {
        p_secret: secret!,
        p_endpoint: sub.endpoint,
      });
      pruned++;
    }
  }

  for (const r of rows) {
    await deliver(
      { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
      {
        title: `Bora, ${r.first_name}! 💪`,
        body: "Registre um treino, refeição ou hábito hoje para manter sua sequência.",
        url: "/app",
        tag: "pacefit-reminder",
      }
    );
  }

  // Lembretes de aplicação da caneta (GLP-1)
  const { data: doseDue } = await supabase.rpc("due_dose_reminders", {
    p_secret: secret,
  });
  const doseRows = (doseDue ?? []) as {
    user_id: string;
    medication: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  for (const d of doseRows) {
    await deliver(
      { endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth },
      {
        title: "Dia da aplicação 💉",
        body: `Hoje é dia da sua dose de ${d.medication}. Não esqueça de registrar!`,
        url: "/app/tratamento",
        tag: "pacefit-dose",
      }
    );
  }

  // Os lembretes das refeições ("Almoço: você comeu?"), um por refeição do
  // cardápio, no horário de cada paciente. A função marca o que devolve como
  // enviado. O erro dela não derruba os lembretes acima (antes da migração
  // 20261027120000 ela nem existe) e volta na resposta, para quem olha o log.
  const { data: refeicoesDue, error: erroRefeicoes } = await supabase.rpc("refeicoes_devidas", {
    p_secret: secret,
  });
  const refeicoes = (refeicoesDue ?? []) as {
    user_id: string;
    data: string;
    refeicao: string;
    itens: { description: string }[];
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  for (const r of refeicoes) {
    await deliver({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, notificacaoDaRefeicao(r));
  }

  return NextResponse.json({
    due: rows.length,
    dose: doseRows.length,
    refeicoes: erroRefeicoes ? null : refeicoes.length,
    ...(erroRefeicoes ? { erroRefeicoes: erroRefeicoes.message } : {}),
    sent,
    pruned,
  });
}
