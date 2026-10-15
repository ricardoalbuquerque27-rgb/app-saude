import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Stethoscope,
  Timer,
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
      {/* O treino do próprio paciente também abre aqui. Mandá-lo para "Meu
          plano" despejava quem não tem nutricionista na tela de convite. */}
      <Link
        href={sessao.prescribed_by ? "/app/nutricionista?aba=treino" : "/app/treinos"}
        className="tappable mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-app-texto-2 hover:text-app-primaria"
      >
        <ArrowLeft className="h-4 w-4" />
        {sessao.prescribed_by ? "Meu plano" : "Treinos"}
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="chip">{DIAS[sessao.day_of_week]}</span>
        {ehHoje && (
          <span className="rounded-full bg-app-primaria-fundo px-2.5 py-0.5 text-xs font-semibold text-app-primaria">
            hoje
          </span>
        )}
        <span className="chip">{sessao.sport}</span>
      </div>

      <h1 className="text-2xl font-semibold text-app-texto sm:text-3xl">
        {titulo}
      </h1>

      {sessao.prescribed_by && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-app-primaria">
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
            <p className="whitespace-pre-wrap text-base text-app-texto">
              {sessao.notes}
            </p>
          )}
          {rotina?.notes && (
            <p className="mt-1 whitespace-pre-wrap text-base text-app-texto">
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
          <p className="mt-2 text-xs text-app-texto-2">
            Seu nutricionista vê essa confirmação.
          </p>
        </div>
      )}

      {/* A lista. Nome grande; os números em linha própria, com rótulo —
          "4 × 10" sozinho não diz o que é para quem está começando. */}
      {exercicios.length > 0 ? (
        <section className="mt-5">
          <h2 className="section-title mb-3">
            {exercicios.length} exercício{exercicios.length > 1 ? "s" : ""}
          </h2>

          <ol className="card divide-y divide-app-linha overflow-hidden p-0">
            {exercicios.map((e, i) => (
              <li key={e.id} className="flex gap-3 p-4">
                <span className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-primaria-fundo text-sm font-semibold text-app-primaria">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-app-texto">
                    {e.name}
                  </p>
                  <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                    {e.target_sets != null && (
                      <div>
                        <dt className="text-[13px] text-app-texto-2">
                          Séries
                        </dt>
                        <dd className="tabular text-base font-semibold text-app-texto">
                          {e.target_sets}
                          {e.target_reps != null && (
                            <span className="font-normal text-app-texto-2">
                              {" × "}
                              {e.target_reps} reps
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {e.target_weight_kg != null && (
                      <div>
                        <dt className="text-[13px] text-app-texto-2">
                          Carga
                        </dt>
                        <dd className="tabular text-base font-semibold text-app-texto">
                          {e.target_weight_kg}
                          <span className="font-normal text-app-texto-2">
                            {" "}
                            kg
                          </span>
                        </dd>
                      </div>
                    )}
                    {e.rest_seconds != null && (
                      <div>
                        <dt className="text-[13px] text-app-texto-2">
                          Descanso
                        </dt>
                        <dd className="tabular flex items-center gap-1 text-base font-semibold text-app-texto">
                          <Timer className="h-3.5 w-3.5 text-app-texto-2" />
                          {e.rest_seconds}
                          <span className="font-normal text-app-texto-2">
                            s
                          </span>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {e.notes && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-app-texto">
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
          <p className="mt-1.5 text-center text-xs text-app-texto-2">
            A execução com cronômetro e registro de séries fica em Treinos.
          </p>
        </section>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-app-campo p-8 text-center">
          <p className="text-sm text-app-texto-2">
            Este dia não tem exercícios detalhados — só a modalidade
            {sessao.notes ? " e a orientação acima" : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
