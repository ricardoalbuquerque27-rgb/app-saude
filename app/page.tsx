import Link from "next/link";
import {
  Dumbbell,
  Salad,
  LineChart,
  Droplets,
  FileText,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Dumbbell,
    title: "Treinos",
    desc: "Registre exercícios, séries, cargas e acompanhe sua evolução.",
  },
  {
    icon: Salad,
    title: "Dieta",
    desc: "Controle refeições, calorias e macros do dia a dia.",
  },
  {
    icon: LineChart,
    title: "Peso e medidas",
    desc: "Acompanhe peso e medidas corporais em gráficos.",
  },
  {
    icon: Droplets,
    title: "Água, sono e hábitos",
    desc: "Metas diárias de hidratação, sono e humor.",
  },
  {
    icon: FileText,
    title: "Exames",
    desc: "Guarde resultados de exames e acompanhe indicadores.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-brand-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 text-lg font-bold text-brand-700 dark:text-brand-400">
          <Dumbbell className="h-6 w-6" />
          Pace Fit
        </div>
        <Link href="/login" className="btn-primary">
          Entrar
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 text-center sm:pt-20">
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          Sua saúde em um só lugar
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Acompanhe seus treinos, dieta e saúde
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400">
          Um app simples para registrar tudo que importa: exercícios, alimentação,
          peso, hábitos diários e exames. No celular ou no computador.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary px-6 py-3 text-base">
            Começar agora <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {f.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        Pace Fit — feito para acompanhar sua evolução.
      </footer>
    </main>
  );
}
