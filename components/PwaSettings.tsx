"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Smartphone,
  Bell,
  BellOff,
  Check,
  Share,
  PlusSquare,
  Download,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/vapidPublicKey";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PwaSettings() {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const [supported, setSupported] = useState(true);
  const [reminderOn, setReminderOn] = useState(false);
  const [time, setTime] = useState("19:00");
  const [permDenied, setPermDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("reminder_enabled, reminder_time")
      .maybeSingle();
    if (data) {
      setReminderOn(!!data.reminder_enabled);
      if (data.reminder_time) setTime(data.reminder_time.slice(0, 5));
    }
  }, []);

  useEffect(() => {
    setInstalled(isStandalone());
    setSupported(pushSupported());
    setCanPrompt(
      !!(window as unknown as { __pfInstallPrompt?: Event }).__pfInstallPrompt
    );
    if (typeof Notification !== "undefined" && Notification.permission === "denied")
      setPermDenied(true);
    loadPrefs();

    const onInstallable = () => setCanPrompt(true);
    const onInstalled = () => {
      setInstalled(true);
      setCanPrompt(false);
    };
    window.addEventListener("pf-installable", onInstallable);
    window.addEventListener("pf-installed", onInstalled);
    return () => {
      window.removeEventListener("pf-installable", onInstallable);
      window.removeEventListener("pf-installed", onInstalled);
    };
  }, [loadPrefs]);

  async function install() {
    const evt = (window as unknown as { __pfInstallPrompt?: InstallEvent })
      .__pfInstallPrompt;
    if (!evt) {
      if (isIOS()) setShowIosHelp(true);
      return;
    }
    await evt.prompt();
    const choice = await evt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstalled(true);
      setCanPrompt(false);
    }
    (window as unknown as { __pfInstallPrompt?: Event | null }).__pfInstallPrompt =
      null;
  }

  // Cria a assinatura de push e salva no banco.
  async function subscribeAndSave(): Promise<boolean> {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
    return !error;
  }

  async function savePrefs(enabled: boolean, t: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        reminder_enabled: enabled,
        reminder_time: t,
        reminder_tz_offset: new Date().getTimezoneOffset(),
      })
      .eq("id", user.id);
  }

  async function toggleReminder() {
    if (busy) return;
    if (reminderOn) {
      setBusy(true);
      setReminderOn(false);
      try {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe().catch(() => {});
          const supabase = createClient();
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        }
        await savePrefs(false, time);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Ligar
    if (!supported) {
      setPermDenied(false);
      return;
    }
    setBusy(true);
    try {
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPermDenied(perm === "denied");
        return;
      }
      setPermDenied(false);
      const ok = await subscribeAndSave();
      if (!ok) return;
      await savePrefs(true, time);
      setReminderOn(true);
    } finally {
      setBusy(false);
    }
  }

  async function changeTime(v: string) {
    setTime(v);
    if (reminderOn) await savePrefs(true, v);
  }

  async function testNotification() {
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sent > 0) {
        setTested(true);
        setTimeout(() => setTested(false), 2500);
      } else {
        setTestMsg(
          data?.error ??
            "Não foi possível enviar agora. O envio pode não estar configurado no servidor ainda."
        );
      }
    } catch {
      setTestMsg("Falha de conexão ao testar.");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Instalar o app */}
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Instalar no celular
            </h2>
            {installed ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-400">
                <Check className="h-4 w-4" /> App instalado. Aproveite! 🎉
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Adicione o Pace Fit à tela inicial e use como um app de verdade,
                em tela cheia.
              </p>
            )}

            {!installed && (
              <>
                <button
                  onClick={install}
                  className="btn-primary mt-3 w-full py-2.5 sm:w-auto sm:px-5"
                >
                  <Download className="h-4 w-4" />
                  {isIOS() ? "Como instalar" : "Instalar app"}
                </button>

                {(showIosHelp || (isIOS() && !canPrompt)) && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      No iPhone/iPad (Safari):
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Share className="h-4 w-4 shrink-0 text-brand-600" /> 1.
                        Toque no botão <b>Compartilhar</b>.
                      </li>
                      <li className="flex items-center gap-2">
                        <PlusSquare className="h-4 w-4 shrink-0 text-brand-600" />{" "}
                        2. Escolha <b>Adicionar à Tela de Início</b>.
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-brand-600" /> 3.
                        Abra o app pela tela inicial para ativar os lembretes.
                      </li>
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lembretes */}
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            {reminderOn ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Lembrete diário
              </h2>
              <button
                onClick={toggleReminder}
                disabled={!supported || busy}
                role="switch"
                aria-checked={reminderOn}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  reminderOn ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-700"
                } disabled:opacity-50`}
              >
                {busy ? (
                  <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                ) : (
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      reminderOn ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                )}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Uma notificação no seu celular para não perder a sequência — mesmo
              com o app fechado.
            </p>

            {!supported && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {isIOS()
                  ? "No iPhone, instale o app na tela inicial (passo acima) e abra por lá para ativar os lembretes."
                  : "Seu navegador não suporta notificações push."}
              </p>
            )}
            {permDenied && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                As notificações estão bloqueadas. Libere nas configurações do
                navegador para usar os lembretes.
              </p>
            )}

            {reminderOn && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Horário
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => changeTime(e.target.value)}
                  className="input w-auto"
                />
                <button
                  onClick={testNotification}
                  className="btn-ghost text-sm"
                >
                  {tested ? (
                    <>
                      <Check className="h-4 w-4 text-brand-600" /> Enviada
                    </>
                  ) : (
                    "Testar agora"
                  )}
                </button>
              </div>
            )}
            {testMsg && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {testMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
