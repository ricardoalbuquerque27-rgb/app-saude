import Link from "next/link";
import { ChevronRight, Plus, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProgressRing } from "@/components/ProgressRing";
import { todayISO, addDaysISO, hojeLongo, limitesDaJanela, saudacao } from "@/lib/date";
import { computeHealthScore } from "@/lib/healthScore";
import { getPending } from "@/lib/pending";
import { montarParaHoje, refeicoesQueFaltam } from "@/lib/paraHoje";
import { sugestaoDeProteina } from "@/lib/cardapio";
import { papelDasCalorias, pesoDe30Dias, pesoMaisRecente, textoVariacaoPeso } from "@/lib/nutri";
import { dataCurta } from "@/lib/consultas";
import { numeroBR, numeroFixo } from "@/lib/numeros";
import NutriHome from "@/components/NutriHome";
import { LinhaDaConsulta } from "@/components/LinhaDaConsulta";
import { ParaHoje } from "@/components/inicio/ParaHoje";
import { ScoreExplicado } from "@/components/inicio/ScoreExplicado";
import AdicionarAgua from "@/components/inicio/AdicionarAgua";
import { LinhaDoPeso } from "@/components/inicio/LinhaDoPeso";
import { TextoDaSugestao } from "@/components/TextoDaSugestao";
import { getConsultasDoCartao } from "@/lib/consultasDb";

// A Início do paciente (spec do visual do app do paciente, "Início
// (paciente)"): uma coluna só, no celular e no computador, nesta ordem — data
// e saudação, a consulta numa linha, "Para hoje", "Registrar", "Seu dia",
// "Progresso" e os links. A conta de cada bloco mora em lib/ e é testada
// (montarParaHoje, sugestaoDeProteina, papelDasCalorias, pesoDe30Dias,
// computeHealthScore); a página lê e desenha.

