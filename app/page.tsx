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
  Syringe,
  HeartPulse,
  ShieldCheck,
  Check,
  Trophy,
} from "lucide-react";
import Reveal from "@/components/Reveal";

/* Landing no modelo Whoop: seções preto/branco alternadas, tipografia grande e
   "leve", botões em pílula, cards com mídia e título sobreposto. */

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
        <Dumbbell className="h-5 w-5" />
      </div>
      <span
        className={`text-lg font-bold tracking-tight ${dark ? "text-slate-900" : "text-white"}`}
      >
        Pace Fit
      </span>
    </div>
  );
}

// Botão em pílula (estilo Whoop)
function Pill({
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

// Círculo verde "assinatura" (tipo WHOOP AGE), com pulso e partículas
function GlowRing({ value, label }: { value: string; label: string }) {
  const dots = [
    "left-6 top-8 h-1.5 w-1.5",
    "right-8 top-16 h-1 w-1",
    "bottom-10 left-14 h-1.5 w-1.5",
    "bottom-16 right-10 h-1 w-1",
    "left-10 top-1/2 h-1 w-1",
  ];
  const delays = ["0s", "1.2s", "2s", "0.6s", "1.6s"];
  return (
    <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
      <div
        className="animate-pulse-glow absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(24,184,94,0.55), rgba(24,184,94,0.08) 55%, transparent 72%)",
        }}
      />
      <div className="animate-spin-slow absolute inset-4 rounded-full border border-dashed border-brand-400/25" />
      <div className="absolute inset-10 rounded-full border border-brand-400/20" />
      {dots.map((d, i) => (
        <span
          key={i}
          className={`animate-float absolute rounded-full bg-brand-300/80 ${d}`}
          style={{ animationDelay: delays[i] }}
        />
      ))}
      <div className="relative text-center">
        <p className="font-display text-5xl font-bold text-white">{value}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-300">
          {label}
        </p>
      </div>
    </div>
  );
}

const mediaCards = [
  { title: "Registre seus treinos", icon: Dumbbell, from: "from-brand-700", to: "to-slate-900", img: "/landing/treinos.jpg" },
  { title: "Calorias pela foto", icon: Camera, from: "from-amber-700", to: "to-slate-900", img: "/landing/comida.jpg" },
  { title: "Acompanhe seu peso", icon: LineChart, from: "from-violet-700", to: "to-slate-900", img: "/landing/peso.jpg" },
  { title: "Hábitos do dia a dia", icon: Droplets, from: "from-blue-700", to: "to-slate-900", img: "/landing/habitos.jpg" },
  { title: "Entenda seus exames", icon: FileText, from: "from-slate-600", to: "to-slate-900", img: "/landing/exames.jpg" },
];

const pillars = [
  {
    name: "Treino",
    points: ["Plano semanal", "Registro por série", "Progressão de carga", "Ranking com amigos"],
  },
  {
    name: "Nutrição",
    points: ["Calorias e macros", "Análise por foto (IA)", "Meta de proteína", "Assistente 24h"],
  },
  {
    name: "Saúde",
    points: ["Peso e medidas", "Leitura de exames", "Modo Caneta (GLP-1)", "Inteligência de Saúde"],
  },
];

