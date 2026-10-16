import Link from "next/link";
import {
  Stethoscope,
  Target,
  Utensils,
  Dumbbell,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { todayISO, formatDate, dataNoBrasil } from "@/lib/date";
import { CartaoConsulta } from "@/components/CartaoConsulta";
import { getConsultasDoCartao } from "@/lib/consultasDb";
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
        <p className="mt-4 text-sm text-app-texto-2">
          Você ainda não está conectado a nenhum nutricionista. Peça a ele o
          código de convite ou o link que ele gera no painel dele.
        </p>
      </div>
    );
  }

  const nutriId = link.nutritionist_id as string;

  const [profRes, prescRes, planoRes, notasRes, refeicoesRes, sessoesRes, consultasRes] =
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
      getConsultasDoCartao(supabase, uid),
    ]);

  const nutriNome = (profRes.data as any)?.full_name || "Seu nutricionista";
  const presc = prescRes.data as any;
  const plano = planoRes.data as any;
  const notas = (notasRes.data ?? []) as Nota[];
  const naoLidas = notas.filter((n) => n.author_id !== uid && !n.read_at).length;
  // `data ?? []` esconderia a falha: sem as refeições do dia o plano mostraria
  // tudo como não feito e ofereceria "Comi isso" de novo a quem já registrou
  // (o dia e a adesão contariam em dobro). Com a leitura falhando, o cardápio
  // diz que não carregou, no lugar das marcas e dos botões.
  const refeicoesFalharam = !!refeicoesRes.error;
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
      // A aba só mostra QUANTOS exercícios: o detalhe vive em /app/treino.
      supabase
        .from("routine_exercises")
        .select("id, routine_id")
        .in("routine_id", rotinaIds),
    ]);
    rotinas = r.data ?? [];
    exercicios = e.data ?? [];
  }

  // Segunda = 0, igual ao resto do app.
  const dowHoje = (new Date(today + "T12:00:00").getDay() + 6) % 7;

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
        <div className="icon-badge">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-app-texto">
            {nutriNome}
          </p>
          <p className="text-xs text-app-texto-2">
            Desde {formatDate(dataNoBrasil(String(link.accepted_at || link.created_at)))}
          </p>
        </div>
        {/* "Revogar acesso" roubava largura do nome, que truncava em
            "Ricardo Albuque…". A ação é secundária; o nome é que importa. */}
        <RevogarNutri linkId={link.id} />
      </div>

      {/* O id é o destino da linha da consulta na Início (#consulta); o
          scroll-mt deixa o cartão abaixo da barra de cima do celular. */}
      <div id="consulta" className="mb-5 scroll-mt-20">
        <CartaoConsulta
          consultas={consultasRes.data.filter((c) => c.nutritionist_id === nutriId)}
          agora={new Date().toISOString()}
          nutriNome={(profRes.data as any)?.full_name || undefined}
          falhou={consultasRes.falhou}
        />
      </div>

      {/* Abas espelham as do painel do nutricionista */}
      <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto pb-1">
        {ABAS.map((a) => (
          <Link
            key={a.key}
            href={`/app/nutricionista?aba=${a.key}`}
            scroll={false}
            className={`tappable inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
              aba === a.key
                ? "bg-app-primaria text-app-sobre-primaria"
                : "text-app-texto-2 hover:bg-app-primaria-fundo"
            }`}
          >
            {/* O ícone some no celular: com ele, as quatro abas não cabiam
                em 390px e "Conversa" ficava cortada pela borda — logo a que
                carrega o aviso de mensagem não lida. */}
            <a.icon className="hidden h-3.5 w-3.5 sm:block" />
            {a.label}
            {a.key === "conversa" && naoLidas > 0 ? (
              <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
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
              <h2 className="section-title mb-3">Suas metas do dia</h2>
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
                    <dt className="text-xs text-app-texto-2">
                      {label}
                    </dt>
                    <dd className="tabular font-semibold text-app-texto">
                      {valor ?? "—"}
                      {valor ? (
                        <span className="text-xs font-medium text-app-texto-2">
                          {" "}
                          {unidade}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-app-linha pt-3 text-xs text-app-texto-2">
                Definidas por {nutriNome} em{" "}
                {formatDate(dataNoBrasil(String(presc.created_at)))}. O
                acompanhamento do dia contra estas metas aparece em{" "}
                <Link href="/app" className="font-medium text-app-primaria hover:underline">
                  Início
                </Link>
                .
              </p>
            </div>

            {presc.notes && (
              <div className="card mt-4">
                <h2 className="section-title mb-2">Orientações</h2>
                <p className="whitespace-pre-wrap text-sm text-app-texto">
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
              refeicoesFalharam={refeicoesFalharam}
            />
            {/* Sem as refeições do dia o cardápio não oferece "Comi isso", e a nota
                falaria de um botão que não está na tela. */}
            {!refeicoesFalharam && (
              <p className="text-xs text-app-texto-2">
                Tocar em “Comi isso” registra a refeição na sua Dieta — não
                precisa digitar de novo.
              </p>
            )}
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
                    {dia}
                    {i === dowHoje && (
                      <span className="rounded-full bg-app-primaria-fundo px-2 py-0.5 text-[11px] font-semibold text-app-primaria">
                        hoje
                      </span>
                    )}
                  </p>
                  <div className="space-y-3">
                    {doDia.map((s) => {
                      const rotina = rotinas.find((r) => r.id === s.routine_id);
                      const exs = exercicios.filter(
                        (e) => e.routine_id === s.routine_id
                      );
                      // O dia agora é um atalho para a tela do treino, onde
                      // a lista cabe com tipografia de ler em pé na
                      // academia. Aqui fica só o bastante para escolher:
                      // nome, modalidade e quantos exercícios.
                      const resumo = [
                        s.sport,
                        exs.length > 0
                          ? `${exs.length} exercício${exs.length > 1 ? "s" : ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <Link
                          key={s.id}
                          href={`/app/treino/${s.id}`}
                          className="tappable group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-app-pagina"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-app-texto">
                              {s.title || rotina?.name || s.sport}
                            </p>
                            <p className="truncate text-xs text-app-texto-2">
                              {resumo}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-app-texto-2 transition group-hover:translate-x-0.5 group-hover:text-app-primaria" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-app-texto-2">
              Toque num treino para ver os exercícios. A confirmação
              (“fui” ou “não fui”) fica na própria tela do treino e em{" "}
              <Link
                href="/app"
                className="font-medium text-app-primaria hover:underline"
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
    <div className="rounded-xl border border-dashed border-app-campo p-8 text-center">
      <p className="text-sm text-app-texto-2">{texto}</p>
    </div>
  );
}
