import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push não configurado (falta VAPID_PRIVATE_KEY no servidor)." },
      { status: 503 }
    );
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dispositivo inscrito. Ative os lembretes primeiro." },
      { status: 400 }
    );
  }

  const payload = {
    title: "Notificação de teste ✅",
    body: "Seus lembretes do Pace Fit estão funcionando!",
    url: "/app",
    tag: "pacefit-test",
  };

  let sent = 0;
  for (const s of subs) {
    const status = await sendPush(s, payload);
    if (status === 201 || status === 200) {
      sent++;
    } else if (status === 404 || status === 410) {
      // assinatura expirada — remove
      await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }

  return NextResponse.json({ sent });
}
