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
  Trophy,
  Bell,
} from "lucide-react";

/* Landing estilo "Whoop": dark, tipografia grande, seções full-width. */

const modules = [
  { icon: Dumbbell, title: "Treinos", desc: "Plano semanal, séries e progressão de carga." },
  { icon: Salad, title: "Dieta", desc: "Calorias e macros — com análise por foto." },
  { icon: LineChart, title: "Peso e medidas", desc: "Sua evolução corporal em gráficos." },
  { icon: Droplets, title: "Hábitos", desc: "Água, sono, humor e bem-estar." },
  { icon: FileText, title: "Exames", desc: "Guarde e entenda seus indicadores." },
  { icon: Trophy, title: "Gamificação", desc: "Sequência, níveis, desafios e ranking." },
];

const steps = [
  { n: "01", title: "Crie sua conta", desc: "Um onboarding rápido define suas metas." },
  { n: "02", title: "Registre seu dia", desc: "Treino, dieta e hábitos — ou só fotografe o prato." },
  { n: "03", title: "Deixe a IA guiar", desc: "Análises, lembretes e insights para evoluir." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_24px_-8px_rgba(24,184,94,0.9)]">
        <Dumbbell className="h-5 w-5" />
      </div>
      <span className="text-lg font-bold tracking-tight text-white">Pace Fit</span>
    </div>
  );
}