export default function Home() {
  return (
    <main className="bg-black">
      {/* Barra de promoção */}
      <div className="bg-brand-500 px-4 py-2.5 text-center text-sm font-medium text-white">
        Comece grátis hoje — sem cartão, no celular ou no computador.{" "}
        <Link href="/login" className="font-bold underline underline-offset-2">
          Criar conta
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-9 text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 lg:flex">
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#diferenciais" className="hover:text-white">Diferenciais</a>
            <a href="#seguranca" className="hover:text-white">Segurança</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 hover:text-white sm:inline"
            >
              Entrar
            </Link>
            <Pill href="/login" variant="green">Criar conta</Pill>
          </div>
        </div>
      </header>

      {/* HERO — mídia full-bleed com título sobreposto */}
      <section className="relative">
        <div className="relative mx-3 overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/landing/hero.jpg')" }}
          />
          <div className="absolute inset-0 bg-slate-950/65" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(600px 500px at 78% 30%, rgba(24,184,94,0.30), transparent 60%)",
            }}
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:py-28">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
                Saúde · Treino · Dieta com IA
              </p>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl xl:text-7xl">
                o app de saúde feito para durar
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-300">
                Treinos, dieta, peso, hábitos, exames e tratamento num só lugar —
                com uma inteligência que trabalha por você todos os dias.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Pill href="/login" variant="green">Começar grátis</Pill>
                <Pill href="#diferenciais" variant="white">Ver diferenciais</Pill>
              </div>
            </Reveal>
            <div className="flex justify-center lg:justify-end">
              <div className="animate-float">
                <GlowRing value="92" label="Pace Score" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa em movimento (marquee) */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5" aria-hidden="true">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center">
              {["Treino", "Dieta", "Sono", "Água", "Exames", "IA", "Modo Caneta", "Conquistas"].map(
                (w) => (
                  <span
                    key={w}
                    className="flex items-center text-xl font-semibold uppercase tracking-[0.15em] text-white/70 sm:text-2xl"
                  >
                    <span className="px-6">{w}</span>
                    <span className="text-brand-500">•</span>
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SEÇÃO BRANCA — título gigante + cards de mídia (carrossel) */}
      <section id="recursos" className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <h2 className="max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl">
              Tudo o que importa, num só app
            </h2>
            <p className="mt-6 max-w-xl text-lg text-slate-500">
              Uma visão completa da sua saúde — para você tomar decisões melhores
              todos os dias.
            </p>
          </Reveal>

          <div className="mt-12 flex snap-x gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mediaCards.map((c) => (
              <div
                key={c.title}
                className={`relative flex aspect-[3/4] w-[78%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${c.from} ${c.to} p-6 transition duration-300 hover:-translate-y-1.5 sm:w-[340px]`}
              >
                {c.img && (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${c.img}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
                  </>
                )}
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="relative font-display text-2xl font-semibold leading-tight text-white">
                  {c.title}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO PRETA — diferenciais em cards de mídia grandes */}
      <section id="diferenciais" className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
              O que nos torna diferentes
            </p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
              Mais que um app de treino
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {[
              {
                icon: Syringe,
                title: "Modo Caneta",
                sub: "GLP-1",
                desc: "Para quem usa Ozempic, Mounjaro, Wegovy e similares: lembrete da aplicação, diário de efeitos e foco em proteína para preservar músculo.",
                img: "/landing/caneta.jpg",
              },
              {
                icon: HeartPulse,
                title: "Inteligência de Saúde",
                sub: "IA conectada",
                desc: "Cruza seus exames, dieta, treino e hábitos e revela conexões que passariam despercebidas — com prioridades claras do que fazer agora.",
                img: "/landing/ia.jpg",
              },
            ].map((d) => (
              <div
                key={d.title}
                className="relative flex min-h-[24rem] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800 to-black p-8 transition duration-300 hover:-translate-y-1.5 hover:border-brand-500/40"
              >
                {d.img && (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${d.img}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
                  </>
                )}
                <div
                  className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(24,184,94,0.30), transparent 60%)",
                  }}
                />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                  <d.icon className="h-7 w-7" />
                </div>
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                    {d.sub}
                  </p>
                  <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
                    {d.title}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">
                    {d.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO BRANCA — 3 pilares (estilo cards de plano) */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <h2 className="text-center font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Três pilares, um só lugar
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.name}
                className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white"
              >
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                  <span className="font-display text-2xl font-semibold uppercase tracking-[0.35em] text-slate-800">
                    {p.name}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <ul className="flex-1 space-y-3">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-3 text-sm text-slate-700">
                        <Check className="h-4 w-4 shrink-0 text-brand-600" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <Pill href="/login" variant="black" className="mt-7 w-full">
                    Começar
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO PRETA — recursos de IA */}
      <section className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl">
            Inteligência que trabalha por você
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Camera, t: "Foto do prato", d: "Calorias e macros pela imagem." },
              { icon: Bot, t: "Assistente 24h", d: "Coach por IA em qualquer tela." },
              { icon: FileText, t: "Leitura de exames", d: "Entenda o PDF sem juridiquês." },
              { icon: Trophy, t: "Gamificação", d: "Sequência, níveis e desafios." },
            ].map((f) => (
              <div key={f.t} className="bg-black p-7">
                <f.icon className="h-6 w-6 text-brand-400" />
                <h3 className="mt-4 text-lg font-semibold text-white">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO BRANCA — segurança */}
      <section id="seguranca" className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
                Privacidade em primeiro lugar
              </p>
              <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-5xl">
                Seus dados de saúde são só seus
              </h2>
              <p className="mt-5 max-w-lg text-lg text-slate-500">
                Cada conta acessa apenas os próprios registros, a conexão é
                criptografada e você continua no controle.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, t: "Isolamento por conta", d: "Só você vê seus dados." },
                { icon: HeartPulse, t: "Sem diagnóstico", d: "Não substitui seu médico." },
                { icon: Check, t: "Criptografia", d: "Tráfego protegido (HTTPS)." },
                { icon: Bot, t: "IA responsável", d: "Indica procurar profissional." },
              ].map((i) => (
                <div key={i.t} className="rounded-3xl bg-slate-50 p-6">
                  <i.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 font-semibold text-slate-900">{i.t}</p>
                  <p className="text-sm text-slate-500">{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL — preto com título gigante */}
      <section className="relative overflow-hidden bg-black">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(700px 340px at 50% 0%, rgba(24,184,94,0.25), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="font-display text-5xl font-semibold leading-[1.0] tracking-tight text-white sm:text-7xl">
            comece sua evolução hoje
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-slate-400">
            Crie sua conta em segundos. Grátis, sem cartão.
          </p>
          <div className="mt-10 flex justify-center">
            <Pill href="/login" variant="green" className="px-9 py-4 text-sm">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Pill>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-black">
        <div className="mx-auto max-w-7xl border-t border-white/10 px-6 py-12 sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo />
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              O Pace Fit é uma ferramenta de acompanhamento e educação em saúde e
              não substitui a avaliação de um profissional. Em caso de dúvidas
              médicas, procure seu médico ou nutricionista.
            </p>
            <p className="text-xs text-slate-600">© {new Date().getFullYear()} Pace Fit</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
