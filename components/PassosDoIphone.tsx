"use client";

import { Check, PlusSquare, Share } from "lucide-react";

// No iPhone, notificação de app web só chega com o app na Tela de Início
// (iOS 16.4 ou mais novo). Os passos e as duas perguntas moram aqui porque o
// "Instalar no celular" e os "Lembretes das refeições" do Perfil usam os dois.

export function ehIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Aberto como app (pela Tela de Início), e não numa aba do navegador. */
export function abertoNaTelaDeInicio(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PassosDoIphone() {
  return (
    <div className="mt-3 rounded-xl bg-app-pagina p-3 text-sm text-app-texto-2">
      <p className="font-medium text-app-texto">No iPhone/iPad (Safari):</p>
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-center gap-2">
          <Share className="h-4 w-4 shrink-0 text-app-primaria" /> 1. Toque no botão <b>Compartilhar</b>.
        </li>
        <li className="flex items-center gap-2">
          <PlusSquare className="h-4 w-4 shrink-0 text-app-primaria" /> 2. Escolha <b>Adicionar à Tela de Início</b>.
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-app-primaria" /> 3. Abra o app pela tela inicial para ativar os lembretes.
        </li>
      </ol>
    </div>
  );
}
