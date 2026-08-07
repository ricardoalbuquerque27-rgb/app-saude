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
  Syringe,
  HeartPulse,
  ShieldCheck,
  Lock,
  Bell,
  Trophy,
  UserCheck,
} from "lucide-react";

const differentiators = [
  {
    icon: Syringe,
    title: "Modo Caneta (GLP-1)",
    desc: "Acompanhamento pensado para quem usa Ozempic, Mounjaro, Wegovy e similares: lembrete da aplicação, controle de efeitos colaterais e foco em proteína para preservar músculo.",
    points: ["Lembrete da dose", "Diário de efeitos", "Curva de progresso"],
  },
  {
    icon: HeartPulse,
    title: "Inteligência de Saúde",
    desc: "A IA cruza seus exames, dieta, treino e hábitos e mostra conexões que passariam despercebidas — com prioridades claras do que fazer agora.",
    points: ["Conecta suas áreas", "Alertas e prioridades", "Linguagem simples"],
  },
];

const aiFeatures = [
  { icon: Camera, title: "Foto do prato", desc: "Fotografe a refeição e a IA estima calorias e macros." },
  { icon: Bot, title: "Assistente 24h", desc: "Um coach por IA que conhece seus dados, em qualquer tela." },
  { icon: FileText, title: "Leitura de exames", desc: "Envie o PDF e entenda seus resultados sem juridiquês." },
  { icon: BarChart3, title: "Relatórios", desc: "A IA analisa seu período e diz exatamente o que melhorar." },
];

const modules = [
  { icon: Dumbbell, title: "Treinos", desc: "Plano semanal, registro por série e progressão de carga." },
  { icon: Salad, title: "Dieta", desc: "Refeições, calorias e macros — com análise por foto." },
  { icon: LineChart, title: "Peso e medidas", desc: "Acompanhe peso e medidas corporais em gráficos." },
  { icon: Droplets, title: "Hábitos", desc: "Água, sono, humor e bem-estar do dia a dia." },
  { icon: Trophy, title: "Metas e conquistas", desc: "Sequência, níveis, desafios e ranking com amigos." },
  { icon: Bell, title: "Lembretes", desc: "Notificações no celular para manter o ritmo." },
];

const steps = [
  { n: "1", title: "Crie sua conta", desc: "Um onboarding rápido define suas metas e preferências." },
  { n: "2", title: "Registre seu dia", desc: "Treinos, dieta e hábitos — ou só fotografe o prato." },
  { n: "3", title: "Deixe a IA guiar", desc: "Análises, lembretes e insights para evoluir com constância." },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.8)]">
        <Dumbbell className="h-5 w-5" />
      </div>
      <span
        className={`text-lg font-bold tracking-tight ${
          light ? "text-white" : "text-slate-900 dark:text-white"
        }`}
      >
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
              Resumo de hoje
            </p>
            <p className="text-xs text-slate-400">Terça-feira</p>
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
              <p className="tabular mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t.value}
              </p>
              <p className="text-[11px] text-slate-400">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/[0.05] dark:bg-slate-800/40">
          <p className="mb-1 text-[11px] font-medium text-slate-400">Evolução do peso</p>
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
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="#diferenciais" className="hover:text-brand-700 dark:hover:text-brand-400">
              Diferenciais
            </a>
            <a href="#recursos" className="hover:text-brand-700 dark:hover:text-brand-400">
              Recursos
            </a>
            <a href="#seguranca" className="hover:text-brand-700 dark:hover:text-brand-400">
              Segurança
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-slate-600 hover:text-brand-700 sm:inline dark:text-slate-300 dark:hover:text-brand-400"
            >
              Entrar
            </Link>
            <Link href="/login" className="btn-primary">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-10 pt-12 lg:grid-cols-2 lg:pb-16 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Saúde, treino e dieta com IA
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Sua saúde no controle,{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent">
              com inteligência
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-400">
            Treinos, dieta, peso, hábitos, exames e tratamento num só lugar — e uma
            IA que analisa tudo, estima calorias pela foto e explica seus exames.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary px-6 py-3 text-base">
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#diferenciais" className="btn-ghost px-6 py-3 text-base">
              Ver diferenciais
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {["Grátis para começar", "Sem cartão", "No celular ou PC"].map((t) => (
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

      {/* Faixa de confiança */}
      <div className="border-y border-slate-200/70 bg-white/50 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Dados isolados por conta
          </span>
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Conexão criptografada
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            IA em português
          </span>
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Feito no Brasil
          </span>
        </div>
      </div>

      {/* Diferenciais */}
      <section id="diferenciais" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <span className="chip">O que nos torna diferentes</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Mais que um app de treino
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Dois recursos que você não encontra nos apps tradicionais.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {differentiators.map((d) => (
            <div
              key={d.title}
              className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_20px_44px_-26px_rgba(16,24,40,0.18)] dark:border-white/[0.06] dark:bg-slate-900/50"
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl" />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(24,184,94,0.9)]">
                <d.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {d.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {d.desc}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {d.points.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                  >
                    <Check className="h-3 w-3" /> {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl px-5 py-8">
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
            <div key={f.title} className="card transition duration-200 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/90 to-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(24,184,94,0.8)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((f) => (
            <div key={f.title} className="card transition duration-200 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Comece em 3 passos
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(12,150,75,0.9)]">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600 dark:text-slate-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Segurança & confiança */}
      <section id="seguranca" className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 dark:border-white/[0.06] dark:bg-slate-900/50 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="chip">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                Privacidade em primeiro lugar
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                Seus dados de saúde são só seus
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Levamos sua privacidade a sério. Cada conta acessa apenas os
                próprios registros, a conexão é criptografada e a infraestrutura é
                a mesma usada por milhares de aplicativos no mundo todo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Lock, t: "Isolamento por conta", d: "Só você vê seus dados (RLS)." },
                { icon: ShieldCheck, t: "Criptografia", d: "Tráfego protegido por HTTPS." },
                { icon: HeartPulse, t: "Sem diagnóstico", d: "Orienta e não substitui seu médico." },
                { icon: Sparkles, t: "IA responsável", d: "Recomenda procurar profissional quando preciso." },
              ].map((i) => (
                <div
                  key={i.t}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/[0.05] dark:bg-slate-800/40"
                >
                  <i.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {i.t}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center shadow-xl sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
          <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Comece a cuidar da sua evolução hoje
          </h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm text-brand-50/90">
            Crie sua conta em segundos. Grátis, sem cartão, no celular ou no
            computador.
          </p>
          <Link
            href="/login"
            className="btn relative mt-6 bg-white px-6 py-3 text-base text-brand-700 hover:bg-brand-50"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 py-10 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <Logo />
          <p className="max-w-md text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            O Pace Fit é uma ferramenta de acompanhamento e educação em saúde e não
            substitui a avaliação de um profissional. Em caso de dúvidas médicas,
            procure seu médico ou nutricionista.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} Pace Fit
          </p>
        </div>
      </footer>
    </main>
  );
}