const PESO = "date, weight_kg, measured_by, created_at";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const today = todayISO();

  // Nutricionista tem uma home própria (visão macro da carteira); nada do
  // dashboard de paciente abaixo é carregado para ele.
  const { data: roleRow } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", uid)
    .maybeSingle();
  if ((roleRow as any)?.role === "nutritionist") {
    return (
      <NutriHome
        firstName={((roleRow as any)?.full_name || "Nutri").split(" ")[0]}
        today={today}
      />
    );
  }

  // -6 porque a comparação é >=: de hoje-6 até hoje são 7 dias. Com -7 o
  // "Treinos (7 dias)" contava 8 dias de treino.
  const weekAgo = addDaysISO(today, -6);
  const dow = (new Date(today + "T12:00:00").getDay() + 6) % 7; // 0 = Segunda
  // O peso de 30 dias: a janela pela mesma conta do nutricionista. A leitura
  // antiga era `order(date asc).limit(60)`, que pega as 60 MAIS ANTIGAS: com
  // mais de 60 pesagens, o "Peso atual" era uma de meses atrás.
  const janelaDoPeso = limitesDaJanela(today, 30);

  const [
    profileRes,
    workoutsWeekRes,
    mealsTodayRes,
    pesoRes,
    dailyTodayRes,
    recentWorkoutsRes,
    todayPlanRes,
    treatmentRes,
    todayCompletionsRes,
    notasRes,
    cardapioRes,
    vinculoRes,
    consultasRes,
    respostasHojeRes,
    pending,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("date", weekAgo)
      // Teto: o campo de data do "Novo treino" não tem max, então um
      // registro à frente inflava "Treinos (7 dias)" e o Score junto.
      .lte("date", today),
    supabase
      .from("meals")
      .select("calories, protein_g, meal_type")
      .eq("user_id", uid)
      .eq("date", today),
    supabase
      .from("body_measurements")
      .select(PESO)
      .eq("user_id", uid)
      .not("weight_kg", "is", null)
      .gte("date", janelaDoPeso.desde)
      .lte("date", janelaDoPeso.ate),
    supabase
      .from("daily_logs")
      .select("water_ml, sleep_hours, mood, energy")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle(),
    // Os treinos recentes ficam só para o Score (treinou hoje?): a lista saiu
    // da Início e virou o link "Treinos recentes".
    supabase
      .from("workouts")
      .select("id, date")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("workout_plan")
      .select("id, sport, title, day_of_week, prescribed_by")
      .eq("user_id", uid)
      .eq("day_of_week", dow)
      .order("position", { ascending: true }),
    supabase
      .from("treatments")
      .select("medication, dose, next_dose_date")
      .eq("user_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("plan_completions")
      .select("id, plan_id, date, status, workout_id")
      .eq("user_id", uid)
      .eq("date", today),
    supabase
      .from("patient_notes")
      .select("id, body, created_at, read_at, author_id")
      .eq("patient_id", uid)
      .eq("visibility", "shared")
      .neq("author_id", uid)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("meal_plans")
      .select("id")
      .eq("patient_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patient_links")
      .select("nutritionist_id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    // As consultas da última semana em diante (inclusive as futuras) e os
    // pedidos abertos, por início crescente (getConsultasDoCartao), para a linha.
    getConsultasDoCartao(supabase, uid),
    // As respostas do plano hoje ("comi" / "não comi"): a refeição respondida
    // não "falta" no "Para hoje".
    supabase.from("meal_checks").select("meal_type").eq("user_id", uid).eq("date", today),
    getPending(supabase, uid),
  ]);

  const profile = profileRes.data as any;
  // Com a leitura do perfil falhando, o nome vem da conta, como no menu
  // (app/app/layout.tsx), e não o "Atleta" de quem nunca preencheu.
  const firstName = (profile?.full_name || user?.user_metadata?.full_name || "Atleta").split(" ")[0];
  const cardapio = cardapioRes.data as any;
  const vinculo = vinculoRes.data as any;
  const peso30 = pesoRes.error ? null : pesoDe30Dias((pesoRes.data ?? []) as any, today);

  // O que depende da primeira leva: os itens do cardápio, o nome do
  // nutricionista e, sem pesagem na janela, a última antes dela.
  const [itensRes, nutriRes, pesoAntesRes] = await Promise.all([
    cardapio
      ? supabase
          .from("meal_plan_items")
          .select("id, meal_type, position, description, protein_g")
          .eq("meal_plan_id", cardapio.id)
          .order("position", { ascending: true })
      : null,
    vinculo?.nutritionist_id
      ? supabase.from("profiles").select("full_name").eq("id", vinculo.nutritionist_id).maybeSingle()
      : null,
    peso30 && peso30.atual == null
      ? supabase
          .from("body_measurements")
          .select(PESO)
          .eq("user_id", uid)
          .not("weight_kg", "is", null)
          .lt("date", janelaDoPeso.desde)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10)
      : null,
  ]);

  const nutriNome: string = (nutriRes?.data as any)?.full_name || "";
  const temNutri = !!vinculo;

  // ---------------------------------------------------------------------
  // Progresso: o peso de 30 dias, pela conta do nutricionista (pesoDe30Dias:
  // um valor por dia, a medida da consulta vence a de casa, teto em hoje).
  // ---------------------------------------------------------------------
  const pesoFalhou = !!pesoRes.error || !!pesoAntesRes?.error;
  // Sem peso na janela, o último peso antes dela é o de `pesoMaisRecente`, o da
  // Dieta também; dentro da janela vale o `atual` de `pesoDe30Dias`. As duas
  // contas passam por `pesoDoDia`, então concordam.
  const pesoAnterior =
    pesoAntesRes && !pesoAntesRes.error ? pesoMaisRecente((pesoAntesRes.data ?? []) as any[], today) : null;
  const pesoAtual = peso30?.atual ?? pesoAnterior?.peso ?? null;

  // ---------------------------------------------------------------------
  // Seu dia: o Score, os anéis e a sugestão de proteína.
  // ---------------------------------------------------------------------
  const refeicoesHoje = (mealsTodayRes.data ?? []) as any[];
  const caloriesToday = refeicoesHoje.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const proteinToday = refeicoesHoje.reduce((s, m) => s + (Number(m.protein_g) || 0), 0);
  const tiposJaRegistrados: string[] = refeicoesHoje.map((m) => m.meal_type);
  const waterToday = Number((dailyTodayRes.data as any)?.water_ml) || 0;
  const waterGoal = profile?.daily_water_goal_ml ?? 2500;
  const calorieGoal = profile?.daily_calorie_goal ?? null;
  const proteinGoal = profile?.protein_goal_g ?? null;
  const sleepToday = (dailyTodayRes.data as any)?.sleep_hours ?? null;
  const recentWorkouts = (recentWorkoutsRes.data ?? []) as any[];

  const health = computeHealthScore({
    sleepHours: sleepToday,
    trainedToday: recentWorkouts.some((w) => w.date === today),
    workoutsWeek: workoutsWeekRes.count ?? 0,
    mealsLoggedToday: refeicoesHoje.length,
    proteinToday,
    proteinGoal,
    caloriesToday,
    calorieGoal,
    waterToday,
    waterGoal,
    mood: (dailyTodayRes.data as any)?.mood ?? null,
    energy: (dailyTodayRes.data as any)?.energy ?? null,
  });

  // A meta de calorias é teto ("limite") para quem está acima do peso-alvo e
  // piso ("meta") para quem está abaixo. Sem pesagem na janela, vale a última.
  const metaDePeso = profile?.weight_goal_kg != null ? Number(profile.weight_goal_kg) : null;
  const papel = papelDasCalorias(pesoAtual, metaDePeso);

  const itensDoPlano = ((itensRes?.data ?? []) as any[]).map((i) => ({
    meal_type: i.meal_type,
    position: Number(i.position) || 0,
    description: i.description,
    protein_g: i.protein_g == null ? null : Number(i.protein_g),
  }));
  // Com as refeições de hoje ou o plano sem carregar, a conta partiria de um
  // zero que é falha, e a frase diria "Faltam 110 g" a quem já comeu.
  const sugestao =
    mealsTodayRes.error || itensRes?.error
      ? null
      : sugestaoDeProteina({
          meta: proteinGoal == null ? null : Number(proteinGoal),
          consumido: proteinToday,
          itens: itensDoPlano,
          tiposRegistrados: tiposJaRegistrados,
          vinculoAtivo: temNutri,
        });
  // A dica principal sai quando a sugestão aparece e o pilar mais fraco é a
  // Nutrição: as duas diriam "faltam N g de proteína" uma embaixo da outra.
  const mostraDica =
    health.hasData && !!health.topTip && !(sugestao && health.topPilar === "nutricao");

  // "Seu dia" inteiro sai das refeições de hoje, do registro do dia, do perfil
  // (as metas) e dos treinos (o movimento do Score). Com qualquer um falhando,
  // os anéis e o Score mostrariam zeros, ou a meta padrão de 2,5 L e o
  // "Definir metas" para quem já definiu: o bloco diz que não carregou.
  const seuDiaFalhou =
    !!mealsTodayRes.error ||
    !!dailyTodayRes.error ||
    !!profileRes.error ||
    !!workoutsWeekRes.error ||
    !!recentWorkoutsRes.error;

  // "1.800" e "1,45": números de anel em pt-BR. A água leva até duas casas,
  // porque um copo é 0,25 L e "1,2" depois de "+250 ml" não mudaria.
  const kcal = (n: number) => Math.round(n).toLocaleString("pt-BR");
  const litros = (ml: number) => numeroBR(ml / 1000, 2);

  // ---------------------------------------------------------------------
  // Para hoje: cada leitura que o alimenta guarda o `error`. O supabase-js
  // devolve `{ data: null, error }` sem lançar, e a página fazia `data ?? []`:
  // com os recados fora do ar, o cartão dizia "em dia".
  // ---------------------------------------------------------------------
  const todayPlan = (todayPlanRes.data ?? []) as any[];
  const todayCompletions = (todayCompletionsRes.data ?? []) as any[];
  const notasNaoLidas = (notasRes.data ?? []) as any[];
  const treatment = treatmentRes.data as any;

  // Dias até a próxima dose, contados em datas (meio-dia UTC), sem o fuso de
  // quem roda.
  const diasAteADose = treatment?.next_dose_date
    ? Math.round(
        (Date.parse(treatment.next_dose_date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) /
          86400000
      )
    : null;
  const doseHojeOuAtrasada = diasAteADose != null && diasAteADose <= 0;


  const falhouParaHoje =
    !!notasRes.error ||
    !!todayPlanRes.error ||
    !!todayCompletionsRes.error ||
    !!cardapioRes.error ||
    !!itensRes?.error ||
    !!mealsTodayRes.error ||
    // Sem as respostas, a refeição respondida ("não comi") voltaria a faltar.
    !!respostasHojeRes.error ||
    !!treatmentRes.error ||
    // Sem o vínculo, o treino do nutricionista viraria "seu treino".
    !!vinculoRes.error ||
    pending.falhou;

  const paraHoje = montarParaHoje({
    recados: notasNaoLidas,
    treinos: todayPlan,
    confirmados: todayCompletions.map((c) => c.plan_id).filter(Boolean),
    temNutri,
    aplicacao: doseHojeOuAtrasada ? { atrasada: (diasAteADose as number) < 0 } : null,
    refeicoesFaltando: refeicoesQueFaltam(
      itensDoPlano.map((i) => i.meal_type),
      tiposJaRegistrados,
      ((respostasHojeRes.data ?? []) as { meal_type: string }[]).map((r) => r.meal_type)
    ),
    pendencias: pending.items,
    falhou: falhouParaHoje,
  });

  // A data longa vem minúscula do Intl ("quinta-feira, 15 de outubro"); a
  // maiúscula vai no texto, e não por CSS: `first-letter:uppercase` é caixa
  // alta por estilo, que a Início não usa.
  const dataLonga = hojeLongo();
  const dataDeHoje = dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1);

  // "Refeição" e "Foto do prato" apontavam para a MESMA URL, /app/dieta, e
  // nenhuma das duas abria nada — a pessoa chegava na página e tinha de
  // procurar o botão. Agora cada atalho abre o que o rótulo diz.
  const atalhos = [
    { href: "/app/dieta?novo=1", label: "Refeição" },
    { href: "/app/dieta?foto=1", label: "Foto do prato" },
    { href: "/app/treinos", label: "Treino" },
    { href: "/app/medidas", label: "Peso" },
  ];

  const LINK_DE_LISTA =
    "tappable flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] text-app-texto hover:bg-app-primaria-fundo";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Data e saudação, pela hora de São Paulo (o servidor roda em UTC). */}
      <header>
        <p className="text-[13px] text-app-texto-2">{dataDeHoje}</p>
        <h1 className="text-2xl font-semibold text-app-texto">
          {saudacao(new Date())}, {firstName}
        </h1>
      </header>

      {/* 2. A consulta, numa linha: a data é o que se procura, e aqui ela
          aparece sem rolar. As ações ficam no cartão de "Meu plano", para
          onde a linha leva; só para quem tem acompanhamento (ou quando o
          vínculo não carregou, para a falha não virar silêncio). */}
      {(temNutri || vinculoRes.error) && (
        <LinhaDaConsulta
          // Só as com o nutricionista de agora: as de um vínculo antigo o
          // banco já cancela ao desvincular, e as passadas não são assunto aqui.
          consultas={consultasRes.data.filter((c) => c.nutritionist_id === vinculo?.nutritionist_id)}
          agora={new Date().toISOString()}
          nutriNome={nutriNome}
          falhou={consultasRes.falhou || !!vinculoRes.error}
        />
      )}

      {/* 3. Para hoje */}
      <ParaHoje
        paraHoje={paraHoje}
        uid={uid}
        hoje={today}
        notas={notasNaoLidas}
        nutriNome={nutriNome}
        sessoes={todayPlan}
        completions={todayCompletions}
        aplicacao={
          treatment ? { medicamento: treatment.medication, dose: treatment.dose ?? null } : null
        }
        pendencias={pending.items}
        temNutri={temNutri}
        temTreinoHoje={todayPlan.length > 0}
      />

      {/* 4. Registrar: saiu de dentro do "Hoje", onde era uma fila de pílulas. */}
      <section aria-labelledby="registrar">
        <h2 id="registrar" className="section-title">
          Registrar
        </h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {atalhos.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="btn-ghost min-h-[48px] justify-start px-3.5 text-[15px] font-medium"
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-app-primaria" />
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Seu dia */}
      <section aria-labelledby="seu-dia">
        <div className="relative">
          <h2 id="seu-dia" className="section-title h-7">
            Seu dia
          </h2>
          {!seuDiaFalhou && health.hasData && <ScoreExplicado health={health} />}
        </div>

        {seuDiaFalhou ? (
          // Leitura que falha não é "não tem": sem isto, os anéis diziam "0"
          // de quem comeu e bebeu, e o Score descia junto.
          <p className="card mt-2.5 px-4 py-3.5 text-[15px] text-app-atencao">
            Não deu para carregar os números de hoje.
          </p>
        ) : (
          <div className="card mt-2.5 overflow-hidden p-0">
            <div className="grid grid-cols-3 gap-1.5 px-2.5 py-4">
              <ProgressRing
                pct={calorieGoal ? caloriesToday / calorieGoal : 0}
                centerMain={kcal(caloriesToday)}
                centerSub={calorieGoal ? `/ ${kcal(calorieGoal)}` : "kcal"}
                label="Calorias"
                papel={papel}
                avisoAcima={papel === "limite"}
              />
              <div className="flex flex-col items-center">
                <ProgressRing
                  pct={waterGoal ? waterToday / waterGoal : 0}
                  centerMain={litros(waterToday)}
                  centerSub={`/ ${litros(waterGoal)} L`}
                  label="Água"
                />
                <AdicionarAgua uid={uid} />
              </div>
              <ProgressRing
                pct={proteinGoal ? proteinToday / proteinGoal : 0}
                centerMain={`${Math.round(proteinToday)}`}
                centerSub={proteinGoal ? `/ ${proteinGoal} g` : "g"}
                label="Proteína"
              />
            </div>

            {sugestao && (
              <Link
                href="/app/dieta#plano"
                className="tappable flex items-center gap-3 border-t border-app-linha px-4 py-3.5 hover:bg-app-primaria-fundo"
              >
                <span className="min-w-0 flex-1 text-[15px] text-app-texto">
                  <TextoDaSugestao sugestao={sugestao} />
                </span>
                <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
              </Link>
            )}
            {mostraDica && (
              <p className="border-t border-app-linha px-4 py-3.5 text-[15px] text-app-texto-2">
                {health.topTip}
              </p>
            )}
            {!health.hasData && (
              <p className="border-t border-app-linha px-4 py-3.5 text-[15px] text-app-texto-2">
                Registre uma refeição, a água ou o sono para o Score do dia aparecer.
              </p>
            )}
            {(!calorieGoal || !proteinGoal) && (
              <div className="border-t border-app-linha px-4 py-1.5">
                {/* 44 px de alvo; a linha continua do tamanho do texto. */}
                <Link
                  href="/app/perfil"
                  className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-app-primaria hover:underline"
                >
                  Definir metas
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 6. Progresso */}
      <section aria-labelledby="progresso">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="progresso" className="section-title">
            Progresso
          </h2>
          {/* 44 px de alvo sem empurrar a linha do título: a margem negativa
              devolve o que o min-h acrescenta. */}
          <Link
            href="/app/medidas"
            className="-my-2.5 -mr-1 inline-flex min-h-[44px] items-center px-1 text-[15px] font-semibold text-app-primaria hover:underline"
          >
            Ver medidas
          </Link>
        </div>
        <div className="card mt-2.5 p-4">
          {pesoFalhou ? (
            // Leitura que falha não é "não tem": sem isto, a falha virava o
            // "Registre seu peso" de quem nunca se pesou.
            <p className="text-[15px] text-app-atencao">Não deu para carregar o peso.</p>
          ) : peso30?.atual != null ? (
            <div className="flex flex-col gap-2.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular text-[22px] font-semibold text-app-texto">
                  {numeroFixo(peso30.atual)} kg
                </span>
                {/* A variação é dado (muda a cada pesagem): algarismo tabular,
                    para não "dançar" ao lado do peso. */}
                {peso30.variacao != null && (
                  <span className="text-[15px] text-app-texto-2">
                    <span className="tabular">{textoVariacaoPeso(peso30.variacao)}</span> em 30 dias
                  </span>
                )}
              </p>
              {peso30.pontos.length >= 2 ? (
                <LinhaDoPeso pontos={peso30.pontos} />
              ) : (
                <p className="text-[13px] text-app-texto-2">
                  Registre seu peso algumas vezes para ver a evolução aqui.
                </p>
              )}
            </div>
          ) : pesoAnterior ? (
            <div className="flex flex-col gap-1.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular text-[22px] font-semibold text-app-texto">
                  {numeroFixo(pesoAnterior.peso)} kg
                </span>
                <span className="text-[15px] text-app-texto-2">em {dataCurta(pesoAnterior.data)}</span>
              </p>
              <p className="text-[13px] text-app-texto-2">
                Registre seu peso algumas vezes para ver a evolução aqui.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2 text-center">
              <span className="icon-badge" aria-hidden="true">
                <Scale className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[15px] text-app-texto-2">
                Registre seu peso algumas vezes para ver a evolução aqui.
              </p>
              <Link href="/app/medidas" className="btn-primary mt-3 px-4">
                Registrar peso
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 7. Links. "Próxima aplicação" só quando a dose não é de hoje nem
          está atrasada: nesses casos ela já está no "Para hoje". */}
      <nav aria-label="Mais da Início">
        <ul className="card divide-y divide-app-linha overflow-hidden p-0">
          {treatment && diasAteADose != null && diasAteADose > 0 && (
            <li>
              <Link href="/app/tratamento" className={LINK_DE_LISTA}>
                <span>
                  Próxima aplicação · {diasAteADose === 1 ? "amanhã" : `em ${diasAteADose} dias`}
                </span>
                <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
              </Link>
            </li>
          )}
          <li>
            <Link href="/app/treinos" className={LINK_DE_LISTA}>
              <span>Treinos recentes</span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
            </Link>
          </li>
          <li>
            <Link href="/app/relatorios" className={LINK_DE_LISTA}>
              <span>Relatório para levar à consulta</span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
