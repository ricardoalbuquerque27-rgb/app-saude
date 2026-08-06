import Link from "next/link";
import {
  Trophy,
  Flame,
  Zap,
  Footprints,
  Dumbbell,
  Medal,
  Salad,
  Droplets,
  Scale,
  FileText,
  BarChart3,
  CalendarDays,
  Lock,
  Sparkles,
  Users,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { getGamification } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints,
  Dumbbell,
  Medal,
  Salad,
  Droplets,
  Flame,
  Zap,
  Scale,
  FileText,
  BarChart3,
  CalendarDays,
};

export default async function ConquistasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const g = await getGamification(supabase, uid);

  const unlockedCount = g.achievements.filter((a) => a.unlocked).length;
  const pct = Math.round(g.progress * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conquistas"
        subtitle="Ganhe XP e desbloqueie medalhas usando o app todos os dias."
      />

      {/* Nível + XP */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold backdrop-blur ring-1 ring-white/20">
            {g.level}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-50/80">
              Nível
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Nível {g.level}</h2>
            <p className="mt-0.5 text-sm text-brand-50/90">
              {g.xp} XP acumulado · {unlockedCount}/{g.achievements.length}{" "}
              medalhas
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-brand-50/90">
            <span>{g.xpIntoLevel} XP</span>
            <span>
              faltam {g.xpPerLevel - g.xpIntoLevel} XP para o nível {g.level + 1}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white/90 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Sequência */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 ring-1 ring-inset ring-black/[0.03] dark:bg-amber-900/40 dark:text-amber-300 dark:ring-white/[0.06]">
            <Flame className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              Sequência atual
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {g.current}
              <span className="ml-1 text-sm font-medium text-slate-400">
                {g.current === 1 ? "dia" : "dias"}
              </span>
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 ring-1 ring-inset ring-black/[0.03] dark:bg-violet-900/40 dark:text-violet-300 dark:ring-white/[0.06]">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              Melhor sequência
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {g.best}
              <span className="ml-1 text-sm font-medium text-slate-400">
                {g.best === 1 ? "dia" : "dias"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {g.current > 0 && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Sparkles className="h-4 w-4 shrink-0" />
          Você está há {g.current} {g.current === 1 ? "dia" : "dias"} em
          sequência. Registre algo hoje para não perder!
        </p>
      )}

      {/* Ranking de amigos */}
      <Link
        href="/app/amigos"
        className="card group flex items-center gap-4 transition duration-200 hover:-translate-y-0.5"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
          <Users className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Ranking de amigos
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adicione amigos e veja quem acumula mais XP.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </Link>

      {/* Medalhas */}
      <div>
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
          Medalhas
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {g.achievements.map((a) => {
            const Icon = ICONS[a.icon] ?? Medal;
            return (
              <div
                key={a.id}
                className={`card flex flex-col items-center gap-2 text-center transition ${
                  a.unlocked ? "" : "opacity-60"
                }`}
              >
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
                    a.unlocked
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                  {!a.unlocked && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {a.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        O XP e as medalhas são calculados a partir dos seus registros no app.
      </p>
    </div>
  );
}
