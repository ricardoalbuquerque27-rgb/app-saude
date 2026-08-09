import Link from "next/link";
import type { Metadata } from "next";
import {
  Dumbbell,
  Salad,
  Scale,
  Droplets,
  FileText,
  Syringe,
  Leaf,
  HeartPulse,
  Trophy,
  BarChart3,
  Smartphone,
  ShieldCheck,
  Check,
  ArrowRight,
  Camera,
  Brain,
  Zap,
  Database,
  Bell,
  RefreshCw,
  Users,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import { Logo, Pill, APP_NAME } from "@/components/landing";

export const metadata: Metadata = {
  title: `Recursos e tecnologia — ${APP_NAME}`,
  description:
    "Conheça em detalhe tudo o que o app faz: treino, nutrição, medidas, hábitos, exames com classificação automática, Modo Caneta (GLP-1), a assistente de IA Gaia e as tecnologias por trás.",
};

// O que o usuário acompanha no dia a dia.
const tracking = [
  {
    icon: Dumbbell,
    name: "Treino",
    desc: "Monte a rotina e acompanhe a evolução de verdade.",
    points: [
      "Plano semanal por dia, com marcação de concluído",
      "Registro por série: reps, carga e RPE",
      "Progressão de carga com gráfico e recorde",
      "Volume semanal (reps × carga)",
    ],
  },
  {
    icon: Salad,
    name: "Nutrição",
    desc: "Saiba o que come sem planilha nem chatice.",
    points: [
      "Diário de refeições com calorias e macros",
      "Análise do prato por foto (IA)",
      "Metas de calorias e proteína com anéis",
      "Registro pela Gaia, sem digitar",
    ],
  },
  {
    icon: Scale,
    name: "Corpo e medidas",
    desc: "Veja a curva, não só o número da balança.",
    points: [
      "Peso e % de gordura",
      "Cintura, quadril, braço e mais",
      "Gráficos de evolução",
      "Meta de peso acompanhada",
    ],
  },
  {
    icon: Droplets,
    name: "Hábitos",
    desc: "Os pequenos hábitos que sustentam o resultado.",
    points: [
      "Água, sono e passos",
      "Humor, energia e estresse",
      "Anéis de progresso do dia",
      "Histórico da semana",
    ],
  },
];

// Diferenciais — o que poucos apps têm.
const diferenciais = [
  {
    icon: FileText,
    sub: "Exames inteligentes",
    name: "Classificação automática de exames",
    desc: "O app calcula se o resultado está normal, em atenção ou alterado com base em faixas de referência ajustadas por sexo e idade — e mostra se está acima ou abaixo do ideal. Você também pode enviar o PDF ou a foto do laudo e a IA lê e explica em linguagem simples.",
  },
  {
    icon: Syringe,
    sub: "GLP-1",
    name: "Modo Caneta",
    desc: "Para quem usa Ozempic, Mounjaro, Wegovy e similares: lembrete da aplicação com cálculo da próxima dose, diário de efeitos colaterais e foco em proteína para preservar músculo durante o emagrecimento.",
  },
  {
    icon: Leaf,
    sub: "Assistente de IA",
    name: "Gaia, sua companheira de saúde",
    desc: "Uma IA que conhece os seus dados e registra por você: peça para montar um treino, anotar uma refeição, a água do dia, o peso, um exame ou a dose — e ela grava direto no app. Acolhedora, sem julgamento, presente em qualquer tela.",
  },
  {
    icon: HeartPulse,
    sub: "IA conectada",
    name: "Inteligência de Saúde",
    desc: "Cruza seus exames, dieta, treino e hábitos e revela conexões que passariam despercebidas — com prioridades claras do que fazer agora, sempre reforçando procurar um profissional quando é sério.",
  },
];

// Recursos que completam a experiência.
const extras = [
  {
    icon: Trophy,
    name: "Gamificação",
    desc: "Sequência (streak), níveis e XP, conquistas e desafios semanais para manter o engajamento.",
  },
  {
    icon: Users,
    name: "Ranking com amigos",
    desc: "Adicione amigos por código e compare XP e nível num ranking saudável.",
  },
  {
    icon: BarChart3,
    name: "Relatórios com IA",
    desc: "A cada período a IA analisa seus últimos 30 dias e traz o que está indo bem e o que melhorar.",
  },
  {
    icon: Smartphone,
    name: "App no celular (PWA)",
    desc: "Instale como aplicativo no celular ou no computador e receba lembretes mesmo com o app fechado.",
  },
];

// Tecnologias por trás, explicadas por benefício.
const tech = [
  {
    icon: Brain,
    name: "IA de ponta",
    desc: "A Gaia e os relatórios usam modelos de linguagem rápidos (Llama 3.3 70B via Groq). A leitura de foto de prato e de exames usa o Google Gemini.",
  },
  {
    icon: Zap,
    name: "Rápido e instalável",
    desc: "Construído com Next.js e empacotado como PWA: abre no navegador, instala como app e funciona no celular e no PC.",
  },
  {
    icon: Database,
    name: "Dados isolados",
    desc: "Banco Postgres (Supabase) com isolamento por conta (RLS): cada pessoa acessa apenas os próprios registros.",
  },
  {
    icon: ShieldCheck,
    name: "Conexão segura",
    desc: "Todo o tráfego é criptografado (HTTPS) e as chaves sensíveis ficam só no servidor, nunca no seu aparelho.",
  },
  {
    icon: RefreshCw,
    name: "Tempo real",
    desc: "As telas se atualizam sozinhas quando a Gaia registra algo — sem precisar recarregar a página.",
  },
  {
    icon: Bell,
    name: "Notificações",
    desc: "Web Push com agendador de lembretes: água, treino e a dose da caneta chegam na hora certa.",
  },
];

export default function RecursosPage() {
  return (
    <main className="bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-9 text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 lg:flex">
            <Link href="/" className="hover:text-white">Início</Link>
            <a href="#acompanha" className="hover:text-white">Recursos</a>
            <a href="#diferenciais" className="hover:text-white">Diferenciais</a>
            <a href="#tecnologia" className="hover:text-white">Tecnologia</a>
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

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(680px 420px at 78% 10%, rgba(24,184,94,0.28), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:py-28">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
              Recursos & Tecnologia
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl xl:text-7xl">
              tudo o que o app faz por você
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Treino, nutrição, corpo, hábitos, exames e tratamento num só lugar —
              com uma inteligência que conhece os seus dados, classifica seus
              exames e registra as coisas por você. Veja em detalhe cada recurso e
              a tecnologia por trás.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Pill href="/login" variant="green">Começar grátis</Pill>
              <Pill href="#tecnologia" variant="white">Ver a tecnologia</Pill>
            </div>
          </Reveal>
        </div>
      </section>

      {/* O QUE VOCÊ ACOMPANHA — branco */}
      <section id="acompanha" className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
              O que você acompanha
            </p>
            <h2 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-5xl">
              Uma visão completa da sua saúde
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {tracking.map((a, i) => (
              <Reveal key={a.name} delay={i * 60}>
                <div className="h-full rounded-3xl border border-slate-200 bg-white p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                    <a.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-slate-900">
                    {a.name}
                  </h3>
                  <p className="mt-1 text-slate-500">{a.desc}</p>
                  <ul className="mt-5 space-y-2.5">
                    {a.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-3 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS — preto */}
      <section id="diferenciais" className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
              O que nos torna diferentes
            </p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl">
              Recursos que poucos apps têm
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {diferenciais.map((d, i) => (
              <Reveal key={d.name} delay={i * 60}>
                <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800 to-black p-8 transition duration-300 hover:border-brand-500/40">
                  <div
                    className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(24,184,94,0.22), transparent 60%)",
                    }}
                  />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                    <d.icon className="h-7 w-7" />
                  </div>
                  <div className="relative">
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                      {d.sub}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
                      {d.name}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-slate-400">
                      {d.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* E AINDA — branco */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-5xl">
              E ainda
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((e, i) => (
              <Reveal key={e.name} delay={i * 60}>
                <div className="h-full rounded-3xl bg-slate-50 p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                    <e.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{e.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{e.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TECNOLOGIA — preto */}
      <section id="tecnologia" className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-400">
              Por baixo do capô
            </p>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl">
              A tecnologia por trás
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-slate-400">
              Ferramentas modernas escolhidas para deixar o app rápido, seguro e
              inteligente — explicadas pelo que fazem por você.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {tech.map((t) => (
              <div key={t.name} className="bg-black p-7">
                <t.icon className="h-6 w-6 text-brand-400" />
                <h3 className="mt-4 text-lg font-semibold text-white">{t.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-black">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(700px 340px at 50% 0%, rgba(24,184,94,0.25), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="font-display text-5xl font-semibold leading-[1.0] tracking-tight text-white sm:text-6xl">
            pronto para começar?
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-slate-400">
            Crie sua conta em segundos. Grátis, sem cartão.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Pill href="/login" variant="green" className="px-9 py-4 text-sm">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Pill>
            <Pill href="/" variant="outline" className="text-slate-300">
              Voltar ao início
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
              O {APP_NAME} é uma ferramenta de acompanhamento e educação em saúde e
              não substitui a avaliação de um profissional. Em caso de dúvidas
              médicas, procure seu médico ou nutricionista.
            </p>
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} {APP_NAME}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
