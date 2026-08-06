import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "./vapidPublicKey";

export { VAPID_PUBLIC_KEY };

let configured = false;

// Configura o web-push com as chaves VAPID (privada vem do ambiente).
export function getWebPush() {
  if (!configured) {
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("VAPID_PRIVATE_KEY não configurada");
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:comercial@paceit.com.br",
      VAPID_PUBLIC_KEY,
      privateKey
    );
    configured = true;
  }
  return webpush;
}

export type PushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Envia uma notificação para uma assinatura. Retorna o status HTTP (ou 0 em erro).
// 404/410 significam assinatura expirada — o chamador deve removê-la.
export async function sendPush(
  row: PushRow,
  payload: Record<string, unknown>
): Promise<number> {
  const wp = getWebPush();
  try {
    await wp.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload)
    );
    return 201;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode ?? 0;
    return status;
  }
}
