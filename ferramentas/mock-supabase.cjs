// Supabase de mentira, só para o app renderizar aqui dentro.
// Fala o suficiente de GoTrue (/auth/v1) e PostgREST (/rest/v1) para as telas
// logadas carregarem. Os dados espelham a conta de teste (Maria Souza).
// Isto NÃO entra no repositório: é ferramenta de inspeção visual.

const http = require("http");

const PAC = "af4a1f42-349f-40bd-92d5-b86f133ecbee";
const NUT = "cac02088-df37-4b0d-88f2-c37cf45c5096";
const HOJE = new Date().toISOString().slice(0, 10);
const dias = (n) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

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
};

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
        "access-control-allow-headers": "*",
        "access-control-expose-headers": "content-range",
        ...extra,
      });
      res.end(txt);
    };
    if (req.method === "OPTIONS") return envia(204, null);

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
