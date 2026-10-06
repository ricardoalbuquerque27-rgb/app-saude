import Link from "next/link";
import {
  Stethoscope,
  Target,
  Utensils,
  Dumbbell,
  MessageSquare,
  NotebookPen,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { todayISO, formatDate } from "@/lib/date";
import NutriNotes, { type Nota } from "@/components/NutriNotes";
import MealPlanView from "@/components/MealPlanView";
import ConectarNutri from "@/components/ConectarNutri";
import RevogarNutri from "@/components/RevogarNutri";

export const dynamic = "force-dynamic";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const ABAS = [
  { key: "metas", label: "Metas", icon: Target },
  { key: "cardapio", label: "Cardápio", icon: Utensils },
  { key: "treino", label: "Treino", icon: Dumbbell },
  { key: "conversa", label: "Conversa", icon: MessageSquare },
] as const;

type AbaKey = (typeof ABAS)[number]["key"];

// Página única do acompanhamento, do lado do paciente. Ela espelha as abas
// que o nutricionista preenche (metas, cardápio, treino, conversa), para o
// que foi prescrito chegar organizado do mesmo jeito que foi escrito — antes
// isso estava espalhado por Dieta, Treinos, Perfil e esta página.
export default async function MeuNutricionistaPage({
  searchParams,
}: {
  searchParams: { aba?: string; code?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;
  const today = todayISO();

  const aba: AbaKey = (ABAS.find((a) => a.key === searchParams?.aba)?.key ??
    "metas") as AbaKey;

  const { data: linkRow } = await supabase
    .from("patient_links")
    .select("id, nutritionist_id, created_at, accepted_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const link = linkRow as any;

  // Sem vínculo não há o que organizar: só o caminho para criar um.
  if (!link) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title="Meu plano"
          subtitle="Conecte-se ao seu nutricionista para receber metas, cardápio e treino aqui."
        />
        <ConectarNutri codeInicial={searchParams?.code ?? ""} />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Você ainda não está conectado a nenhum nutricionista. Peça a ele o
          código de convite ou o link que ele gera no painel dele.
        </p>
      </div>
    );
  }

  const nutriId = link.nutritionist_id as string;

  const [profRes, prescRes, planoRes, notasRes, refeicoesRes, sessoesRes] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", nutriId).maybeSingle(),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meal_plans")
        .select("id, name, notes, updated_at")
        .eq("patient_id", uid)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("patient_notes")
        .select("id, body, created_at, read_at, author_id")
        .eq("patient_id", uid)
        .eq("visibility", "shared")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("meals")
        .select("meal_type")
        .eq("user_id", uid)
        .eq("date", today),
      supabase
        .from("workout_plan")
        .select("id, sport, title, notes, day_of_week, routine_id, prescribed_by")
        .eq("user_id", uid)
        .not("prescribed_by", "is", null)
        .order("day_of_week", { ascending: true })
        .order("position", { ascending: true }),
    ]);

  const nutriNome = (profRes.data as any)?.full_name || "Seu nutricionista";
  const presc = prescRes.data as any;
  const plano = planoRes.data as any;
  const notas = (notasRes.data ?? []) as Nota[];
  const naoLidas = notas.filter((n) => n.author_id !== uid && !n.read_at).length;
  const jaRegistrados = (refeicoesRes.data ?? []).map((m: any) => m.meal_type);
  const sessoes = (sessoesRes.data ?? []) as any[];

  let itensCardapio: any[] = [];
  if (plano) {
    const { data } = await supabase
      .from("meal_plan_items")
      .select("id, meal_type, position, description, calories, protein_g, carbs_g, fat_g")
      .eq("meal_plan_id", plano.id)
      .order("position", { ascending: true });
    itensCardapio = data ?? [];
  }

  // Exercícios das rotinas que as sessões prescritas apontam.
  const rotinaIds = Array.from(
    new Set(sessoes.map((s) => s.routine_id).filter(Boolean))
  ) as string[];
  let exercicios: any[] = [];
  let rotinas: any[] = [];
  if (rotinaIds.length > 0) {
    const [r, e] = await Promise.all([
      supabase.from("routines").select("id, name, notes").in("id", rotinaIds),
      supabase
        .from("routine_exercises")
        .select("id, routine_id, name, target_sets, target_reps, target_weight_kg, rest_seconds, position")
        .in("routine_id", rotinaIds)
        .order("position", { ascending: true }),
    ]);
    rotinas = r.data ?? [];
    exercicios = e.data ?? [];
  }

  const temMetas =
    presc &&
    (presc.daily_calorie_goal ||
      presc.protein_goal_g ||
      presc.daily_water_goal_ml ||
      presc.weight_goal_kg);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Meu plano"
        subtitle="Tudo o que seu nutricionista definiu para você, num lugar só."
      />

      {/* Quem está acompanhando */}
      <div className="card mb-5 flex items-center gap-3 p-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {nutriNome}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanha você desde{" "}
            {formatDate(String(link.accepted_at || link.created_at).slice(0, 10))}
          </p>
        </div>
        <RevogarNutri linkId={link.id} />
      </div>

      {/* Abas espelham as do painel do nutricionista */}
      <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto pb-1">
        {ABAS.map((a) => (
          <Link
            key={a.key}
            href={`/app/nutricionista?aba=${a.key}`}
            scroll={false}
            className={`tappable inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              aba === a.key
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <a.icon className="h-3.5 w-3.5" />
            {a.label}
            {a.key === "conversa" && naoLidas > 0 ? (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {naoLidas}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* ---------------- METAS ---------------- */}
      {aba === "metas" &&
        (temMetas ? (
          <>
            <div className="card">
              <h2 className="section-title mb-3">
                <span className="icon-badge">
                  <Target className="h-4 w-4" />
                </span>
                Suas metas do dia
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                {[
                  ["Calorias/dia", presc.daily_calorie_goal, "kcal"],
                  ["Proteína/dia", presc.protein_goal_g, "g"],
                  [
                    "Água/dia",
                    presc.daily_water_goal_ml
                      ? (presc.daily_water_goal_ml / 1000).toFixed(1)
                      : null,
                    "L",
                  ],
                  ["Peso alvo", presc.weight_goal_kg, "kg"],
                ].map(([label, valor, unidade]: any) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">
                      {label}
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {valor ?? "—"}
                      {valor ? (
                        <span className="text-xs font-medium text-slate-400">
                          {" "}
                          {unidade}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Definidas por {nutriNome} em{" "}
                {formatDate(String(presc.created_at).slice(0, 10))}. O
                acompanhamento do dia contra estas metas aparece em{" "}
                <Link href="/app" className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                  Início
                </Link>
                .
              </p>
            </div>

            {presc.notes && (
              <div className="card mt-4">
                <h2 className="section-title mb-2">
                  <span className="icon-badge">
                    <NotebookPen className="h-4 w-4" />
                  </span>
                  Orientações
                </h2>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {presc.notes}
                </p>
              </div>
            )}
          </>
        ) : (
          <Vazio texto="Seu nutricionista ainda não definiu metas para você." />
        ))}

      {/* ---------------- CARDÁPIO ---------------- */}
      {aba === "cardapio" &&
        (plano && itensCardapio.length > 0 ? (
          <>
            <MealPlanView
              nome={plano.name}
              observacao={plano.notes}
              itens={itensCardapio as any}
              date={today}
              jaRegistrados={jaRegistrados}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tocar em “Comi isso” registra a refeição na sua Dieta — não
              precisa digitar de novo.
            </p>
          </>
        ) : (
          <Vazio texto="Seu nutricionista ainda não montou um cardápio para você." />
        ))}

      {/* ---------------- TREINO ---------------- */}
      {aba === "treino" &&
        (sessoes.length > 0 ? (
          <div className="space-y-3">
            {DIAS.map((dia, i) => {
              const doDia = sessoes.filter((s) => s.day_of_week === i);
              if (doDia.length === 0) return null;
              return (
                <div key={dia} className="card">
                  <p className="eyebrow mb-2 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dia}
                  </p>
                  <div className="space-y-3">
                    {doDia.map((s) => {
                      const rotina = rotinas.find((r) => r.id === s.routine_id);
                      const exs = exercicios.filter(
                        (e) => e.routine_id === s.routine_id
                      );
                      return (
                        <div key={s.id}>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {s.title || rotina?.name || s.sport}
                          </p>
                          {s.notes && (
                            <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                              {s.notes}
                            </p>
                          )}
                          {exs.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {exs.map((e) => (
                                <li
                                  key={e.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm dark:bg-slate-900/60"
                                >
                                  <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">
                                    {e.name}
                                  </span>
                                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                    {[
                                      e.target_sets && e.target_reps
                                        ? `${e.target_sets}×${e.target_reps}`
                                        : e.target_sets
                                          ? `${e.target_sets} séries`
                                          : null,
                                      e.target_weight_kg
                                        ? `${e.target_weight_kg} kg`
                                        : null,
                                      e.rest_seconds ? `${e.rest_seconds}s desc.` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A confirmação de cada dia (“fui” ou “não fui”) fica em{" "}
              <Link
                href="/app"
                className="font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                Início
              </Link>
              , no treino do dia.
            </p>
          </div>
        ) : (
          <Vazio texto="Seu nutricionista ainda não montou um treino para você." />
        ))}

      {/* ---------------- CONVERSA ---------------- */}
      {aba === "conversa" && (
        <NutriNotes notas={notas} meuId={uid} nutriId={nutriId} />
      )}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">{texto}</p>
    </div>
  );
}