function PreviewCard() {
  const tiles = [
    { icon: Dumbbell, label: "Treinos", value: "5", tint: "text-brand-400" },
    { icon: Flame, label: "Calorias", value: "1.850", tint: "text-amber-400" },
    { icon: Scale, label: "Peso", value: "78,4", tint: "text-violet-400" },
    { icon: Droplets, label: "Água", value: "2,1L", tint: "text-blue-400" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-500/20 blur-3xl" />
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Resumo de hoje</p>
            <p className="text-xs text-slate-500">Terça-feira</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <t.icon className={`h-4 w-4 ${t.tint}`} />
              <p className="tabular mt-2 text-lg font-bold tracking-tight text-white">{t.value}</p>
              <p className="text-[11px] text-slate-500">{t.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-1 text-[11px] font-medium text-slate-500">Evolução do peso</p>
          <svg viewBox="0 0 300 80" className="h-16 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#18b85e" stopOpacity="0.45" />
                <stop offset="1" stopColor="#18b85e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,60 C40,52 60,34 100,40 C140,46 160,22 200,26 C240,30 270,14 300,18 L300,80 L0,80 Z" fill="url(#area)" />
            <path d="M0,60 C40,52 60,34 100,40 C140,46 160,22 200,26 C240,30 270,14 300,18" fill="none" stroke="#18b85e" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  desc,
  points,
  icon: Icon,
  reverse,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  points: string[];
  icon: React.ComponentType<{ className?: string }>;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={reverse ? "lg:order-2" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400">{desc}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-sm text-slate-200">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25">
                <Check className="h-3.5 w-3.5" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-10">
          <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative flex h-40 items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_20px_50px_-15px_rgba(24,184,94,0.8)]">
              <Icon className="h-12 w-12" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#diferenciais" className="hover:text-white">Diferenciais</a>
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#seguranca" className="hover:text-white">Segurança</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:inline">
              Entrar
            </Link>
            <Link href="/login" className="btn-primary">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(700px 420px at 80% -5%, rgba(24,184,94,0.28), transparent 60%), radial-gradient(600px 360px at 0% 110%, rgba(24,184,94,0.12), transparent 55%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pb-28 lg:pt-24">
          <div>
            <Eyebrow>Saúde · Treino · Dieta com IA</Eyebrow>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl xl:text-7xl">
              Sua saúde,{" "}
              <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
                sob controle
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
              Treinos, dieta, peso, hábitos, exames e tratamento num só lugar — e uma
              inteligência que analisa tudo, estima calorias pela foto e explica seus
              exames.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="btn-primary px-7 py-3.5 text-base">
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#diferenciais"
                className="btn inline-flex border border-white/15 bg-white/[0.04] px-7 py-3.5 text-base text-white hover:bg-white/[0.08]"
              >
                Ver diferenciais
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              {["Grátis para começar", "Sem cartão", "No celular ou PC"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-400" /> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:pl-6">
            <PreviewCard />
          </div>
        </div>
      </section>

      {/* Faixa de confiança */}
      <div className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 text-sm text-slate-400">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-400" /> Dados isolados por conta</span>
          <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand-400" /> Conexão criptografada</span>
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-400" /> IA em português</span>
          <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-brand-400" /> Feito no Brasil</span>
        </div>
      </div>

      {/* Diferenciais */}
      <section id="diferenciais" className="mx-auto max-w-6xl space-y-24 px-5 py-24">
        <div className="text-center">
          <Eyebrow>O que nos torna diferentes</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Mais que um app de treino
          </h2>
        </div>
        <FeatureRow
          eyebrow="Modo Caneta · GLP-1"
          title="Acompanhamento para quem usa caneta"
          desc="Feito para quem usa Ozempic, Mounjaro, Wegovy e similares. Lembra da aplicação, acompanha efeitos colaterais e cuida da sua proteína para preservar músculo."
          points={["Lembrete da dose", "Diário de efeitos colaterais", "Curva de progresso"]}
          icon={Syringe}
        />
        <FeatureRow
          eyebrow="Inteligência de Saúde"
          title="A IA conecta os pontos por você"
          desc="Cruza seus exames, dieta, treino e hábitos e revela conexões que passariam despercebidas — com prioridades claras do que fazer agora."
          points={["Conecta suas áreas", "Alertas e prioridades", "Linguagem simples"]}
          icon={HeartPulse}
          reverse
        />
      </section>

      {/* Recursos */}
      <section id="recursos" className="border-t border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="mb-12 text-center">
            <Eyebrow>Tudo em um só lugar</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Todos os pilares da sua saúde
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((f) => (
              <div key={f.title} className="bg-slate-950 p-7 transition hover:bg-white/[0.03]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Recursos de IA em destaque */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Camera, t: "Foto do prato", d: "Calorias e macros pela imagem." },
              { icon: Bot, t: "Assistente 24h", d: "Coach por IA em qualquer tela." },
              { icon: FileText, t: "Leitura de exames", d: "Entenda o PDF sem juridiquês." },
              { icon: Bell, t: "Lembretes", d: "Notificações para manter o ritmo." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <f.icon className="h-5 w-5 text-brand-400" />
                <h3 className="mt-3 font-semibold text-white">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="mb-14 text-center">
          <Eyebrow>Simples de começar</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Comece em 3 passos
          </h2>
        </div>
        <div className="grid gap-10 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <p className="font-display text-5xl font-extrabold text-brand-500/40">{s.n}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Segurança */}
      <section id="seguranca" className="border-t border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Privacidade em primeiro lugar</Eyebrow>
              <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                Seus dados de saúde são só seus
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400">
                Cada conta acessa apenas os próprios registros, a conexão é
                criptografada e a infraestrutura é a mesma usada por milhares de
                aplicativos no mundo todo.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Lock, t: "Isolamento por conta", d: "Só você vê seus dados." },
                { icon: ShieldCheck, t: "Criptografia", d: "Tráfego protegido por HTTPS." },
                { icon: HeartPulse, t: "Sem diagnóstico", d: "Orienta e não substitui seu médico." },
                { icon: Sparkles, t: "IA responsável", d: "Indica procurar um profissional." },
              ].map((i) => (
                <div key={i.t} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <i.icon className="h-5 w-5 text-brand-400" />
                  <p className="mt-3 font-semibold text-white">{i.t}</p>
                  <p className="text-sm text-slate-400">{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(600px 300px at 50% 0%, rgba(24,184,94,0.22), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-28 text-center">
          <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Comece a cuidar da
            <br />
            sua evolução hoje
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-slate-400">
            Crie sua conta em segundos. Grátis, sem cartão, no celular ou no
            computador.
          </p>
          <Link href="/login" className="btn-primary mt-9 px-8 py-4 text-base">
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 text-center">
          <Logo />
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            O Pace Fit é uma ferramenta de acompanhamento e educação em saúde e não
            substitui a avaliação de um profissional. Em caso de dúvidas médicas,
            procure seu médico ou nutricionista.
          </p>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Pace Fit</p>
        </div>
      </footer>
    </main>
  );
}
