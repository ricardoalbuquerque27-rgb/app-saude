"use client";

import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY, pushConfigurado } from "@/lib/vapidPublicKey";
import { chaveDaBase64, mesmaChave } from "@/lib/chaveDePush";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Pede permissão (se necessário), cria a assinatura de push e salva no banco.
// Retorna "ok" | "denied" | "unsupported" | "error".
export async function ensurePushSubscription(): Promise<
  "ok" | "denied" | "unsupported" | "error"
> {
  // Sem a chave pública o push está desligado no app inteiro: nada se inscreve.
  if (!pushConfigurado() || !pushSupported()) return "unsupported";
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";

  try {
    const reg = await navigator.serviceWorker.ready;
    const chave = chaveDaBase64(VAPID_PUBLIC_KEY);
    let sub = await reg.pushManager.getSubscription();
    // A inscrição que o navegador guarda pode ser de outra chave (a que estava
    // escrita no código, ou uma trocada depois): reaproveitada, nunca
    // receberia nada. Sai, com a linha dela no banco, e entra uma nova.
    if (sub && !mesmaChave(sub.options?.applicationServerKey, chave)) {
      const velho = sub.endpoint;
      await sub.unsubscribe().catch(() => false);
      await createClient().from("push_subscriptions").delete().eq("endpoint", velho);
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chave,
      });
    }
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "error";

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "error";

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}
