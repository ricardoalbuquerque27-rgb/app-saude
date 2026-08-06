"use client";

import { useEffect } from "react";

// Registra o service worker e guarda o evento de instalação (beforeinstallprompt),
// que o navegador dispara logo no carregamento — antes de qualquer botão montar.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __pfInstallPrompt?: Event }).__pfInstallPrompt = e;
      window.dispatchEvent(new Event("pf-installable"));
    };
    const onInstalled = () => {
      (window as unknown as { __pfInstallPrompt?: Event | null }).__pfInstallPrompt =
        null;
      window.dispatchEvent(new Event("pf-installed"));
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
