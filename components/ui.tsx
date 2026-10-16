"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-app-texto">{title}</h1>
        {/* Direto no chão da página: `texto-2`, nunca slate-500, que dá 4,43:1
            sobre a página clara e reprova o WCAG 1.4.3. */}
        {subtitle && (
          <p className="mt-1 text-sm text-app-texto-2">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// Sem `accent`: azul, violeta e âmbar por cartão era enfeite (a spec tira a cor
// decorativa), e a variação negativa em rosa dizia "ruim" para uma carga que
// só baixou. O ícone é sempre `primaria` sobre `primaria-fundo`, como o
// `.icon-badge`. Sem o `hover:-translate-y`: o cartão não é clicável.
export function StatCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex items-center gap-4">
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-app-primaria-fundo text-app-primaria">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-app-texto-2">{label}</p>
        <p className="tabular mt-0.5 text-2xl font-semibold text-app-texto">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-medium text-app-texto-2">
              {unit}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-app-campo py-12 text-center">
      {icon && <div className="mb-3 text-app-texto-2">{icon}</div>}
      <p className="font-medium text-app-texto">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-app-texto-2">{description}</p>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pf-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sem sombra: o cartão não tem o segundo nível, e a folha já se separa da
          página pelo escurecimento do fundo e pela borda. */}
      <div className="pf-modal relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-app-linha bg-app-cartao p-5 sm:rounded-2xl">
        {/* Alça da folha, só no celular */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-app-campo sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{title}</h2>
          {/* 44 px de toque; as margens negativas devolvem o que o botão
              acrescenta, e o cabeçalho segue com a altura de antes. */}
          <button
            onClick={onClose}
            className="tappable -my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:bg-app-primaria-fundo"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

