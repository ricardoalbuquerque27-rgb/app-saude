"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone, Bell, BellOff, Check, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { pushConfigurado } from "@/lib/vapidPublicKey";
import { ensurePushSubscription, pushSupported } from "@/lib/pushClient";
import { meuPerfil } from "@/lib/perfil";
import { NOME } from "@/lib/marca";
import { PassosDoIphone, abertoNaTelaDeInicio, ehIphone } from "@/components/PassosDoIphone";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
    const data = await meuPerfil<any>(
      supabase,
      "reminder_enabled, reminder_time"
    );
    if (data) {
      setReminderOn(!!data.reminder_enabled);
      if (data.reminder_time) setTime(data.reminder_time.slice(0, 5));
    }
  }, []);

  useEffect(() => {
    setInstalled(abertoNaTelaDeInicio());
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
      if (ehIphone()) setShowIosHelp(true);
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
    // Desligar só grava a coluna: a inscrição de push serve também aos
    // lembretes das refeições e ao da caneta, e cancelá-la aqui os desligava
    // calado.
    if (reminderOn) {
      setBusy(true);
      setReminderOn(false);
      try {
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
      const r = await ensurePushSubscription();
      if (r === "denied") {
        setPermDenied(typeof Notification !== "undefined" && Notification.permission === "denied");
        return;
      }
      if (r !== "ok") return;
      setPermDenied(false);
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
          <div className="icon-badge">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="section-title">Instalar no celular</h2>
            {installed ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-app-primaria">
                <Check className="h-4 w-4" /> App instalado. Aproveite! 🎉
              </p>
            ) : (
              <p className="mt-1 text-sm text-app-texto-2">
                Adicione o {NOME} à tela inicial e use como um app de verdade,
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
                  {ehIphone() ? "Como instalar" : "Instalar app"}
                </button>

                {(showIosHelp || (ehIphone() && !canPrompt)) && <PassosDoIphone />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lembretes. Sem a chave pública o push está desligado no app inteiro
          (pushConfigurado): ligar inscreveria o celular numa chave que o
          servidor não tem, e a chave e o "Testar agora" só confundiriam. */}
      {!pushConfigurado() ? (
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="icon-badge">
              <BellOff className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="section-title">Lembrete diário</h2>
              <p className="mt-1 text-sm text-app-texto-2">Os lembretes chegam em breve.</p>
            </div>
          </div>
        </div>
      ) : (
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="icon-badge">
            {reminderOn ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Lembrete diário</h2>
              {/* O botão tem 44×44 px de toque (a trilha, 44×24, fica no meio):
                  a de antes era só a trilha, e um polegar errava. As margens
                  negativas devolvem a altura que ele acrescenta à linha. */}
              <button
                onClick={toggleReminder}
                disabled={!supported || busy}
                role="switch"
                aria-checked={reminderOn}
                aria-label="Lembrete diário"
                className="tappable -my-2 flex h-11 w-11 shrink-0 items-center rounded-full disabled:opacity-50"
              >
                <span
                  className={`relative h-6 w-11 rounded-full transition ${
                    reminderOn ? "bg-app-primaria" : "bg-app-campo"
                  }`}
                >
                  {/* Ocupado, a trilha é sempre `campo` (ao desligar, o estado já
                      virou falso antes do await), e `texto` passa 4,5:1 sobre
                      ela nos dois temas; `sobre-primaria` caía a 2,6:1 no escuro. */}
                  {busy ? (
                    <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-app-texto" />
                  ) : (
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-app-cartao transition ${
                        reminderOn ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  )}
                </span>
              </button>
            </div>
            <p className="mt-1 text-sm text-app-texto-2">
              Uma notificação no seu celular para não perder a sequência — mesmo
              com o app fechado.
            </p>

            {!supported && (
              <p className="mt-2 rounded-lg bg-app-atencao-fundo px-3 py-2 text-sm text-app-atencao">
                {ehIphone()
                  ? "No iPhone, instale o app na tela inicial (passo acima) e abra por lá para ativar os lembretes."
                  : "Seu navegador não suporta notificações push."}
              </p>
            )}
            {permDenied && (
              <p className="mt-2 rounded-lg bg-app-atencao-fundo px-3 py-2 text-sm text-app-atencao">
                As notificações estão bloqueadas. Libere nas configurações do
                navegador para usar os lembretes.
              </p>
            )}

            {reminderOn && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-app-texto-2">
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
                  className="btn-ghost min-h-[44px] text-sm"
                >
                  {tested ? (
                    <>
                      <Check className="h-4 w-4 text-app-primaria" /> Enviada
                    </>
                  ) : (
                    "Testar agora"
                  )}
                </button>
              </div>
            )}
            {testMsg && (
              <p className="mt-2 text-[13px] text-app-texto-2">
                {testMsg}
              </p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
