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
  Watch,
  BarChart3,
  Trophy,
  Users,
  Syringe,
  Menu,
  X,
  ChevronRight,
  Target,
  HeartPulse,
  Stethoscope,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ChatWidget from "@/components/ChatWidget";
import Onboarding from "@/components/Onboarding";

// Navegação completa (usada na sidebar do desktop)
const nav = [
  { href: "/app", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/app/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/app/dieta", label: "Dieta", icon: Salad },
  { href: "/app/medidas", label: "Medidas", icon: LineChart },
  { href: "/app/habitos", label: "Hábitos", icon: Droplets },
  { href: "/app/exames", label: "Exames", icon: FileText },
];

// Barra inferior do celular — apenas o essencial do dia a dia
const mobileNav = [
  { href: "/app", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/app/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/app/dieta", label: "Dieta", icon: Salad },
  { href: "/app/habitos", label: "Hábitos", icon: Droplets },
];

// Tudo o mais fica organizado no menu "Mais"
const menuGroups = [
  {
    title: "Acompanhamento",
    items: [
      { href: "/app/medidas", label: "Medidas", icon: LineChart },
      { href: "/app/exames", label: "Exames", icon: FileText },
      { href: "/app/tratamento", label: "Tratamento", icon: Syringe },
      { href: "/app/saude", label: "Saúde (IA)", icon: HeartPulse },
    ],
  },
  {
    title: "Progresso",
    items: [
      { href: "/app/conquistas", label: "Conquistas", icon: Trophy },
      { href: "/app/desafios", label: "Desafios", icon: Target },
      { href: "/app/amigos", label: "Amigos", icon: Users },
      { href: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    title: "Conta",
    items: [
      { href: "/app/integracoes", label: "Integrações", icon: Watch },
      { href: "/app/perfil", label: "Perfil", icon: User },
      { href: "/app/diagnostico", label: "Diagnóstico", icon: Stethoscope },
    ],
  },
];

const menuHrefs = menuGroups.flatMap((g) => g.items.map((i) => i.href));

// Itens da barra lateral do desktop = tudo do menu "Mais" que não está na nav principal
const mainHrefs = new Set(nav.map((n) => n.href));
const secondaryItems = menuGroups
  .flatMap((g) => g.items)
  .filter((i) => !mainHrefs.has(i.href));

export default function AppShell({
  children,
  userName,
  userEmail,
  needsOnboarding,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  needsOnboarding?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu "Mais" ao trocar de página
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Quando a IA altera dados, recarrega também os componentes de servidor
  // (ex.: o dashboard). As telas client cuidam do próprio recarregamento.
  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener("pf-data-changed", handler);
    return () => window.removeEventListener("pf-data-changed", handler);
  }, [router]);

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
          {secondaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
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
        <Link
          href="/app"
          className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400"
        >
          <Dumbbell className="h-5 w-5" />
          Pace Fit
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:pl-64 lg:pr-8">
        <div className="lg:pl-4">{children}</div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                isActive(item)
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <item.icon className="h-[22px] w-[22px]" />
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
              menuHrefs.includes(pathname)
                ? "text-brand-600 dark:text-brand-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Menu className="h-[22px] w-[22px]" />
            Mais
          </button>
        </div>
      </nav>

      {/* Menu "Mais" — mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                Menu
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {menuGroups.map((group) => (
                <div key={group.title} className="mb-5">
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
              <button
                onClick={toggleTheme}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                {dark ? "Tema claro" : "Tema escuro"}
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assistente flutuante */}
      <ChatWidget />

      {/* Onboarding (novos usuários) */}
      {needsOnboarding && (
        <Onboarding initialName={userName === "Atleta" ? "" : userName} />
      )}
    </div>
  );
}
