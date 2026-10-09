// Supabase de mentira, só para o app renderizar aqui dentro.
// Fala o suficiente de GoTrue (/auth/v1) e PostgREST (/rest/v1) para as telas
// logadas carregarem. Os dados espelham a conta de teste (Maria Souza).
// Isto NÃO entra no repositório: é ferramenta de inspeção visual.
//
// CENARIO escolhe os dados (ver ferramentas/LEIAME.md):
//   (não definido) a conta de teste de hoje, a Maria, para as telas do paciente;
//   carteira       a carteira do nutricionista, para o detalhe do paciente.

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

// ---------- dados ----------
const medidas = [65.8, 66.2, 66.6, 66.9, 67.3, 67.7, 68.0, 68.4].map((w, i) => ({
  id: `m${i}`, user_id: PAC, date: dias(i * 4), weight_kg: w,
  body_fat_pct: 30 + i * 0.2, waist_cm: 78 + i * 0.5, hip_cm: 99.6 + i * 0.3,
  arm_cm: 29, chest_cm: null, thigh_cm: null, neck_cm: null, calf_cm: null,
  notes: null, created_at: dias(i * 4) + "T10:00:00Z",
}));

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
    { id: NUT, full_name: "Ricardo Albuquerque", role: "nutritionist", onboarded: true,
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
};

// ---------- cenário "carteira" ----------
// Cinco pacientes de um nutricionista, um para cada situação que o detalhe do
// paciente precisa mostrar, mais dois convites. As datas saem de `dias(n)`,
// então os alertas valem em qualquer dia em que o mock suba.
//
//   Carlos   dose atrasada (e mais nada)
//   Beatriz  usa 2.200 kcal onde a prescrição diz 1.800, mudou o treino, faltou
//            a um treino, deixou 2 mensagens sem resposta e tem DOIS
//            tratamentos ativos (o antigo com a dose vencida, o novo em dia)
//   Joana    parada há 12 dias, com um exame alterado
//   Pedro    acabou de chegar e nunca registrou nada
//   Luiza    em dia, sem nenhum alerta
function carteira() {
  const id = (n) => `c1a00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const P = { carlos: id(1), beatriz: id(2), joana: id(3), pedro: id(4), luiza: id(5) };
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
        // água já teve baixa e não pode aparecer nem contar.
        prescription_deviations: [
          { id: "dv-be-1", patient_id: uid, field: "daily_calorie_goal", prescribed: "1800",
            current_value: "2200", created_at: em(2, "14:10"), acknowledged_at: null },
          { id: "dv-be-2", patient_id: uid, field: "workout_plan", prescribed: "Treino B — Inferiores",
            current_value: null, created_at: em(1, "09:30"), acknowledged_at: null },
          { id: "dv-be-0", patient_id: uid, field: "daily_water_goal_ml", prescribed: "2500",
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
        body_measurements: medidas(k, uid, [[0, 65.4], [7, 65.6], [14, 66.0], [21, 66.4], [28, 66.8]]),
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

  const nutri = T.profiles.find((p) => p.id === NUT);
  return {
    pacientes: P,
    tabelas: juntar(
      { profiles: [nutri], patient_links: [
        convite(6, "Fernanda Lima", "H4X9QP", 3),
        convite(7, "Marcos Teixeira", "T8N2WD", 1),
      ] },
      carlos(), beatriz(), joana(), pedro(), luiza()
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
      if (alvo.startsWith("rpc/")) return envia(200, { ok: true });
      const linhas = T[alvo] ?? [];
      // HEAD é o que o supabase-js manda em .select(..., { head: true,
      // count: "exact" }) — a contagem vem só no cabeçalho. Sem tratar
      // isto, todo contador do app aparecia zerado AQUI, o que parece bug
      // do app e não é.
      if (req.method !== "GET" && req.method !== "HEAD")
        return envia(201, []);

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
