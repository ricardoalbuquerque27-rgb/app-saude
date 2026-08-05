import Link from "next/link";
import {
  Dumbbell,
  Salad,
  LineChart,
  Droplets,
  FileText,
  ArrowRight,
  Bot,
  Camera,
  BarChart3,
  Sparkles,
  Check,
  Flame,
  Scale,
} from "lucide-react";

const aiFeatures = [
  {
    icon: Camera,
    title: "Foto do prato",
    desc: "Fotografe a refeição e a IA estima calorias e macros.",
  },
  {
    icon: Bot,
    title: "Assistente",
    desc: "Tire dúvidas de dieta e treino com um coach por IA.",
  },
  {
    icon: BarChart3,
    title: "Relatórios inteligentes",
    desc: "A IA analisa seus dados e diz o que melhorar.",
  },
  {
    icon: FileText,
    title: "Leitura de exames",
    desc: "Envie o PDF e entenda seus resultados em linguagem simples.",
  },
];

const modules = [
  {
    icon: Dumbbell,
    title: "Treinos",
    desc: "Plano semanal, registro por série e progressão de carga.",
  },
  {
    icon: Salad,
    title: "Dieta",
    desc: "Refeições, calorias e macros — com análise por foto.",
  },
  {
    icon: LineChart,
    title: "Peso e medidas",
    desc: "Acompanhe peso e medidas corporais em gráficos.",
  },
  {
    icon: Droplets,
    title: "Hábitos",
    desc: "Água, sono, humor e bem-estar do dia a dia.",
  },
  {
    icon: FileText,
    title: "Exames",
    desc: "Guarde resultados e acompanhe seus indicadores.",
  },
  {
    icon: Sparkles,
    title: "Tudo com IA",
    desc: "Recursos inteligentes ajudando em cada etapa.",
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.8)]">
        <Dumbbell className="h-5 w-5" />
      </div>
      <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        Pace Fit
      </span>
    </div>
  );
}

function PreviewCard() {
  const tiles = [
    { icon: Dumbbell, label: "Treinos", value: "5", tint: "text-brand-600 dark:text-brand-400" },
    { icon: Flame, label: "Calorias", value: "1.850", tint: "text-amber-600 dark:text-amber-400" },
    { icon: Scale, label: "Peso", value: "78,4", tint: "text-violet-600 dark:text-violet-400" },
    { icon: Droplets, label: "Água", value: "2,1L", tint: "text-blue-600 dark:text-blue-400" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-brand-500/10 blur-2xl" />
      <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-2xl shadow-slate-900/10 dark:border-white/[0.08] dark:bg-slate-900/80 dark:shadow-black/40">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Olá, Ricardo 👋
            </p>
            <p className="text-xs text-slate-400">Resumo de hoje</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/[0.05] dark:bg-slate-800/40"
            >
              <t.icon className={`h-4 w-4 ${t.tint}`} />
              <p className="mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t.value}
              </p>
              <p className="text-[11px] text-slate-400">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/[0.05] dark:bg-slate-800/40">
          <p className="mb-1 text-[11px] font-medium text-slate-400">
            Evolução do peso
          </p>
          <svg viewBox="0 0 300 80" className="h-16 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#18b85e" stopOpacity="0.35" />
                <stop offset="1" stopColor="#18b85e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,60 C40,52 60,34 100,40 C140,46 160,22 200,26 C240,30 270,14 300,18 L300,80 L0,80 Z"
              fill="url(#area)"
            />
            <path
              d="M0,60 C40,52 60,34 100,40 C140,46 160,22 200,26 C240,30 270,14 300,18"
              fill="none"
              stroke="#18b85e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-brand-50/60 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-950/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <Link href="/login" className="btn-primary">
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-12 pt-12 lg:grid-cols-2 lg:pb-20 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Saúde, treino e dieta com IA
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Sua evolução,{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent">
              com inteligência
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-600 dark:text-slate-400">
            Registre treinos, dieta, peso, hábitos e exames num só lugar — e deixe
            a IA analisar seus dados, estimar calorias pela foto e explicar seus
            exames.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary px-6 py-3 text-base">
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-ghost px-6 py-3 text-base">
              Já tenho conta
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {["Grátis", "Sem cartão", "No celular ou PC"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:pl-6">
          <PreviewCard />
        </div>
      </section>

      {/* Recursos de IA */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Inteligência que trabalha por você
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Recursos de IA que tornam o acompanhamento mais fácil e completo.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {aiFeatures.map((f) => (
            <div key={f.title} className="card">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/90 to-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(24,184,94,0.8)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Tudo em um só lugar
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Todos os pilares da sua saúde, organizados e fáceis de acompanhar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((f) => (
            <div key={f.title} className="card transition duration-200 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 text-center shadow-xl sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
          <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Pronto para acompanhar sua evolução?
          </h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm text-brand-50/90">
            Crie sua conta em segundos e comece a registrar hoje mesmo.
          </p>
          <Link
            href="/login"
            className="btn relative mt-6 bg-white px-6 py-3 text-base text-brand-700 hover:bg-brand-50"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 py-8 text-center text-sm text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5">
          <Logo />
          <p>Pace Fit — feito para acompanhar sua evolução.</p>
        </div>
      </footer>
    </main>
  );
}
