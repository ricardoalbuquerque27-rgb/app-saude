import Link from "next/link";
import { Dumbbell } from "lucide-react";

// Nome do produto num só lugar (facilita um futuro rebrand).
export const APP_NAME = "Pace Fit";

// Componentes compartilhados entre a landing (/) e a página de recursos.

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
        <Dumbbell className="h-5 w-5" />
      </div>
      <span
        className={`text-lg font-bold tracking-tight ${dark ? "text-slate-900" : "text-white"}`}
      >
        {APP_NAME}
      </span>
    </Link>
  );
}

// Botão em pílula (estilo Whoop)
export function Pill({
  href,
  children,
  variant = "green",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "green" | "black" | "white" | "outline";
  className?: string;
}) {
  const variants = {
    green: "bg-brand-500 text-white hover:bg-brand-400",
    black: "bg-slate-900 text-white hover:bg-slate-800",
    white: "bg-white text-slate-900 hover:bg-slate-100",
    outline: "border border-current/20 text-current hover:bg-current/5",
  } as const;
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-xs font-bold uppercase tracking-[0.15em] transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
