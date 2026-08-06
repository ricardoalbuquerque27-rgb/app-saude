"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Salad,
  LineChart,
  Droplets,
  FileText,
  User,
  LogOut,
  Moon,
  Sun,
  Bot,
  Watch,
  BarChart3,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/app", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/app/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/app/dieta", label: "Dieta", icon: Salad },
  { href: "/app/medidas", label: "Medidas", icon: LineChart },
  { href: "/app/habitos", label: "Hábitos", icon: Droplets },
  { href: "/app/exames", label: "Exames", icon: FileText },
  { href: "/app/assistente", label: "Assistente", icon: Bot },
];

export default function AppShell({
  children,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pf-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pf-theme", next ? "dark" : "light");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (item: (typeof nav)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white/70 px-4 py-6 backdrop-blur-xl lg:flex dark:border-white/[0.06] dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.8)]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Pace Fit
          </span>
        </div>

        <nav className="mt-8 flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item)
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Link
            href="/app/conquistas"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/app/conquistas"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Trophy className="h-5 w-5" />
            Conquistas
          </Link>
          <Link
            href="/app/relatorios"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/app/relatorios"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            Relatórios
          </Link>
          <Link
            href="/app/integracoes"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/app/integracoes"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Watch className="h-5 w-5" />
            Integrações
          </Link>
          <Link
            href="/app/perfil"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/app/perfil"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <User className="h-5 w-5" />
            Perfil
          </Link>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {dark ? "Tema claro" : "Tema escuro"}
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Topbar — mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400">
          <Dumbbell className="h-5 w-5" />
          Pace Fit
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Alternar tema"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link
            href="/app/conquistas"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Conquistas"
          >
            <Trophy className="h-5 w-5" />
          </Link>
          <Link
            href="/app/relatorios"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Relatórios"
          >
            <BarChart3 className="h-5 w-5" />
          </Link>
          <Link
            href="/app/integracoes"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Integrações"
          >
            <Watch className="h-5 w-5" />
          </Link>
          <Link
            href="/app/perfil"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Perfil"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:pl-64 lg:pr-8">
        <div className="lg:pl-4">{children}</div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-7">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive(item)
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
