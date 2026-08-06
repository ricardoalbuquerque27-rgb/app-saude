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
} from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const REMINDER_KEY = "pf-reminder";

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

export default function PwaSettings() {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Lembretes
  const [notifSupported, setNotifSupported] = useState(true);
  const [reminderOn, setReminderOn] = useState(false);
  const [time, setTime] = useState("19:00");
  const [permDenied, setPermDenied] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setNotifSupported(
      typeof window !== "undefined" && "Notification" in window
    );
    setCanPrompt(
      !!(window as unknown as { __pfInstallPrompt?: Event }).__pfInstallPrompt
    );

    try {
      const raw = localStorage.getItem(REMINDER_KEY);
      if (raw) {
        const r = JSON.parse(raw);
        setReminderOn(!!r.enabled);
        if (r.time) setTime(r.time);
      }
    } catch {
      /* ignore */
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied")
      setPermDenied(true);

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
  }, []);

  // (Re)agenda o lembrete local enquanto o app estiver aberto.
  const scheduleReminder = useCallback((hhmm: string) => {
    const w = window as unknown as { __pfReminderTimer?: number };
    if (w.__pfReminderTimer) window.clearTimeout(w.__pfReminderTimer);
    if (typeof Notification === "undefined" || Notification.permission !== "granted")
      return;
    const [h, m] = hhmm.split(":").map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    w.__pfReminderTimer = window.setTimeout(() => {
      fireNotification(
        "Hora do Pace Fit 💪",
        "Registre um treino, refeição ou hábito para manter sua sequência!"
      );
      scheduleReminder(hhmm); // reagenda para o próximo dia
    }, Math.min(delay, 2147483647));
  }, []);

  useEffect(() => {
    if (reminderOn) scheduleReminder(time);
  }, [reminderOn, time, scheduleReminder]);

  async function fireNotification(title: string, body: string) {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });
      } else if (typeof Notification !== "undefined") {
        new Notification(title, { body, icon: "/icon-192.png" });
      }
    } catch {
      /* ignore */
    }
  }

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

  async function toggleReminder() {
    if (reminderOn) {
      setReminderOn(false);
      persist(false, time);
      const w = window as unknown as { __pfReminderTimer?: number };
      if (w.__pfReminderTimer) window.clearTimeout(w.__pfReminderTimer);
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPermDenied(perm === "denied");
      return;
    }
    setPermDenied(false);
    setReminderOn(true);
    persist(true, time);
  }

  function changeTime(v: string) {
    setTime(v);
    if (reminderOn) persist(true, v);
  }

  function persist(enabled: boolean, t: string) {
    try {
      localStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled, time: t }));
    } catch {
      /* ignore */
    }
  }

  async function testNotification() {
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPermDenied(perm === "denied");
      return;
    }
    await fireNotification(
      "Notificação de teste ✅",
      "É assim que seus lembretes vão aparecer."
    );
    setTested(true);
    setTimeout(() => setTested(false), 2500);
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
                        Confirme em <b>Adicionar</b>.
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
                disabled={!notifSupported}
                role="switch"
                aria-checked={reminderOn}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  reminderOn ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-700"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    reminderOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Receba um empurrãozinho para não perder sua sequência.
            </p>

            {!notifSupported && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Seu navegador não suporta notificações.
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
                <button onClick={testNotification} className="btn-ghost text-sm">
                  {tested ? (
                    <>
                      <Check className="h-4 w-4 text-brand-600" /> Enviada
                    </>
                  ) : (
                    "Testar"
                  )}
                </button>
              </div>
            )}

            {reminderOn && (
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                Dica: instale o app no celular para os lembretes funcionarem
                melhor.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
