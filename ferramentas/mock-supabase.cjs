// Supabase de mentira, só para o app renderizar aqui dentro.
// Fala o suficiente de GoTrue (/auth/v1) e PostgREST (/rest/v1) para as telas
// logadas carregarem. Os dados espelham a conta de teste (Maria Souza).
// Isto NÃO entra no repositório: é ferramenta de inspeção visual.
//
// CENARIO escolhe os dados (ver ferramentas/LEIAME.md):
//   (não definido) a conta de teste de hoje, a Maria, para as telas do paciente;
//   carteira       a carteira do nutricionista, para o detalhe do paciente.
//
// Quase nada é guardado: um POST responde 201 e a leitura seguinte devolve o que
// já havia. As exceções, com estado e com as regras da migração, são as funções
// de consulta (rpcConsulta) e as do registro da consulta (rpcRegistro), e as
// escritas de escrever(): o upsert do perfil (o CRN) e o PATCH/DELETE de
// body_measurements com a RLS do paciente (a medida da consulta não se altera
// nem se apaga, e o banco recusa sem erro). POST
// /__reset volta tudo ao que o cenário subiu; POST /__falhar derruba os GET de
// uma tabela (500) até o próximo /__reset.

const http = require("http");

const PAC = "af4a1f42-349f-40bd-92d5-b86f133ecbee";
const NUT = "cac02088-df37-4b0d-88f2-c37cf45c5096";
// Mesmo fuso que lib/date.ts usa. Com UTC, entre 21h e meia-noite no
// Brasil o mock gerava registros com data de AMANHÃ para o app, e os
// contadores de 7 dias apareciam como "8 de 7" — o que parece bug do app.
const TZ = "America/Sao_Paulo";
const diaDe = (ms) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
const HOJE = diaDe(Date.now());
const dias = (n) => diaDe(Date.now() - n * 86400000);
/**
 * O instante (ISO) de uma hora de São Paulo, `n` dias atrás (negativo: no
 * futuro). O mock usa −03:00 fixo; o app não (lib/consultas.ts).
 */
const naHora = (n, hhmm) => new Date(`${dias(n)}T${hhmm}:00-03:00`).toISOString();
/**
 * Um instante do jeito que o PostgREST devolve um timestamptz: microssegundos e
 * "+00:00" (o ISO do JavaScript tem milissegundos e "Z"). O registro da consulta
 * usa o `updated_at` como trava de concorrência e o app o guarda como TEXTO;
 * com milissegundos o mock não pegaria um app que passasse o valor por `Date`
 * (que corta os microssegundos) e a trava recusaria sem ninguém ter mexido.
 */
const pg = (ms, us = 0) => new Date(ms).toISOString().replace("Z", `${String(us).padStart(3, "0")}+00:00`);
const consulta = (id, nutri, paciente, n, hhmm, extra = {}) => ({
  id, nutritionist_id: nutri, patient_id: paciente, starts_at: naHora(n, hhmm),
  duration_min: 45, kind: "retorno", mode: "presencial", status: "agendada",
  patient_message: null, reschedule_requested_at: null, cancelled_by: null,
  created_at: naHora(Math.max(n, 0) + 10, "12:00"), updated_at: naHora(Math.max(n, 0) + 10, "12:00"),
  ...extra,
});

// ---------- dados ----------
const medidas = [65.8, 66.2, 66.6, 66.9, 67.3, 67.7, 68.0, 68.4].map((w, i) => ({
  id: `m${i}`, user_id: PAC, date: dias(i * 4), weight_kg: w,
  body_fat_pct: 30 + i * 0.2, waist_cm: 78 + i * 0.5, hip_cm: 99.6 + i * 0.3,
  arm_cm: 29, chest_cm: null, thigh_cm: null, neck_cm: null, calf_cm: null,
  notes: null, created_at: dias(i * 4) + "T10:00:00Z",
  // Nulos: medida que o paciente anotou. Preenchidos: a do prontuário.
  measured_by: null, appointment_id: null,
}));
// A de 20 dias atrás cai no dia da consulta realizada da Maria (ap-m1, abaixo):
// é a que o nutri tirou lá. Os números não mudam; só passa a ser do prontuário
// (measured_by) e ligada à consulta, para a página Medidas do paciente mostrar a
// marca "Medida na consulta" e não oferecer o excluir.
Object.assign(medidas[5], { measured_by: NUT, appointment_id: "ap-m1", created_at: naHora(20, "14:50") });

const refeicoesHist = [];
["Café da manhã", "Almoço", "Jantar"].forEach((t, j) => {
  for (let i = 1; i <= 10; i++) {
    refeicoesHist.push({
      id: `r${j}-${i}`, user_id: PAC, date: dias(i), meal_type: t,
      description: ["Ovos mexidos com pão integral", "Frango grelhado, arroz e salada", "Sopa de legumes com frango"][j],
      calories: [320, 580, 430][j], protein_g: [22, 42, 31][j],
      carbs_g: [30, 55, 33][j], fat_g: [11, 16, 13][j],
      created_at: dias(i) + "T12:00:00Z",
    });
  }
});

const treinosHist = ["Treino A — Superiores", "Treino B — Inferiores", "Caminhada no parque"].flatMap(
  (nome, j) => [1, 4, 7].map((d) => ({
    id: `w${j}-${d}`, user_id: PAC, date: dias(d + j), name: nome,
    category: j === 2 ? "Caminhada" : "Musculação", duration_min: 45 + j * 7,
    notes: null, created_at: dias(d + j) + "T20:00:00Z",
  }))
);

const ROT_A = "f9c38326-78dc-4698-aae1-476d5e1c7d0f";
const ROT_B = "c85fdf31-6cdf-46be-9d4d-3d0aa617b49c";
const PLANO = "fb6d9708-ec5c-425e-9e94-cb9f89b997ec";
// Segunda = 0, igual ao app.
const dowHoje = (new Date(HOJE + "T12:00:00").getDay() + 6) % 7;

