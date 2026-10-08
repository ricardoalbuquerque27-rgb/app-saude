import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Stethoscope,
  Timer,
  Dumbbell,
  NotebookPen,
  Play,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import PlanCheckIn from "@/components/PlanCheckIn";

export const dynamic = "force-dynamic";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// Tela de LEITURA de um treino do plano. Não confundir com WorkoutSession,
// que é a execução ao vivo (cronômetro, registro de séries).
//
// Serve aos dois lugares que mostram treino prescrito — "Meu plano" e a
// Início —, para não existir uma terceira cópia da mesma informação. A
// tipografia aqui é maior de propósito: isto é lido em pé, na academia,
// com o celular a meio braço de distância.
export default async function TreinoDetalhe({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;
  const hoje = todayISO();

  const { data: sessaoRow } = await supabase
    .from("workout_plan")
    .select("id, day_of_week, sport, title, notes, routine_id, prescribed_by")
    .eq("id", params.id)
    .eq("user_id", uid)
    .maybeSingle();
  const sessao = sessaoRow as any;
  if (!sessao) notFound();

  let rotina: any = null;
  let exercicios: any[] = [];
  if (sessao.routine_id) {
    const [r, e] = await Promise.all([
      supabase
        .from("routines")
        .select("id, name, notes")
        .eq("id", sessao.routine_id)
        .maybeSingle(),
      supabase
        .from("routine_exercises")
        .select("id, name, target_sets, target_reps, target_weight_kg, rest_seconds, position, notes")
        .eq("routine_id", sessao.routine_id)
        .order("position", { ascending: true }),
    ]);
    rotina = r.data;
    exercicios = e.data ?? [];
  }

  let nutriNome = "";
  if (sessao.prescribed_by) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", sessao.prescribed_by)
      .maybeSingle();
    nutriNome = (data as any)?.full_name || "";
  }

  // Segunda = 0, igual ao resto do app.
  const dowHoje = (new Date(hoje + "T12:00:00").getDay() + 6) % 7;
  const ehHoje = sessao.day_of_week === dowHoje;

  const { data: feitos } = await supabase
    .from("plan_completions")
    .select("id, plan_id, date, status, workout_id")
    .eq("user_id", uid)
    .eq("date", hoje);

  const titulo = sessao.title || rotina?.name || sessao.sport;

  return (
    <div className="max-w-2xl">
      <Link
        href="/app/nutricionista?aba=treino"
        className="tappable mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Meu plano
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {DIAS[sessao.day_of_week]}
        </span>
        {ehHoje && (
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
            hoje
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {sessao.sport}
        </span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {titulo}
      </h1>

      {sessao.prescribed_by && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
          <Stethoscope className="h-4 w-4" />
          Prescrito por {nutriNome || "seu nutricionista"}
        </p>
      )}

      {(sessao.notes || rotina?.notes) && (
        <div className="card mt-4">
          <p className="eyebrow mb-1.5 flex items-center gap-1.5">
            <NotebookPen className="h-3.5 w-3.5" />
            Orientações
          </p>
          {sessao.notes && (
            <p className="whitespace-pre-wrap text-base text-slate-700 dark:text-slate-200">
              {sessao.notes}
            </p>
          )}
          {rotina?.notes && (
            <p className="mt-1 whitespace-pre-wrap text-base text-slate-700 dark:text-slate-200">
              {rotina.notes}
            </p>
          )}
        </div>
      )}

      {/* O modo compacto do PlanCheckIn mostra só os botões: a modalidade
          e o nome do treino já são o título desta tela, e repeti-los dentro
          do cartão era dizer a mesma coisa três vezes. */}
      {ehHoje && (
        <div className="card mt-4">
          <p className="eyebrow mb-1">Você treinou hoje?</p>
          <PlanCheckIn
            sessions={[sessao] as any}
            date={hoje}
            completions={(feitos ?? []) as any}
            compact
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Seu nutricionista vê essa confirmação.
          </p>
        </div>
      )}

      {/* A lista. Nome grande; os números em linha própria, com rótulo —
          "4 × 10" sozinho não diz o que é para quem está começando. */}
      {exercicios.length > 0 ? (
        <section className="mt-5">
          <h2 className="section-title mb-3">
            <span className="icon-badge">
              <Dumbbell className="h-4 w-4" />
            </span>
            {exercicios.length} exercício{exercicios.length > 1 ? "s" : ""}
          </h2>

          <ol className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:divide-white/[0.06] dark:border-white/[0.06] dark:bg-slate-900/50">
            {exercicios.map((e, i) => (
              <li key={e.id} className="flex gap-3 p-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    {e.name}
                  </p>
                  <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                    {e.target_sets != null && (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Séries
                        </dt>
                        <dd className="text-base font-semibold tabular text-slate-900 dark:text-white">
                          {e.target_sets}
                          {e.target_reps != null && (
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {" × "}
                              {e.target_reps} reps
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {e.target_weight_kg != null && (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Carga
                        </dt>
                        <dd className="text-base font-semibold tabular text-slate-900 dark:text-white">
                          {e.target_weight_kg}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {" "}
                            kg
                          </span>
                        </dd>
                      </div>
                    )}
                    {e.rest_seconds != null && (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Descanso
                        </dt>
                        <dd className="flex items-center gap-1 text-base font-semibold tabular text-slate-900 dark:text-white">
                          <Timer className="h-3.5 w-3.5 text-slate-400" />
                          {e.rest_seconds}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            s
                          </span>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {e.notes && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                      {e.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <Link
            href="/app/treinos"
            className="btn-primary mt-4 w-full py-3 text-base"
          >
            <Play className="h-4 w-4" />
            Iniciar treino
          </Link>
          <p className="mt-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
            A execução com cronômetro e registro de séries fica em Treinos.
          </p>
        </section>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Este dia não tem exercícios detalhados — só a modalidade
            {sessao.notes ? " e a orientação acima" : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
