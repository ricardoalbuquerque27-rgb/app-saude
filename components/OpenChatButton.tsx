"use client";

import { Bot, ArrowRight } from "lucide-react";

// Botão de ação rápida (dashboard) que abre o assistente flutuante.
export default function OpenChatButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("pf-open-chat"))}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/[0.06] dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <Bot className="h-4 w-4" />
      </div>
      <span className="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-200">
        Falar com o assistente
      </span>
      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </button>
  );
}