const T = {
  profiles: [
    { id: PAC, full_name: "Maria Souza (teste)", height_cm: 165, birth_date: "1991-06-12",
      weight_goal_kg: 62, daily_water_goal_ml: 2500, daily_calorie_goal: 1800, protein_goal_g: 110,
      sex: "F", role: "patient", onboarded: true, cpf: null, friend_code: null,
      reminder_enabled: false, reminder_time: null, reminder_tz_offset: 0, last_reminded_on: null,
      created_at: "2026-09-11T02:21:22Z", updated_at: "2026-09-11T12:00:35Z" },
    // Sem CRN de propósito: é o que faz o diálogo de "Concluir registro" pedir o número.
    // `concluir_registro` grava o CRN digitado aqui; `POST /__reset` apaga de novo.
    { id: NUT, full_name: "Ricardo Albuquerque", crn: null, role: "nutritionist", onboarded: true,
      height_cm: null, birth_date: null, weight_goal_kg: null, daily_water_goal_ml: 2500,
      daily_calorie_goal: null, protein_goal_g: 100, sex: "M", cpf: null, friend_code: "1FAA3F",
      reminder_enabled: false, reminder_time: null, reminder_tz_offset: 0, last_reminded_on: null,
      created_at: "2026-07-31T16:03:40Z", updated_at: "2026-09-11T02:05:22Z" },
  ],
  workouts: treinosHist,
  meals: refeicoesHist,
  body_measurements: medidas,
  daily_logs: [
    { id: "d0", user_id: PAC, date: HOJE, water_ml: 1200, sleep_hours: 6.4, steps: 5200,
      mood: "bem", energy: 3, stress: 2, pain: null, notes: null, created_at: HOJE + "T08:00:00Z" },
    ...[1, 2, 3, 4, 5].map((i) => ({
      id: "d" + i, user_id: PAC, date: dias(i), water_ml: 2100 + i * 90, sleep_hours: 7 + (i % 3) * 0.4,
      steps: 6000 + i * 400, mood: "bem", energy: 4, stress: 2, pain: null, notes: null,
      created_at: dias(i) + "T08:00:00Z" })),
  ],
  workout_plan: [
    { id: "p-a", user_id: PAC, day_of_week: 0, sport: "Musculação", title: "Treino A — Superiores",
      notes: null, position: 0, routine_id: ROT_A, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    { id: "p-b", user_id: PAC, day_of_week: 1, sport: "Musculação", title: "Treino B — Inferiores",
      notes: null, position: 0, routine_id: ROT_B, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    { id: "p-c", user_id: PAC, day_of_week: 3, sport: "Musculação", title: "Treino A — Superiores",
      notes: null, position: 0, routine_id: ROT_A, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    { id: "p-d", user_id: PAC, day_of_week: 4, sport: "Musculação", title: "Treino B — Inferiores",
      notes: null, position: 0, routine_id: ROT_B, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    { id: "p-e", user_id: PAC, day_of_week: 5, sport: "Corrida", title: "Corrida leve",
      notes: "30 a 40 minutos em ritmo confortável.", position: 0, routine_id: null,
      prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    // um do próprio paciente, para ver a separação "do nutri" x "meu"
    { id: "p-f", user_id: PAC, day_of_week: dowHoje, sport: "Caminhada", title: "40 min no parque",
      notes: null, position: 1, routine_id: null, prescribed_by: null, created_at: "2026-09-11T02:22:34Z" },
  ],
  treatments: [
    { id: "t1", user_id: PAC, medication: "Ozempic (semaglutida)", dose: "0,5 mg", frequency_days: 7,
      start_date: dias(60), next_dose_date: HOJE, remind_dose: true, dose_reminded_on: null,
      active: true, notes: "Aplicação semanal, terças à noite.", created_at: "2026-09-11T02:22:34Z" },
  ],
  plan_completions: [],
  patient_notes: [
    { id: "n1", nutritionist_id: NUT, patient_id: PAC, author_id: NUT, visibility: "shared",
      body: "Ajustei seu cardápio e montei o treino da semana — dá uma olhada em Meu plano. Hoje é dia de treino; confirma aqui quando for na academia.",
      created_at: dias(1) + "T20:51:57Z", read_at: null },
    { id: "n2", nutritionist_id: NUT, patient_id: PAC, author_id: PAC, visibility: "shared",
      body: "estou me sentindo bem, porém não treinei muito bem",
      created_at: dias(2) + "T02:52:42Z", read_at: dias(1) + "T09:00:00Z" },
    { id: "n3", nutritionist_id: NUT, patient_id: PAC, author_id: NUT, visibility: "shared",
      body: "Como está se sentindo?", created_at: dias(5) + "T12:00:07Z", read_at: dias(4) + "T10:00:00Z" },
  ],
  meal_plans: [
    { id: PLANO, patient_id: PAC, nutritionist_id: NUT, name: "Plano alimentar — fase 1", active: true,
      notes: "Beba água entre as refeições. Se sentir fome fora do horário, use o lanche da tarde adiantado.",
      created_at: "2026-10-06T20:32:31Z", updated_at: "2026-10-06T20:32:31Z" },
  ],
  meal_plan_items: [
    ["Café da manhã", 0, "2 ovos mexidos + 1 fatia de pão integral + 1 banana", 380, 20, 42, 12],
    ["Café da manhã", 1, "Iogurte natural 170 g + 30 g de aveia + 1 fruta", 340, 18, 45, 8],
    ["Almoço", 0, "120 g de frango grelhado + 4 col. de arroz integral + feijão + salada à vontade", 620, 45, 70, 12],
    ["Lanche da tarde", 0, "1 scoop de whey + 1 maçã", 230, 25, 22, 2],
    ["Jantar", 0, "Omelete de 3 ovos com legumes + 1 batata-doce média", 520, 28, 40, 24],
  ].map(([meal_type, position, description, calories, protein_g, carbs_g, fat_g], i) => ({
    id: "i" + i, meal_plan_id: PLANO, user_id: PAC, meal_type, position, description,
    calories, protein_g, carbs_g, fat_g, notes: null,
  })),
  patient_links: [
    { id: "l1", nutritionist_id: NUT, patient_id: PAC, patient_label: null, invite_code: null,
      status: "active", created_at: "2026-09-11T02:22:34Z", accepted_at: "2026-09-11T02:22:34Z" },
  ],
  prescriptions: [
    { id: "pr1", nutritionist_id: NUT, patient_id: PAC, daily_calorie_goal: 1800, protein_goal_g: 110,
      daily_water_goal_ml: 2500, weight_goal_kg: 62, notes: null, created_at: "2026-09-11T12:00:35Z" },
  ],
  routines: [
    { id: ROT_A, user_id: PAC, name: "Treino A — Superiores", notes: "Descanse 60s entre as séries.",
      position: 0, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
    { id: ROT_B, user_id: PAC, name: "Treino B — Inferiores", notes: "Foco em técnica antes de subir a carga.",
      position: 1, prescribed_by: NUT, created_at: "2026-10-06T20:32:31Z" },
  ],
  routine_exercises: [
    [ROT_A, "Supino reto com halteres", 4, 10, 14, 60, 0],
    [ROT_A, "Remada curvada", 4, 10, 20, 60, 1],
    [ROT_A, "Desenvolvimento ombros", 3, 12, 8, 60, 2],
    [ROT_A, "Rosca direta", 3, 12, 10, 45, 3],
    [ROT_B, "Agachamento livre", 4, 10, 30, 90, 0],
    [ROT_B, "Leg press", 4, 12, 80, 75, 1],
    [ROT_B, "Cadeira flexora", 3, 12, 25, 60, 2],
    [ROT_B, "Panturrilha em pé", 4, 15, 40, 45, 3],
  ].map(([routine_id, name, target_sets, target_reps, target_weight_kg, rest_seconds, position], i) => ({
    id: "e" + i, routine_id, user_id: PAC, name, target_sets, target_reps,
    target_weight_kg, rest_seconds, position, notes: null, created_at: "2026-10-06T20:32:31Z",
  })),
  exams: [], dose_logs: [], side_effects: [], nutri_templates: [], push_subscriptions: [],
  // Vazia no cenário de hoje: a Maria nunca mexeu numa meta por conta própria.
  prescription_deviations: [],
  // A Maria teve consulta há 20 dias e tem a próxima daqui a 3.
  appointments: [
    consulta("ap-m1", NUT, PAC, 20, "14:00", { status: "realizada", kind: "primeira", duration_min: 60 }),
    consulta("ap-m2", NUT, PAC, -3, "14:00", { mode: "online" }),
  ],
};

// ---------- cenário "carteira" ----------
// Seis pacientes de um nutricionista, cinco para cada situação que o detalhe do
// paciente precisa mostrar e a sexta para os gráficos, mais dois convites. As
// datas saem de `dias(n)`, então os alertas valem em qualquer dia em que o
// mock suba.
//
//   Carlos   dose atrasada (e mais nada)
//   Beatriz  usa 2.200 kcal onde a prescrição diz 1.800, mudou o treino, faltou
//            a um treino, deixou 2 mensagens sem resposta e tem DOIS
//            tratamentos ativos (o antigo com a dose vencida, o novo em dia)
//   Joana    parada há 12 dias, com um exame alterado
//   Pedro    acabou de chegar e nunca registrou nada
//   Luiza    em dia, sem nenhum alerta
//   Helena   em dia, sem nenhum alerta, com 22 semanas de pesagem e exames com
//            histórico: os dados dos gráficos da aba Corpo e da aba Clínico
function carteira() {
  const id = (n) => `c1a00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const P = { carlos: id(1), beatriz: id(2), joana: id(3), pedro: id(4), luiza: id(5), helena: id(6) };
  const dow = (iso) => (new Date(iso + "T12:00:00").getDay() + 6) % 7;
  /** Um instante de n dias atrás. Nunca use n = 0: a hora pode estar no futuro. */
  const em = (n, hhmm) => `${dias(n)}T${hhmm}:00Z`;
  const juntar = (...tabelas) =>
    tabelas.reduce((acc, t) => {
      for (const [nome, linhas] of Object.entries(t)) (acc[nome] ||= []).push(...linhas);
      return acc;
    }, {});

  const perfil = (uid, nome, sexo, nasc, altura, m, criado) => ({
    id: uid, full_name: nome, height_cm: altura, birth_date: nasc,
    weight_goal_kg: m.peso, daily_water_goal_ml: m.agua, daily_calorie_goal: m.kcal,
    protein_goal_g: m.prot, sex: sexo, role: "patient", onboarded: true, cpf: null,
    friend_code: null, reminder_enabled: false, reminder_time: null, reminder_tz_offset: 0,
    last_reminded_on: null, created_at: em(criado, "12:00"), updated_at: em(criado, "12:00"),
  });
  const prescricao = (k, uid, m, d) => ({
    id: `pr-${k}-${d}`, nutritionist_id: NUT, patient_id: uid, daily_calorie_goal: m.kcal,
    protein_goal_g: m.prot, daily_water_goal_ml: m.agua, weight_goal_kg: m.peso,
    notes: null, created_at: em(d, "12:00"),
  });
  const vinculo = (n, uid, rotulo, quando) => ({
    id: `lk-${n}`, nutritionist_id: NUT, patient_id: uid, patient_label: rotulo,
    invite_code: null, status: "active", created_at: em(quando, "12:00"),
    accepted_at: em(quando, "12:30"),
  });
  const convite = (n, rotulo, codigo, quando) => ({
    id: `lk-${n}`, nutritionist_id: NUT, patient_id: null, patient_label: rotulo,
    invite_code: codigo, status: "pending", created_at: em(quando, "12:00"), accepted_at: null,
  });
  const nota = (n, paciente, autor, corpo, d, hhmm, lida = null, visibility = "shared") => ({
    id: `n-${n}`, nutritionist_id: NUT, patient_id: paciente, author_id: autor,
    visibility, body: corpo, created_at: em(d, hhmm), read_at: lida,
  });

  // Quatro refeições por dia, somando `kcal`/`prot` com uma variação que se
  // anula em 5 dias: a média da semana cai na meta que a gente quer mostrar.
  const TIPOS = ["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"];
  const FATIA = [0.25, 0.35, 0.1, 0.3];
  const HORA = ["11", "15", "19", "23"];
  const PRATOS = [
    ["Ovos mexidos com pão integral", "Iogurte com aveia e fruta", "Tapioca com queijo e café"],
    ["Frango grelhado, arroz e salada", "Carne moída com purê e legumes", "Peixe assado com batata-doce"],
    ["Iogurte com granola", "Maçã com pasta de amendoim", "Sanduíche natural de frango"],
    ["Sopa de legumes com frango", "Omelete com salada", "Macarrão integral com atum"],
  ];
  const variacao = (d) => 1 + (((d * 2) % 5) - 2) * 0.02;
  const refeicoes = (k, uid, quando, kcal, prot) =>
    quando.flatMap((d) =>
      TIPOS.map((tipo, j) => {
        const c = kcal * FATIA[j] * variacao(d);
        return {
          id: `m-${k}-${d}-${j}`, user_id: uid, date: dias(d), meal_type: tipo,
          description: PRATOS[j][d % 3], calories: Math.round(c),
          protein_g: Math.round(prot * FATIA[j] * variacao(d)),
          carbs_g: Math.round((c * 0.5) / 4), fat_g: Math.round((c * 0.28) / 9),
          created_at: `${dias(d)}T${HORA[j]}:00:00Z`,
        };
      })
    );
  const diario = (k, uid, quando, agua, passos) =>
    quando.map((d) => ({
      id: `d-${k}-${d}`, user_id: uid, date: dias(d), water_ml: Math.round(agua * variacao(d)),
      sleep_hours: 6.5 + (d % 3) * 0.5, steps: Math.round(passos * variacao(d)),
      mood: "bem", energy: 3, stress: 2, pain: null, notes: null,
      created_at: `${dias(d)}T11:00:00Z`,
    }));
  const medidas = (k, uid, pontos) =>
    pontos.map(([d, kg], i) => ({
      id: `bm-${k}-${i}`, user_id: uid, date: dias(d), weight_kg: kg,
      body_fat_pct: Number((kg * 0.34).toFixed(1)), waist_cm: Math.round(kg * 1.1),
      hip_cm: Math.round(kg * 1.35), arm_cm: 30, chest_cm: null, thigh_cm: null,
      neck_cm: null, calf_cm: null, notes: null, created_at: `${dias(d)}T11:00:00Z`,
      measured_by: null, appointment_id: null,
    }));
  const exame = (k, n, uid, d, titulo, valor, unidade, ref, status, notas = null) => ({
    id: `ex-${k}-${n}`, user_id: uid, date: dias(d), title: titulo, result_value: valor,
    unit: unidade, reference_range: ref, status, notes: notas, created_at: em(d, "12:00"),
  });
  const aplicacoes = (k, uid, quando, dose) =>
    quando.map((d) => ({
      id: `dl-${k}-${d}`, user_id: uid, date: dias(d), dose, created_at: em(d, "23:00"),
    }));

  // As duas rotinas (A e B) e os exercícios saem dos da Maria, com ids próprios.
  const rotinas = (k, uid) => {
    const a = `rt-${k}-a`, b = `rt-${k}-b`;
    return {
      a, b,
      routines: T.routines.map((r) => ({
        ...r, id: r.id === ROT_A ? a : b, user_id: uid, created_at: em(35, "12:00"),
      })),
      routine_exercises: T.routine_exercises.map((e) => ({
        ...e, id: `${e.id}-${k}`, user_id: uid, routine_id: e.routine_id === ROT_A ? a : b,
      })),
    };
  };
  // O cardápio também: o da Maria, com ids próprios.
  const cardapio = (k, uid, nome, orientacao, d) => ({
    meal_plans: [{
      id: `mp-${k}`, patient_id: uid, nutritionist_id: NUT, name: nome, active: true,
      notes: orientacao, created_at: em(d, "12:00"), updated_at: em(d, "12:00"),
    }],
    meal_plan_items: T.meal_plan_items.map((i) => ({
      ...i, id: `${i.id}-${k}`, meal_plan_id: `mp-${k}`, user_id: uid,
    })),
  });

  // O plano de treino: `d` (0 a 6) diz em qual dia da semana cai a sessão,
  // contando para trás a partir de hoje, e assim a semana de cada paciente
  // fica igual em qualquer dia da semana em que o mock suba. `resposta(o, i)`
  // diz o que o paciente respondeu à sessão i, `o` dias atrás: "done",
  // "skipped" ou nada. Cada "done" vira também um treino no histórico.
  const plano = (k, uid, rot, sessoes, resposta) => {
    const wp = sessoes.map((s, i) => ({
      id: `p-${k}-${i}`, user_id: uid, day_of_week: dow(dias(s.d)), sport: s.sport,
      title: s.title, notes: null, position: 0, routine_id: s.rotina ?? null,
      prescribed_by: NUT, created_at: em(35, "12:00"),
    }));
    const saida = { workout_plan: wp, plan_completions: [], workouts: [], exercises: [] };
    for (let o = 1; o <= 27; o++) {
      wp.forEach((p, i) => {
        if (p.day_of_week !== dow(dias(o))) return;
        const status = resposta(o, i);
        if (!status) return;
        let wid = null;
        if (status === "done") {
          wid = `w-${k}-${o}-${i}`;
          saida.workouts.push({
            id: wid, user_id: uid, date: dias(o), name: p.title, category: p.sport,
            duration_min: p.routine_id ? 55 : 35, notes: "Confirmado pelo plano semanal",
            created_at: `${dias(o)}T22:00:00Z`,
          });
          if (p.routine_id) {
            rot.routine_exercises
              .filter((e) => e.routine_id === p.routine_id)
              .slice(0, 3)
              .forEach((e, pos) => saida.exercises.push({
                id: `ew-${wid}-${pos}`, workout_id: wid, user_id: uid, name: e.name,
                sets: e.target_sets, reps: e.target_reps, weight_kg: e.target_weight_kg,
                position: pos,
              }));
          }
        }
        saida.plan_completions.push({
          id: `pc-${k}-${o}-${i}`, user_id: uid, plan_id: p.id, date: dias(o), status,
          workout_id: wid, created_at: `${dias(o)}T22:00:00Z`,
        });
      });
    }
    return saida;
  };
  const tudoFeito = () => "done";

  const carlos = () => {
    const uid = P.carlos, k = "ca", metas = { kcal: 2000, prot: 130, agua: 3000, peso: 85 };
    const rot = rotinas(k, uid);
    return juntar(
      {
        profiles: [perfil(uid, "Carlos Mendes", "M", "1973-03-18", 178, metas, 90)],
        patient_links: [vinculo(1, uid, null, 80)],
        prescriptions: [prescricao(k, uid, metas, 60)],
        meals: refeicoes(k, uid, [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13], 2050, 128),
        daily_logs: diario(k, uid, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10], 2800, 8200),
        body_measurements: medidas(k, uid, [[0, 92.4], [7, 92.9], [14, 93.3], [21, 93.8], [28, 94.2]]),
        // Um tratamento só, o mais novo, e a dose venceu há 3 dias.
        treatments: [{
          id: "t-ca", user_id: uid, medication: "Mounjaro (tirzepatida)", dose: "5 mg",
          frequency_days: 7, start_date: dias(70), next_dose_date: dias(3), remind_dose: true,
          dose_reminded_on: null, active: true, notes: "Aplicação semanal, às sextas.",
          created_at: em(70, "12:00"),
        }],
        dose_logs: aplicacoes(k, uid, [10, 17, 24, 31, 38], "5 mg"),
        side_effects: [{
          id: "se-ca", user_id: uid, date: dias(9), nausea: 2, appetite: 3, fatigue: 1,
          other: null, notes: "Passou no dia seguinte.", created_at: em(9, "12:00"),
        }],
        exams: [exame(k, 1, uid, 40, "Triglicerídeos", "148", "mg/dL", "< 150", "normal")],
        patient_notes: [
          nota(1, uid, NUT, "Carlos, a dose de sexta passou. Conseguiu aplicar?", 4, "14:00"),
        ],
        routines: rot.routines,
        routine_exercises: rot.routine_exercises,
      },
      plano(k, uid, rot, [
        { d: 1, sport: "Musculação", title: "Treino A — Superiores", rotina: rot.a },
        { d: 3, sport: "Musculação", title: "Treino B — Inferiores", rotina: rot.b },
        { d: 5, sport: "Caminhada", title: "Caminhada de 40 min" },
      ], tudoFeito)
    );
  };

  const beatriz = () => {
    const uid = P.beatriz, k = "be";
    const prescrita = { kcal: 1800, prot: 110, agua: 2500, peso: 65 };
    // O que ela mesma pôs no perfil: só as calorias mudaram.
    const usando = { ...prescrita, kcal: 2200 };
    const rot = rotinas(k, uid);
    return juntar(
      {
        profiles: [perfil(uid, "Beatriz Rocha", "F", "1992-02-07", 165, usando, 75)],
        patient_links: [vinculo(2, uid, null, 70)],
        // Duas prescrições: a de baixo é a antiga, e vale a mais recente.
        prescriptions: [
          prescricao(k, uid, { ...prescrita, kcal: 2000 }, 60),
          prescricao(k, uid, prescrita, 21),
        ],
        // Os avisos: o de caloria e o do plano de treino estão abertos; o de
        // água já teve baixa e não pode aparecer nem contar. Do jeito que os
        // gatilhos do banco gravam: `kind` 'meta' com a coluna no `field`, e
        // `kind` 'plano' com o NOME DA SESSÃO no `field` e no `prescribed`
        // (detect_plan_deviation) e o literal 'removido pelo paciente' quando
        // ela apaga a sessão. Aqui ela apagou um Treino B de outro dia; o da
        // terça continua no plano.
        prescription_deviations: [
          { id: "dv-be-1", patient_id: uid, kind: "meta", field: "daily_calorie_goal", prescribed: "1800",
            current_value: "2200", created_at: em(2, "14:10"), acknowledged_at: null },
          { id: "dv-be-2", patient_id: uid, kind: "plano", field: "Treino B — Inferiores",
            prescribed: "Treino B — Inferiores", current_value: "removido pelo paciente",
            created_at: em(1, "09:30"), acknowledged_at: null },
          { id: "dv-be-0", patient_id: uid, kind: "meta", field: "daily_water_goal_ml", prescribed: "2500",
            current_value: "2000", created_at: em(40, "10:00"), acknowledged_at: em(21, "12:00") },
        ],
        // Come bem acima da meta (2.200 contra 1.800), a proteína é quase a da
        // meta e a água fica bem abaixo: a tabela mostra os dois lados.
        meals: refeicoes(k, uid, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 2200, 105),
        daily_logs: diario(k, uid, [1, 2, 3, 4, 5, 6, 7, 8, 9], 1900, 5600),
        body_measurements: medidas(k, uid, [[1, 69.6], [8, 69.8], [15, 70.1], [22, 70.2], [29, 70.4]]),
        // Dois tratamentos ativos ao mesmo tempo. O mais ANTIGO tem a dose
        // vencida; o mais novo, que é o que vale, está em dia.
        treatments: [
          { id: "t-be-1", user_id: uid, medication: "Saxenda (liraglutida)", dose: "1,8 mg",
            frequency_days: 1, start_date: dias(150), next_dose_date: dias(4), remind_dose: true,
            dose_reminded_on: null, active: true, notes: "Aplicação diária.",
            created_at: em(150, "12:00") },
          { id: "t-be-2", user_id: uid, medication: "Ozempic (semaglutida)", dose: "0,5 mg",
            frequency_days: 7, start_date: dias(40), next_dose_date: dias(-3), remind_dose: true,
            dose_reminded_on: null, active: true, notes: "Aplicação semanal, às terças.",
            created_at: em(40, "12:00") },
        ],
        dose_logs: aplicacoes(k, uid, [4, 11, 18, 25], "0,5 mg"),
        side_effects: [{
          id: "se-be", user_id: uid, date: dias(5), nausea: 1, appetite: 2, fatigue: 2,
          other: null, notes: null, created_at: em(5, "12:00"),
        }],
        exams: [exame(k, 1, uid, 60, "TSH", "2,1", "mUI/L", "0,4 a 4,0", "normal")],
        // Duas mensagens dela sem resposta, depois de uma do nutricionista; e
        // uma nota privada, que só o nutricionista vê.
        patient_notes: [
          nota(2, uid, NUT, "Beatriz, ajustei seu cardápio e as metas. Qualquer dúvida, me chama por aqui.",
            6, "13:00", em(6, "18:00")),
          nota(3, uid, uid, "Oi! Estou com muita fome à noite, então aumentei minha meta de calorias para 2.200. Pode ser?",
            3, "22:30"),
          nota(4, uid, uid, "Também faltei no treino de ontem, o trabalho apertou.", 1, "23:15"),
          nota(5, uid, NUT, "Histórico de fome noturna. Combinar retorno em 15 dias e avaliar mais proteína no jantar.",
            5, "17:00", null, "private"),
        ],
        routines: rot.routines,
        routine_exercises: rot.routine_exercises,
      },
      cardapio(k, uid, "Plano alimentar — fase 1", "Beba água entre as refeições. Se bater fome à noite, deixe a ceia para depois do jantar.", 21),
      // Faltou ao treino de ontem (o = 1) e há 15 dias; deixou sem resposta o
      // de 13 e 20 dias atrás. Na última semana: 3 confirmados e 1 falta.
      plano(k, uid, rot, [
        { d: 1, sport: "Musculação", title: "Treino A — Superiores", rotina: rot.a },
        { d: 3, sport: "Musculação", title: "Treino B — Inferiores", rotina: rot.b },
        { d: 5, sport: "Corrida", title: "Corrida leve" },
        { d: 6, sport: "Musculação", title: "Treino A — Superiores", rotina: rot.a },
      ], (o, i) => (i === 0 && (o === 1 || o === 15) ? "skipped" : i === 3 && (o === 13 || o === 20) ? null : "done"))
    );
  };

  const joana = () => {
    const uid = P.joana, k = "jo", metas = { kcal: 1600, prot: 100, agua: 2200, peso: 58 };
    return {
      profiles: [perfil(uid, "Joana Ferreira", "F", "1985-11-22", 160, metas, 100)],
      patient_links: [vinculo(3, uid, null, 95)],
      prescriptions: [prescricao(k, uid, metas, 90)],
      // O último registro foi há 12 dias.
      meals: refeicoes(k, uid, [12, 13, 15, 16, 18, 20, 22, 24], 1650, 98),
      daily_logs: diario(k, uid, [12, 14, 16], 2100, 4300),
      body_measurements: medidas(k, uid, [[13, 75.2], [27, 76.0], [40, 76.8]]),
      workouts: [12, 16, 19].map((d) => ({
        id: `w-jo-${d}`, user_id: uid, date: dias(d), name: "Caminhada no parque",
        category: "Caminhada", duration_min: 40, notes: null, created_at: `${dias(d)}T21:00:00Z`,
      })),
      // Um alterado nos últimos 180 dias (é o que vira alerta) e um de
      // atenção de antes disso, só para o Clínico mostrar os três status.
      exams: [
        exame(k, 1, uid, 20, "Glicemia de jejum", "118", "mg/dL", "70 a 99", "alterado", "Repetir em 30 dias."),
        exame(k, 2, uid, 20, "Hemoglobina glicada", "5,6", "%", "< 5,7", "normal"),
        exame(k, 3, uid, 210, "Colesterol LDL", "138", "mg/dL", "< 130", "atenção"),
      ],
      patient_notes: [
        nota(6, uid, NUT, "Joana, sumiu! Está tudo bem? Vamos retomar os registros?", 8, "14:00"),
      ],
    };
  };

  const pedro = () => ({
    // Sem metas, sem registro nenhum, sem plano: o paciente de dois dias atrás.
    profiles: [perfil(P.pedro, "Pedro Alves", "M", "1997-05-30", 178,
      { kcal: null, prot: null, agua: null, peso: null }, 2)],
    patient_links: [vinculo(4, P.pedro, null, 2)],
  });

  const luiza = () => {
    const uid = P.luiza, k = "lu", metas = { kcal: 1800, prot: 110, agua: 2500, peso: 62 };
    const rot = rotinas(k, uid);
    return juntar(
      {
        profiles: [perfil(uid, "Luiza Prado", "F", "1989-08-14", 168, metas, 120)],
        patient_links: [vinculo(5, uid, null, 110)],
        prescriptions: [prescricao(k, uid, metas, 100)],
        meals: refeicoes(k, uid, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 1780, 108),
        daily_logs: diario(k, uid, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2450, 9100),
        // Sem ponto há 14 dias: esse dia é o da consulta (ap-3), e a medida do
        // prontuário (66,4 kg) fica sozinha nele. Duas medidas no mesmo dia
        // apareceriam as duas na tabela e no gráfico do Corpo.
        body_measurements: medidas(k, uid, [[0, 65.4], [7, 65.6], [21, 66.4], [28, 66.8]]),
        exams: [exame(k, 1, uid, 35, "Vitamina D", "38", "ng/mL", "30 a 100", "normal")],
        patient_notes: [
          nota(7, uid, uid, "Perdi 1,2 kg neste mês, obrigada pelo cardápio!", 5, "13:00", em(5, "20:00")),
          nota(8, uid, NUT, "Parabéns, Luiza! Vamos manter assim.", 5, "20:00", em(4, "11:00")),
        ],
        routines: rot.routines,
        routine_exercises: rot.routine_exercises,
      },
      cardapio(k, uid, "Manutenção — 1.800 kcal", "Pode trocar o lanche por uma fruta e um punhado de castanhas.", 100),
      plano(k, uid, rot, [
        { d: 2, sport: "Musculação", title: "Treino A — Superiores", rotina: rot.a },
        { d: 4, sport: "Musculação", title: "Treino B — Inferiores", rotina: rot.b },
        { d: 6, sport: "Corrida", title: "Corrida leve" },
      ], tudoFeito)
    );
  };

  // Helena: a paciente dos gráficos das abas Corpo e Clínico. Em dia, sem
  // alerta nenhum, para não mexer na fila que as verificações conferem.
  //
  // Corpo. O vínculo começou há 154 dias (22 semanas), e é dali que o gráfico
  // de peso conta as semanas, de segunda a domingo:
  //  - pesagens de casa de 2 a 4 dias por semana, a média semanal caindo de
  //    74,4 para 70,1 kg (a primeira e a última semana com pesagem fecham
  //    nesses números; as do meio oscilam em volta da reta);
  //  - a 8ª semana sem nenhuma pesagem, e a 2ª consulta cai nela: o ponto da
  //    consulta fora da linha do peso, que o gráfico precisa mostrar;
  //  - seis consultas realizadas, cada uma com peso, cintura e % de gordura
  //    (74,6 / 92 / 34,0 até 70,3 / 85 / 30,4). A primeira é no dia do
  //    vínculo: o peso inicial do anel é o dela, 74,6, e não os 74,4 de casa;
  //  - ontem é a última consulta e também tem pesagem de casa: o ÚNICO dia com
  //    as duas medidas, e o último dia com peso, então o "Peso atual" diz "na
  //    consulta" e mostra a da consulta (70,3) e não a de casa (a diferença
  //    entre as duas é de propósito). Nos outros dias de consulta não há
  //    pesagem de casa;
  //  - cintura e % de gordura de casa em alguns dias (os pontos vazados), todos
  //    entre a primeira e a última consulta: a variação do gráfico (último
  //    menos primeiro) segue sendo a das consultas, −7 cm e −3,6 pontos.
  //  A meta de peso é 66 kg.
  //
  // O que depende do dia da semana em que o mock sobe: no domingo a 1ª semana
  // é só o dia do vínculo (só a consulta, sem pesagem de casa) e na segunda a
  // semana em curso é só hoje (sem pesagem). A 8ª fica sem pesagem em qualquer
  // dia.
  //
  // Exames. Datas a mais de 180 dias, de propósito: o alerta "N exames fora da
  // referência" da fila olha os 180 dias e conta qualquer status que não seja
  // "normal", e triglicerídeos 168 ou LDL 132 são "atencao" de verdade (é o que
  // o app grava). Mais recentes, a Helena entraria na fila com um alerta. São os
  // exames que ela trouxe de antes do vínculo, em três laudos:
  //   300 dias  triglicerídeos 141, LDL 145, vitamina D 18, "Glicose" 101,
  //             colesterol total 200, vitamina B12 310 pg/mL
  //   245 dias  vitamina D 24, "Glicemia de jejum" 98, ferritina 45
  //   192 dias  triglicerídeos 168 (saiu), LDL 132 (mais perto), vitamina D 38
  //             (entrou, com minigráfico), "Glicemia de jejum" 92 (a mesma linha
  //             da Glicose, com minigráfico), colesterol total 190, VLDL-
  //             colesterol 24 (NO MESMO DIA do 190: tem de continuar uma linha
  //             à parte, e não somar ao colesterol total), vitamina B12 235
  //             pmol/L (unidade diferente da anterior)
  // A ferritina tem um resultado só e a data mais antiga das linhas de um
  // resultado só (o VLDL é outra), para continuar por último na tabela.
  const helena = () => {
    const uid = P.helena, k = "he";
    const metas = { kcal: 1700, prot: 105, agua: 2500, peso: 66 };
    const DESDE = 154;
    const SEM_PESAGEM = 8;
    const dowDesde = dow(dias(DESDE));
    /** A semana do gráfico (1 = a do vínculo) em que cai o dia de n dias atrás. */
    const semanaDe = (n) => Math.floor((DESDE - n + dowDesde) / 7) + 1;

    // [dias atrás, peso, cintura, % de gordura]. A 2ª é uma quinta-feira da 8ª
    // semana, qualquer que seja o dia de hoje. As do meio passam de sábado e
    // domingo para a segunda seguinte; a 1ª (o dia do vínculo) e a última (ontem)
    // ficam onde caem, porque o anel e o "Peso atual" dependem desses dois dias.
    const diaUtil = (n) => {
      const d = dow(dias(n));
      return d >= 5 ? n - (7 - d) : n;
    };
    const CONSULTAS = [
      [DESDE, 74.6, 92, 34.0],
      [102 + dowDesde, 73.2, 90.5, 33.0],
      [diaUtil(78), 72.2, 89, 32.3],
      [diaUtil(52), 71.6, 87.5, 31.6],
      [diaUtil(26), 70.9, 86, 31.0],
      [1, 70.3, 85, 30.4],
    ];
    if (semanaDe(CONSULTAS[1][0]) !== SEM_PESAGEM) throw new Error("A 2ª consulta da Helena saiu da semana sem pesagem.");
    const diasDeConsulta = new Set(CONSULTAS.map(([n]) => n));

    // Os dias de pesagem de casa de cada semana: um molde de 2 a 4 dias
    // (segunda = 0), sem a 8ª semana e sem os dias de consulta, menos ontem.
    const MOLDES = [[0, 2, 4], [1, 3, 5], [0, 3], [2, 4, 6], [1, 4], [0, 2, 5, 6], [1, 3, 6], [0, 4]];
    const livre = (n) => !diasDeConsulta.has(n) && semanaDe(n) !== SEM_PESAGEM;
    const porSemana = new Map();
    for (let n = DESDE; n >= 1; n--) {
      const s = semanaDe(n);
      const doMolde = MOLDES[(s * 3) % MOLDES.length].includes(dow(dias(n)));
      if (!(n === 1 || (livre(n) && doMolde))) continue;
      porSemana.set(s, [...(porSemana.get(s) ?? []), n]);
    }
    // Uma consulta tirando um dia de um molde de dois deixaria a semana com uma
    // pesagem só: completa até duas com os dias que sobram da semana.
    porSemana.forEach((ns, s) => {
      for (let n = DESDE; n >= 1 && ns.length < 2; n--) {
        if (semanaDe(n) === s && livre(n) && !ns.includes(n)) ns.push(n);
      }
      ns.sort((a, b) => b - a);
    });
    const semanas = [...porSemana.keys()].sort((a, b) => a - b);
    const primeira = semanas[0], ultima = semanas[semanas.length - 1];
    // Buraco que não seja a 8ª semana é erro do molde, não da Helena.
    for (let s = primeira; s <= ultima; s++) {
      if ((s === SEM_PESAGEM) === porSemana.has(s)) throw new Error(`Semana ${s} da Helena: pesagem onde não devia ou falta onde devia.`);
    }
    /** Em décimos de kg, a reta de 74,4 a 70,1 pelo calendário. */
    const base10 = (s) => Math.round(744 - 43 * ((s - primeira) / (ultima - primeira)));
    // Décimos que se somam a zero na primeira e na última semana com pesagem
    // (a média fecha em 74,4 e 70,1); nas do meio, uma oscilação fixa.
    const RUIDO = [2, -2, 1, -1, 3, -3, 0, 2, -1, 1, -2, 0];
    let giro = 0;
    const casa = [];
    for (const s of semanas) {
      const ns = porSemana.get(s);
      let desvios;
      if (s === primeira || s === ultima) {
        desvios = [1, -2, 1, 0].slice(0, ns.length - 1);
        desvios.push(-desvios.reduce((a, b) => a + b, 0));
      } else {
        desvios = ns.map(() => RUIDO[giro++ % RUIDO.length]);
      }
      const t = (s - primeira) / (ultima - primeira);
      ns.forEach((n, i) => {
        const linha = {
          id: `bm-${k}-${n}`, user_id: uid, date: dias(n), weight_kg: (base10(s) + desvios[i]) / 10,
          body_fat_pct: null, waist_cm: null, hip_cm: null, arm_cm: null, chest_cm: null,
          thigh_cm: null, neck_cm: null, calf_cm: null, notes: null,
          created_at: em(n, "10:30"), measured_by: null, appointment_id: null,
        };
        // Cintura (e, em duas delas, % de gordura de uma balança) de casa no
        // primeiro dia de pesagem de algumas semanas do meio.
        if (i === 0 && [4, 10, 15, 19].includes(s)) {
          linha.waist_cm = Math.round((92 - 7 * t) * 2) / 2;
          if (s === 10 || s === 19) linha.body_fat_pct = Number((34.0 - 3.6 * t + 0.2).toFixed(1));
        }
        casa.push(linha);
      });
    }

    const naConsulta = CONSULTAS.map(([n, peso, cintura, gordura], i) => ({
      id: `bm-${k}-c${i + 1}`, user_id: uid, date: dias(n), weight_kg: peso, body_fat_pct: gordura,
      waist_cm: cintura, hip_cm: null, arm_cm: null, chest_cm: null, thigh_cm: null,
      neck_cm: null, calf_cm: null, notes: null, created_at: naHora(n, "16:40"),
      measured_by: NUT, appointment_id: `ap-h${i + 1}`,
    }));
    const consultas = CONSULTAS.map(([n], i) =>
      consulta(`ap-h${i + 1}`, NUT, uid, n, "16:00", {
        status: "realizada", kind: i === 0 ? "primeira" : "retorno", duration_min: i === 0 ? 60 : 45,
        // A 1ª foi marcada no dia em que o vínculo começou, e não 10 dias antes.
        ...(i === 0 ? { created_at: naHora(n, "10:00"), updated_at: naHora(n, "10:00") } : {}),
      })
    );

    const LAUDO_1 = 300, LAUDO_2 = 245, LAUDO_3 = 192;
    const e = (n, d, ...resto) => exame(k, n, uid, d, ...resto);
    const exames = [
      e(1, LAUDO_1, "Triglicerídeos", "141", "mg/dL", "< 150", "normal"),
      e(2, LAUDO_1, "Colesterol LDL", "145", "mg/dL", "< 130", "atencao"),
      e(3, LAUDO_1, "Vitamina D", "18", "ng/mL", "30 a 100", "alterado"),
      e(4, LAUDO_1, "Glicose", "101", "mg/dL", "70 a 99", "atencao"),
      e(5, LAUDO_1, "Colesterol total", "200", "mg/dL", "< 190", "atencao"),
      e(6, LAUDO_1, "Vitamina B12", "310", "pg/mL", "200 a 900", "normal"),
      e(7, LAUDO_2, "Vitamina D", "24", "ng/mL", "30 a 100", "atencao"),
      e(8, LAUDO_2, "Glicemia de jejum", "98", "mg/dL", "70 a 99", "normal"),
      e(9, LAUDO_2, "Ferritina", "45", "ng/mL", "15 a 150", "normal"),
      e(10, LAUDO_3, "Triglicerídeos", "168", "mg/dL", "< 150", "atencao"),
      e(11, LAUDO_3, "Colesterol LDL", "132", "mg/dL", "< 130", "atencao"),
      e(12, LAUDO_3, "Vitamina D", "38", "ng/mL", "30 a 100", "normal"),
      e(13, LAUDO_3, "Glicemia de jejum", "92", "mg/dL", "70 a 99", "normal"),
      e(14, LAUDO_3, "Colesterol total", "190", "mg/dL", "< 190", "atencao"),
      e(15, LAUDO_3, "VLDL-colesterol", "24", "mg/dL", "< 30", "normal"),
      // Outro laboratório, que dá a B12 em pmol/L: não se compara com os 310 pg/mL.
      e(16, LAUDO_3, "Vitamina B12", "235", "pmol/L", "148 a 664", "atencao"),
    ];

    return juntar({
      profiles: [perfil(uid, "Helena Duarte", "F", "1990-04-09", 164, metas, 160)],
      patient_links: [vinculo(8, uid, null, DESDE)],
      prescriptions: [prescricao(k, uid, metas, 150)],
      meals: refeicoes(k, uid, [1, 2, 3, 4, 5, 6, 7], 1700, 105),
      daily_logs: diario(k, uid, [0, 1, 2, 3, 4, 5, 6], 2400, 8000),
      body_measurements: [...casa, ...naConsulta],
      appointments: consultas,
      exams: exames,
    });
  };

  // Consultas: uma situação por paciente, sem mexer nos alertas que as
  // verificações de ferramentas/ já esperam de cada um.
  //   Luiza    realizada há 14 dias (tem "desde a última consulta"), uma em
  //            andamento agora (começou há 10 min) e a próxima daqui a 2
  //            dias às 10:00; sem alerta
  //   Beatriz  pediu consulta online daqui a 2 dias às 10:15, em cima da da
  //            Luiza (o aviso de choque do "Aceitar") → "Pediu uma consulta"
  //   Carlos   agendada amanhã, pediu para remarcar → alerta de remarcação
  //   Joana    agendada há 5 dias e nunca fechada → "sem desfecho"
  //   Pedro    1ª consulta amanhã; sem alerta
  // Mais algumas no passado, para o mês e a semana terem volume.
  const c = (n, ...resto) => consulta(`ap-${n}`, NUT, ...resto);
  const consultas = [
    c(1, P.luiza, 42, "10:00", { status: "faltou" }),
    c(2, P.luiza, 28, "10:00", { status: "realizada" }),
    c(3, P.luiza, 14, "10:00", { status: "realizada" }),
    c(4, P.luiza, -2, "10:00", { mode: "online" }),
    { ...c(13, P.luiza, 0, "12:00"), starts_at: new Date(Date.now() - 10 * 60000).toISOString(), duration_min: 60 },
    c(5, P.beatriz, 30, "16:30", { status: "realizada", kind: "primeira", duration_min: 60 }),
    c(6, P.beatriz, -2, "10:15", { status: "pedido", mode: "online",
      patient_message: "Pode ser online? Saio tarde do trabalho." }),
    c(7, P.carlos, 21, "09:00", { status: "realizada", kind: "primeira", duration_min: 60 }),
    c(8, P.carlos, -1, "09:00", { reschedule_requested_at: naHora(1, "20:00"),
      patient_message: "Prefiro sexta de manhã, pode ser?" }),
    c(9, P.joana, 35, "10:30", { status: "realizada", kind: "primeira", duration_min: 60 }),
    c(10, P.joana, 5, "10:30"),
    c(11, P.pedro, -1, "11:00", { kind: "primeira", duration_min: 60 }),
    c(12, P.carlos, 7, "15:00", { status: "cancelada", cancelled_by: "paciente" }),
  ];

  // Registros da consulta (prontuário), um por situação. O nutri do mock não
  // tem CRN no perfil, então o concluído já traz o dele na assinatura (foi o
  // que ele digitou ao concluir) e o diálogo de concluir pede o número de novo.
  //   Luiza, a de 14 dias atrás   concluído, com as cinco partes, a medida de
  //                               peso publicada na série e UM adendo
  //   Luiza, a em andamento       sem registro
  //   Joana, sem desfecho         rascunho só com a anamnese
  const consulta3 = consultas.find((x) => x.id === "ap-3");
  const dia3 = diaDe(Date.parse(consulta3.starts_at));
  const conclusao3 = Date.parse(naHora(14, "10:52"));
  const registros = [
    {
      id: "rg-3", appointment_id: consulta3.id, nutritionist_id: NUT, patient_id: P.luiza,
      anamnese: "Retorno de 28 dias. Boa adesão ao cardápio de segunda a sexta; no fim de semana come fora e perde a conta das porções. Dorme 7 horas, intestino regular, sem queixas. Bebe cerca de 2 litros de água por dia.",
      diagnostico: "Perdeu 1,2 kg no mês, dentro do esperado. Adesão alta nos dias úteis e irregular aos sábados e domingos.",
      conduta: "Manter o plano de 1.800 kcal. Levar um lanche pronto nos passeios de fim de semana e reforçar a proteína no café da manhã. Retorno em 15 dias.",
      observar: "Adesão no fim de semana. Testar café da manhã com ovos.",
      medidas: { weight_kg: 66.4 }, measurement_id: "bm-reg-3", status: "concluido",
      concluded_at: pg(conclusao3, 412), assinatura_nome: "Ricardo Albuquerque",
      assinatura_crn: "CRN-3 12345",
      created_at: pg(Date.parse(naHora(14, "10:04")), 218), updated_at: pg(conclusao3, 413),
    },
    {
      id: "rg-10", appointment_id: "ap-10", nutritionist_id: NUT, patient_id: P.joana,
      anamnese: "Retorno depois de 12 dias sem registrar. Conta uma semana corrida no trabalho, almoços fora de casa e pouco sono. Pergunta se pode trocar o lanche da tarde.",
      diagnostico: null, conduta: null, observar: null, medidas: {}, measurement_id: null,
      status: "rascunho", concluded_at: null, assinatura_nome: null, assinatura_crn: null,
      created_at: pg(Date.parse(naHora(5, "10:41")), 530), updated_at: pg(Date.parse(naHora(5, "11:24")), 903),
    },
  ];
  const adendos = [{
    id: "ad-3-1", record_id: "rg-3", author_id: NUT,
    body: "Correção da conduta: o retorno é em 21 dias, e não em 15, porque a paciente viaja na próxima semana.",
    assinatura_nome: "Ricardo Albuquerque", assinatura_crn: "CRN-3 12345",
    created_at: pg(Date.parse(naHora(9, "16:20")), 655),
  }];
  // A linha que o registro publicou na série de medidas da Luiza: do nutri
  // (measured_by), ligada à consulta e com a data do dia dela em São Paulo.
  const medidaDoRegistro = {
    id: "bm-reg-3", user_id: P.luiza, date: dia3, weight_kg: 66.4, body_fat_pct: null,
    waist_cm: null, hip_cm: null, arm_cm: null, chest_cm: null, thigh_cm: null,
    neck_cm: null, calf_cm: null, notes: null, created_at: new Date(conclusao3).toISOString(),
    measured_by: NUT, appointment_id: consulta3.id,
  };

  const nutri = T.profiles.find((p) => p.id === NUT);
  return {
    pacientes: P,
    tabelas: juntar(
      { profiles: [nutri], patient_links: [
        convite(6, "Fernanda Lima", "H4X9QP", 3),
        convite(7, "Marcos Teixeira", "T8N2WD", 1),
      ], appointments: consultas, consultation_records: registros,
      consultation_addenda: adendos, body_measurements: [medidaDoRegistro] },
      carlos(), beatriz(), joana(), pedro(), luiza(), helena()
    ),
  };
}

const CENARIO = process.env.CENARIO || "padrao";
let PACIENTES = {};
if (CENARIO === "carteira") {
  const c = carteira();
  PACIENTES = c.pacientes;
  // Toda tabela do cenário substitui a de hoje, até as vazias: sobra só o que
  // o cenário não toca (modelos do nutri, assinaturas de push).
  for (const nome of Object.keys(T)) if (!["nutri_templates", "push_subscriptions"].includes(nome)) T[nome] = [];
  Object.assign(T, c.tabelas);
} else if (CENARIO !== "padrao") {
  console.error(`CENARIO desconhecido: "${CENARIO}". Use "carteira", ou deixe sem definir.`);
  process.exit(1);
}

// Os registros da consulta existem em qualquer cenário (vazios fora da carteira).
T.consultation_records ||= [];
T.consultation_addenda ||= [];

// As tabelas que as funções mexem, do jeito que o cenário subiu: POST /__reset
// volta a elas, e o roteiro de verificações pode rodar duas vezes seguidas.
// `profiles` está aqui porque concluir_registro grava o CRN no perfil do nutri,
// e `body_measurements` porque publica a medida da consulta.
const TABELAS_COM_ESTADO = [
  "appointments", "consultation_records", "consultation_addenda", "body_measurements", "profiles",
];
const ESTADO_INICIAL = JSON.stringify(Object.fromEntries(TABELAS_COM_ESTADO.map((n) => [n, T[n] ?? []])));

// Tabelas cujo GET devolve 500 até o próximo /__reset (POST /__falhar). As
// leituras de página são do servidor do Next, que o `page.route` do Playwright
// não intercepta; é o único jeito de ver a tela de "não carregou".
const FALHANDO = new Set();

function reiniciar() {
  const inicial = JSON.parse(ESTADO_INICIAL);
  for (const n of TABELAS_COM_ESTADO) T[n] = inicial[n];
  FALHANDO.clear();
}

/**
 * O "agora" no formato de pg(), que sempre anda: nunca devolve o mesmo valor
 * duas vezes, nem com dois salvamentos no mesmo milissegundo (o banco faz o
 * mesmo com `greatest(clock_timestamp(), updated_at + 1µs)`). Os microssegundos
 * nunca são zero de propósito, ver pg().
 */
let relogio = { ms: 0, us: 0 };
let giro = 0;
function agoraPg() {
  const ms = Date.now();
  if (ms > relogio.ms) relogio = { ms, us: 50 + ((++giro * 137) % 900) };
  else if (relogio.us >= 999) relogio = { ms: relogio.ms + 1, us: 50 };
  else relogio = { ms: relogio.ms, us: relogio.us + 1 };
  return pg(relogio.ms, relogio.us);
}

const vinculoAtivo = (nutri, pac) =>
  T.patient_links.some((l) => l.nutritionist_id === nutri && l.patient_id === pac && l.status === "active");

// ---------- funções de consulta (com estado) ----------
// Imitam supabase/migrations/20261013120000_consultas_e_agenda.sql nas regras
// que a tela usa; quem vale é o banco, testado em supabase/testes/.
let seqConsulta = 0;
let seqRegistro = 0;
function rpcConsulta(nome, a, quem) {
  const A = (T.appointments ||= []);
  const agora = Date.now();
  const erro = (m) => ({ ok: false, error: m });
  const ativo = vinculoAtivo;
  const achar = (id) => A.find((x) => x.id === id);
  const iso = (v) => new Date(v).toISOString();
  const toque = (x, campos) => Object.assign(x, campos, { updated_at: new Date().toISOString() });
  const doNutri = (id) => {
    const x = achar(id);
    return x && x.nutritionist_id === quem && ativo(quem, x.patient_id) ? x : null;
  };
  switch (nome) {
    case "marcar_consulta": {
      if (!ativo(quem, a.p_patient)) return erro("Você não acompanha este paciente.");
      if (!a.p_inicio) return erro("Escolha a data e a hora.");
      const x = {
        id: `ap-novo-${++seqConsulta}`, nutritionist_id: quem, patient_id: a.p_patient,
        starts_at: iso(a.p_inicio), duration_min: a.p_duracao ?? 60, kind: a.p_tipo ?? "retorno",
        mode: a.p_modo ?? "presencial", status: "agendada", patient_message: null,
        reschedule_requested_at: null, cancelled_by: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      A.push(x);
      return { ok: true, id: x.id };
    }
    case "remarcar_consulta": {
      const x = doNutri(a.p_id);
      if (!x) return erro("Consulta não encontrada.");
      if (!["pedido", "agendada"].includes(x.status)) return erro("Esta consulta já foi fechada.");
      toque(x, {
        starts_at: a.p_inicio ? iso(a.p_inicio) : x.starts_at,
        duration_min: a.p_duracao ?? x.duration_min, kind: a.p_tipo ?? x.kind, mode: a.p_modo ?? x.mode,
        status: "agendada", reschedule_requested_at: null,
      });
      return { ok: true, id: x.id };
    }
    case "fechar_consulta": {
      if (!["realizada", "faltou", "cancelada"].includes(a.p_desfecho)) return erro("Desfecho inválido.");
      const x = doNutri(a.p_id);
      if (!x) return erro("Consulta não encontrada.");
      if (a.p_desfecho !== "cancelada") {
        if (x.status === "pedido") return erro("Aceite o pedido antes de fechar a consulta.");
        if (x.status === "cancelada")
          return erro("Consulta cancelada não pode virar realizada nem falta. Marque outra.");
        if (Date.parse(x.starts_at) > agora) return erro("A consulta ainda não começou.");
      }
      // As duas recusas do registro (migração do registro da consulta): falta ou
      // cancelamento não pode prender um rascunho que ninguém mais conclui, nem
      // contradizer um prontuário concluído. Realizada continua livre.
      if (a.p_desfecho !== "realizada") {
        const reg = T.consultation_records.find((r) => r.appointment_id === x.id);
        if (reg?.status === "rascunho") return erro("Descarte o rascunho do registro antes.");
        if (reg?.status === "concluido") return erro("Esta consulta tem registro concluído.");
      }
      toque(x, { status: a.p_desfecho, cancelled_by: a.p_desfecho === "cancelada" ? "nutri" : null,
        reschedule_requested_at: null });
      return { ok: true, id: x.id };
    }
    case "pedir_consulta": {
      const l = T.patient_links.find((v) => v.patient_id === quem && v.status === "active");
      if (!l) return erro("Você ainda não tem nutricionista no app.");
      if (!a.p_inicio || Date.parse(a.p_inicio) <= agora) return erro("Escolha um horário no futuro.");
      if (A.some((x) => x.patient_id === quem && x.status === "pedido"))
        return erro("Você já tem um pedido aguardando resposta.");
      const tipo = A.some((x) => x.patient_id === quem && x.status === "realizada") ? "retorno" : "primeira";
      const x = {
        id: `ap-novo-${++seqConsulta}`, nutritionist_id: l.nutritionist_id, patient_id: quem,
        starts_at: iso(a.p_inicio), duration_min: tipo === "primeira" ? 60 : 45, kind: tipo,
        mode: a.p_modo ?? "presencial", status: "pedido",
        patient_message: (a.p_mensagem || "").trim() || null, reschedule_requested_at: null,
        cancelled_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      A.push(x);
      return { ok: true, id: x.id };
    }
    case "pedir_remarcacao": {
      const x = achar(a.p_id);
      if (!x || x.patient_id !== quem) return erro("Consulta não encontrada.");
      if (x.status !== "agendada" || Date.parse(x.starts_at) <= agora)
        return erro("Só dá para pedir remarcação de uma consulta que ainda vai acontecer.");
      if (!(a.p_mensagem || "").trim()) return erro("Diga qual horário fica melhor.");
      toque(x, { reschedule_requested_at: new Date().toISOString(), patient_message: a.p_mensagem.trim() });
      return { ok: true, id: x.id };
    }
    case "cancelar_consulta": {
      const x = achar(a.p_id);
      if (!x || x.patient_id !== quem) return erro("Consulta não encontrada.");
      if (!(x.status === "pedido" || (x.status === "agendada" && Date.parse(x.starts_at) > agora)))
        return erro("Esta consulta não pode mais ser cancelada pelo app.");
      toque(x, { status: "cancelada", cancelled_by: "paciente", reschedule_requested_at: null });
      return { ok: true, id: x.id };
    }
  }
  return null;
}

// ---------- funções do registro da consulta (com estado) ----------
// Imitam supabase/migrations/20261014120100_registro_da_consulta.sql (e as
// faixas de erro_das_medidas) na MESMA ordem de conferências, porque é a ordem
// que decide qual mensagem aparece quando duas recusas valem ao mesmo tempo.
// O mock não é o banco: quem vale é o teste SQL. Aqui basta o que as telas usam.
const MEDIDAS_FAIXAS = [
  ["weight_kg", 20, 400, "Peso", " kg"],
  ["body_fat_pct", 2, 75, "% de gordura", "%"],
  ["waist_cm", 30, 250, "Cintura", " cm"],
  ["hip_cm", 30, 250, "Quadril", " cm"],
  ["chest_cm", 30, 250, "Tórax", " cm"],
  ["arm_cm", 10, 80, "Braço", " cm"],
  ["thigh_cm", 20, 120, "Coxa", " cm"],
  ["calf_cm", 10, 80, "Panturrilha", " cm"],
  ["neck_cm", 10, 80, "Pescoço", " cm"],
];
const chars = (t) => [...t].length; // char_length conta caracteres, não unidades UTF-16

/** erro_das_medidas: nulo = as medidas valem. */
function erroDasMedidas(m) {
  if (m == null) return null;
  if (typeof m !== "object" || Array.isArray(m)) return "Medida desconhecida.";
  if (Object.keys(m).some((k) => !MEDIDAS_FAIXAS.some(([c]) => c === k))) return "Medida desconhecida.";
  for (const [campo, min, max, rotulo, unidade] of MEDIDAS_FAIXAS) {
    const v = m[campo];
    if (v == null) continue;
    if (typeof v !== "number" || v < min || v > max) return `${rotulo} fora da faixa (${min} a ${max}${unidade}).`;
  }
  return null;
}

/** erro_do_registro: os limites de texto e depois as medidas, na ordem da tela. */
function erroDoRegistro(r, medidas) {
  if (r.anamnese != null && chars(r.anamnese) > 20000) return "Texto longo demais em Anamnese.";
  if (r.diagnostico != null && chars(r.diagnostico) > 5000) return "Texto longo demais em Diagnóstico.";
  if (r.conduta != null && chars(r.conduta) > 10000) return "Texto longo demais em Conduta.";
  if (r.observar != null && chars(r.observar) > 2000) return "Texto longo demais em Observar no retorno.";
  return erroDasMedidas(medidas);
}

/** jsonb_strip_nulls no que importa aqui: medida nula é medida não tirada. */
function semNulos(m) {
  if (m == null) return {};
  if (typeof m !== "object" || Array.isArray(m)) return m;
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v != null));
}

// btrim() do Postgres tira só espaços; o trim() do JavaScript tira qualquer branco.
const btrim = (t) => String(t ?? "").replace(/^ +| +$/g, "");

function rpcRegistro(nome, a, quem) {
  if (!["salvar_registro", "concluir_registro", "descartar_rascunho", "adicionar_adendo"].includes(nome))
    return null;
  const R = T.consultation_records;
  const erro = (m) => ({ ok: false, error: m });
  const MUDOU = "O rascunho mudou em outra aba. Recarregue a página.";
  const JA_CONCLUIDO = "O registro já foi concluído. Para corrigir, use um adendo.";

  if (nome === "adicionar_adendo") {
    const r = R.find((x) => x.id === a.p_registro);
    if (!r || r.nutritionist_id !== quem) return erro("Registro não encontrado.");
    if (r.status !== "concluido") return erro("Só registro concluído recebe adendo.");
    const texto = String(a.p_texto ?? "").replace(/^\s+|\s+$/g, "");
    if (texto === "" || chars(texto) > 5000) return erro("Escreva o adendo (até 5.000 caracteres).");
    // O adendo é assinado quando é escrito: nome e CRN do perfil de agora, e, se
    // o perfil não tem, os da conclusão (para não sair sem assinatura).
    const perfil = T.profiles.find((p) => p.id === quem);
    const crn = btrim(perfil?.crn) || null;
    const x = {
      id: `ad-novo-${++seqRegistro}`, record_id: r.id, author_id: quem, body: texto,
      assinatura_nome: perfil?.full_name ?? r.assinatura_nome,
      assinatura_crn: crn ?? r.assinatura_crn, created_at: agoraPg(),
    };
    T.consultation_addenda.push(x);
    return { ok: true, id: x.id };
  }

  // As três funções por consulta começam igual: de quem é a consulta.
  const c = T.appointments.find((x) => x.id === a.p_consulta);
  if (!c || c.nutritionist_id !== quem || !vinculoAtivo(quem, c.patient_id)) return erro("Consulta não encontrada.");
  const reg = R.find((x) => x.appointment_id === c.id);

  if (nome === "descartar_rascunho") {
    // Não confere a situação nem o horário: um rascunho que ficou numa consulta
    // remarcada para a frente também precisa poder sair. Sem rascunho, ok.
    if (!reg) return { ok: true };
    if (reg.status === "concluido") return erro(JA_CONCLUIDO);
    T.consultation_records = R.filter((x) => x !== reg);
    return { ok: true };
  }

  if (["faltou", "cancelada"].includes(c.status)) return erro("Consulta com falta ou cancelada não tem registro.");
  if (c.status === "pedido" || Date.parse(c.starts_at) > Date.now()) return erro("A consulta ainda não começou.");

  if (nome === "salvar_registro") {
    if (reg?.status === "concluido") return erro(JA_CONCLUIDO);
    // O updated_at tem de ser o TEXTO que o mock devolveu, igual byte a byte.
    if (reg && (a.p_visto_em == null || a.p_visto_em !== reg.updated_at)) return erro(MUDOU);
    // Sem rascunho, mas a tela diz que leu um: outra aba o descartou.
    if (!reg && a.p_visto_em != null) return erro(MUDOU);

    const campo = (k) => (a.p_campos?.[k] == null ? null : String(a.p_campos[k]));
    const novo = {
      anamnese: campo("anamnese"), diagnostico: campo("diagnostico"),
      conduta: campo("conduta"), observar: campo("observar"),
    };
    const medidas = semNulos(a.p_campos?.medidas);
    const e = erroDoRegistro(novo, medidas);
    if (e) return erro(e);

    const quando = agoraPg();
    if (!reg) {
      const x = {
        id: `rg-novo-${++seqRegistro}`, appointment_id: c.id, nutritionist_id: c.nutritionist_id,
        patient_id: c.patient_id, ...novo, medidas, measurement_id: null, status: "rascunho",
        concluded_at: null, assinatura_nome: null, assinatura_crn: null,
        created_at: quando, updated_at: quando,
      };
      R.push(x);
      return { ok: true, id: x.id, updated_at: quando };
    }
    Object.assign(reg, novo, { medidas, updated_at: quando });
    return { ok: true, id: reg.id, updated_at: quando };
  }

  // concluir_registro
  if (!reg) {
    // A tela leu um rascunho que outra aba descartou: é concorrência.
    if (a.p_visto_em != null) return erro(MUDOU);
    return erro("Preencha ao menos uma parte do registro.");
  }
  if (reg.status === "concluido") return erro(JA_CONCLUIDO);
  if (a.p_visto_em == null || a.p_visto_em !== reg.updated_at) return erro(MUDOU);

  const e = erroDoRegistro(reg, reg.medidas);
  if (e) return erro(e);
  // Só espaço ou quebra de linha não é parte preenchida.
  const preenchida = [reg.anamnese, reg.diagnostico, reg.conduta, reg.observar].some((t) => t != null && /\S/.test(t));
  if (!preenchida && Object.keys(reg.medidas).length === 0) return erro("Preencha ao menos uma parte do registro.");
  let crn = btrim(a.p_crn) || null;
  if (crn && chars(crn) > 30) return erro("CRN longo demais (até 30 caracteres).");
  const perfil = T.profiles.find((p) => p.id === quem);
  const crnDoPerfil = btrim(perfil?.crn) || null;
  if (!(crn ?? crnDoPerfil)) return erro("Informe o seu CRN para concluir.");

  // Daqui em diante, só escrita.
  if (crn) { if (perfil) perfil.crn = crn; }
  else crn = crnDoPerfil;
  if (c.status === "agendada")
    Object.assign(c, { status: "realizada", reschedule_requested_at: null, updated_at: new Date().toISOString() });
  let medida = null;
  if (Object.keys(reg.medidas).length > 0) {
    medida = {
      id: `bm-reg-novo-${++seqRegistro}`, user_id: c.patient_id,
      // O dia da consulta em São Paulo, nunca toISOString().slice(0, 10): às 22h
      // o dia em UTC já é o de amanhã (a armadilha de fuso do CLAUDE.md).
      date: diaDe(Date.parse(c.starts_at)),
      ...Object.fromEntries(MEDIDAS_FAIXAS.map(([campo]) => [campo, reg.medidas[campo] ?? null])),
      notes: null, created_at: new Date().toISOString(), measured_by: quem, appointment_id: c.id,
    };
    T.body_measurements.push(medida);
  }
  Object.assign(reg, {
    status: "concluido", concluded_at: agoraPg(), measurement_id: medida?.id ?? null,
    assinatura_nome: perfil?.full_name ?? null, assinatura_crn: crn, updated_at: agoraPg(),
  });
  return { ok: true, id: reg.id };
}

// ---------- mini-PostgREST ----------
function valor(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  return v !== "" && !Number.isNaN(n) ? n : v;
}

function aplicaFiltros(linhas, params) {
  let out = linhas;
  for (const [campo, bruto] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(campo)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/s.exec(bruto);
    if (!m) continue;
    const [, negado, op, arg] = m;
    const teste = (linha) => {
      const a = linha[campo];
      switch (op) {
        case "eq": return String(a) === String(valor(arg));
        case "neq": return String(a) !== String(valor(arg));
        case "gt": return a > valor(arg);
        case "gte": return a >= valor(arg);
        case "lt": return a < valor(arg);
        case "lte": return a <= valor(arg);
        case "is": return arg === "null" ? a == null : a === (arg === "true");
        case "in": return arg.replace(/^\(|\)$/g, "").split(",")
          .map((x) => x.replace(/^"|"$/g, "")).includes(String(a));
        case "like": case "ilike":
          return new RegExp("^" + arg.replace(/%/g, ".*") + "$", "i").test(String(a ?? ""));
        default: return true;
      }
    };
    out = out.filter((l) => (negado ? !teste(l) : teste(l)));
  }
  return out;
}

function aplicaOrdem(linhas, params) {
  const ordem = params.filter(([k]) => k === "order").map(([, v]) => v);
  if (!ordem.length) return linhas;
  const regras = ordem.join(",").split(",").map((o) => {
    const [campo, ...resto] = o.split(".");
    return { campo, desc: resto.includes("desc") };
  });
  return [...linhas].sort((x, y) => {
    for (const { campo, desc } of regras) {
      const a = x[campo], b = y[campo];
      if (a === b) continue;
      const r = a == null ? -1 : b == null ? 1 : a < b ? -1 : 1;
      return desc ? -r : r;
    }
    return 0;
  });
}

// Dois usuários: a paciente e o nutricionista. Quem entra depende do
// e-mail enviado no login — qualquer coisa com "nutri" cai no profissional.
// Serve para inspecionar os DOIS lados do produto sem trocar nada de lugar.
function usuario(id) {
  const ehNutri = id === NUT;
  return {
    id, aud: "authenticated", role: "authenticated",
    email: ehNutri ? "nutri.teste@exemplo.com" : "maria.teste@exemplo.com",
    email_confirmed_at: "2026-09-11T02:21:22Z", phone: "",
    confirmed_at: "2026-09-11T02:21:22Z", last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: ehNutri ? "Ricardo Albuquerque" : "Maria Souza (teste)" },
    identities: [], created_at: "2026-09-11T02:21:22Z",
    updated_at: new Date().toISOString(), is_anonymous: false,
  };
}

function jwt(id) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: id, role: "authenticated", aud: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000),
          email: usuario(id).email, session_id: "sessao-falsa" }),
    "assinatura-irrelevante-neste-mock",
  ].join(".");
}

/** Lê o `sub` do Bearer para saber quem está pedindo. */
function quemPede(req) {
  const h = req.headers["authorization"] || "";
  const t = h.replace(/^Bearer\s+/i, "").split(".")[1];
  if (!t) return PAC;
  try {
    const c = JSON.parse(Buffer.from(t, "base64url").toString());
    return c.sub === NUT ? NUT : PAC;
  } catch {
    return PAC;
  }
}

const sessao = (id) => ({
  access_token: jwt(id), token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "refresh-falso", user: usuario(id),
});

/**
 * Escritas pelo PostgREST. Quase toda tabela só aceita e não guarda (201, vazio);
 * estas duas guardam, com a regra do banco, e o /__reset desfaz:
 *
 *  - body_measurements, PATCH e DELETE: a RLS do paciente (migração
 *    20261014120000) só deixa mexer na linha DELE com `measured_by` nulo. Quando
 *    a política esconde a linha, o banco NÃO dá erro: afeta zero linhas, e o
 *    supabase-js devolve `{ error: null, count: 0 }`. É esse silêncio que o app
 *    tem de tratar (Medidas) ou evitar (assistente), e o mock o reproduz. Com
 *    `Prefer: count=exact` o total vai no Content-Range, como no PostgREST.
 *  - profiles, POST (o upsert da página Perfil): grava no perfil de quem pede,
 *    com o check do CRN (até 30 caracteres), para o CRN salvo reaparecer.
 */
function escrever(tabela, metodo, params, corpo, quem, prefer) {
  const vazio = { status: 201, dados: [], cabecalhos: {} };
  let dados = null;
  try { dados = corpo ? JSON.parse(corpo) : null; } catch {}
  const representacao = prefer.includes("return=representation");
  const contagem = (n) => (prefer.includes("count=") ? { "content-range": `*/${n}` } : {});

  if (tabela === "profiles" && metodo === "POST") {
    const novos = (Array.isArray(dados) ? dados : [dados]).filter((x) => x && typeof x === "object");
    if (novos.some((n) => n.id !== quem))
      return { status: 403, dados: { code: "42501", message: 'new row violates row-level security policy for table "profiles"' }, cabecalhos: {} };
    if (novos.some((n) => typeof n.crn === "string" && n.crn.length > 30))
      return { status: 400, dados: { code: "23514", message: 'new row for relation "profiles" violates check constraint "profiles_crn_check"' }, cabecalhos: {} };
    const gravados = novos.map((n) => {
      let linha = T.profiles.find((p) => p.id === n.id);
      if (linha) Object.assign(linha, n);
      else T.profiles.push((linha = { ...n }));
      return linha;
    });
    return { status: 201, dados: representacao ? gravados : [], cabecalhos: {} };
  }

  if (tabela === "body_measurements" && (metodo === "PATCH" || metodo === "DELETE")) {
    // O que a política de update/delete deixa o paciente enxergar.
    const visiveis = aplicaFiltros(T.body_measurements, params)
      .filter((l) => l.user_id === quem && l.measured_by == null);
    if (metodo === "PATCH") {
      // O with check do update: continua sendo linha dele, sem assinatura de nutri nem consulta.
      const depois = visiveis.map((l) => ({ ...l, ...dados }));
      if (depois.some((l) => l.user_id !== quem || l.measured_by != null || l.appointment_id != null))
        return { status: 403, dados: { code: "42501", message: 'new row violates row-level security policy for table "body_measurements"' }, cabecalhos: {} };
      visiveis.forEach((l, i) => Object.assign(l, depois[i]));
      if (representacao) return { status: 200, dados: visiveis, cabecalhos: contagem(visiveis.length) };
    } else {
      T.body_measurements = T.body_measurements.filter((l) => !visiveis.includes(l));
      if (representacao) return { status: 200, dados: visiveis, cabecalhos: contagem(visiveis.length) };
    }
    return { status: 204, dados: null, cabecalhos: contagem(visiveis.length) };
  }

  return vazio;
}

const srv = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const params = [...url.searchParams.entries()];
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const envia = (status, dados, extra = {}) => {
      const txt = dados === null ? "" : JSON.stringify(dados);
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        // `*` não cobre `Authorization` (o navegador exige o nome por extenso),
        // então devolve o que o pré-voo pediu.
        "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
        // Sem isto o navegador recusa PATCH e DELETE no pré-voo (só GET, HEAD
        // e POST passam sem ser listados), e o app, que marca a conversa como
        // lida com PATCH, enchia o console de erro de CORS.
        "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "access-control-expose-headers": "content-range",
        ...extra,
      });
      res.end(txt);
    };
    if (req.method === "OPTIONS") return envia(204, null);

    // Não é do Supabase: diz aos scripts de ferramentas/ qual cenário subiu e
    // quem é quem, para eles não repetirem os ids.
    if (url.pathname === "/__cenario")
      return envia(200, { cenario: CENARIO, nutri: NUT, pacientes: PACIENTES });
    if (url.pathname === "/__reset") {
      reiniciar();
      return envia(200, { ok: true });
    }
    // { "tabela": "consultation_records" }: os GET nessa tabela passam a dar 500
    // até o próximo /__reset. Serve para ver a tela de "não carregou".
    if (url.pathname === "/__falhar") {
      let tabela = "";
      try { tabela = String(JSON.parse(corpo || "{}").tabela || ""); } catch {}
      if (req.method !== "POST" || !tabela) return envia(400, { error: 'POST com { "tabela": "<nome>" }' });
      FALHANDO.add(tabela);
      return envia(200, { ok: true, falhando: [...FALHANDO] });
    }

    // --- GoTrue ---
    if (url.pathname.startsWith("/auth/v1/")) {
      const p = url.pathname.replace("/auth/v1/", "");
      if (p === "user") return envia(200, usuario(quemPede(req)));
      if (p === "token" || p === "signup") {
        let email = "";
        try { email = String(JSON.parse(corpo || "{}").email || ""); } catch {}
        return envia(200, sessao(/nutri/i.test(email) ? NUT : PAC));
      }
      if (p === "logout") return envia(204, null);
      return envia(200, {});
    }

    // --- PostgREST ---
    if (url.pathname.startsWith("/rest/v1/")) {
      const alvo = url.pathname.replace("/rest/v1/", "");
      if (alvo.startsWith("rpc/")) {
        let args = {};
        try { args = JSON.parse(corpo || "{}"); } catch {}
        const quem = quemPede(req);
        const r = rpcConsulta(alvo.slice(4), args, quem) ?? rpcRegistro(alvo.slice(4), args, quem);
        return envia(200, r ?? { ok: true });
      }
      if (FALHANDO.has(alvo) && (req.method === "GET" || req.method === "HEAD"))
        return envia(500, { code: "XX000", message: `falha sob encomenda em ${alvo} (POST /__falhar)`, details: null, hint: null });
      const linhas = T[alvo] ?? [];
      // HEAD é o que o supabase-js manda em .select(..., { head: true,
      // count: "exact" }) — a contagem vem só no cabeçalho. Sem tratar
      // isto, todo contador do app aparecia zerado AQUI, o que parece bug
      // do app e não é.
      if (req.method !== "GET" && req.method !== "HEAD") {
        const r = escrever(alvo, req.method, params, corpo, quemPede(req), req.headers["prefer"] || "");
        return envia(r.status, r.dados, r.cabecalhos);
      }

      let out = aplicaOrdem(aplicaFiltros(linhas, params), params);
      const total = out.length;
      const limite = url.searchParams.get("limit");
      if (limite) out = out.slice(0, Number(limite));

      const prefer = req.headers["prefer"] || "";
      const cabecalhos = prefer.includes("count=")
        ? { "content-range": `0-${Math.max(total - 1, 0)}/${total}` }
        : {};
      if (req.method === "HEAD") return envia(200, null, cabecalhos);
      // .single() / .maybeSingle() pedem objeto, não lista
      if ((req.headers["accept"] || "").includes("vnd.pgrst.object")) {
        if (!out.length) return envia(406, { code: "PGRST116", message: "0 rows" }, cabecalhos);
        return envia(200, out[0], cabecalhos);
      }
      return envia(200, out, cabecalhos);
    }

    envia(404, { message: "rota não simulada: " + url.pathname });
  });
});

srv.listen(54321, () => console.log("Supabase de mentira em http://localhost:54321"));
