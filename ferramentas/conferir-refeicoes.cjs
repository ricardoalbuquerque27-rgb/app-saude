// Verificações dos lembretes das refeições, como a Maria do cenário padrão, em
// 390 px (spec docs/superpowers/specs/2026-10-27-lembretes-das-refeicoes-design.md).
// A notificação em si não aparece no navegador de teste; o que dá para ver
// daqui é o que ela usa: a rota que os botões chamam, o login que volta para a
// refeição, o recado do service worker ao app, o bloco do Perfil e os botões
// da Dieta e de Meu plano. Acusa com código de saída 1.
//
// Etapas (SO=regex roda só as que casam): rota, login, recado, perfil, botoes,
// inicio.
//
// Precisa do mock SEM cenário (`node ferramentas/mock-supabase.cjs`) e do dev
// no ar (ver LEIAME.md), sem NEXT_PUBLIC_VAPID_PUBLIC_KEY no .env.local (o push
// desligado é o estado que se confere no Perfil). O mock volta ao início antes
// e depois (POST /__reset), e cada `/__falhar` passa por `comFalha`, que o
// desfaz num `finally`.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const OUT = process.env.OUT || path.join(os.tmpdir(), "conferir-refeicoes");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TZ = "America/Sao_Paulo";
const hojeSP = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// A aritmética de data escrita de novo, à mão (ao meio-dia UTC): se o app e o
// roteiro errassem juntos, seria a mesma conta.
const somaDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const DIAS_CURTOS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const rotuloDoDia = (iso, hoje) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${iso === hoje ? "Hoje, " : ""}${DIAS_CURTOS[new Date(iso + "T12:00:00Z").getUTCDay()]} ${d}/${m}`;
};

const resultados = [];
function ok(passou, msg, detalhe = "") {
  resultados.push(!!passou);
  console.log(`  ${passou ? "OK   " : "FALHA"}  ${msg}`);
  if (!passou && detalhe) console.log(`         ${detalhe}`);
}
const SO = process.env.SO ? new RegExp(process.env.SO, "i") : null;
/** Uma etapa que lança (elemento que não existe, timeout) vira FALHA, e o roteiro segue. */
async function etapa(nome, fn) {
  if (SO && !SO.test(nome)) return;
  console.log(`\n[${nome}]`);
  try {
    await fn();
  } catch (e) {
    ok(false, `${nome}: a etapa não terminou`, String(e && e.message ? e.message : e).split("\n")[0]);
  }
}
const reset = () => fetch(MOCK + "/__reset", { method: "POST" });
/** Roda `fn` com os GET de `tabela` dando 500 (ou só as escritas) e SEMPRE volta o mock depois. */
async function comFalha(tabela, fn, extra = {}) {
  await fetch(MOCK + "/__falhar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabela, ...extra }),
  });
  try {
    return await fn();
  } finally {
    await reset();
  }
}
const tabela = async (nome) => (await (await fetch(`${MOCK}/__tabela?nome=${encodeURIComponent(nome)}`)).json()) || [];

async function entrar(ctx, email = "maria.teste@exemplo.com") {
  const p = await ctx.newPage();
  // O login espera a compilação da Início no dev (lenta na primeira vez).
  p.setDefaultTimeout(90000);
  for (let t = 1; ; t++) {
    await p.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.fill('input[type="email"]', email);
    await p.fill('input[type="password"]', "senha-de-mentira");
    await p.click('button[type="submit"]');
    try {
      await p.waitForURL("**/app", { timeout: 60000 });
      break;
    } catch (e) {
      if (t >= 3) throw e;
    }
  }
  p.setDefaultTimeout(8000);
  return p;
}

const contexto = (b) =>
  b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });

(async () => {
  const cen = await (await fetch(MOCK + "/__cenario")).json().catch(() => null);
  if (!cen || cen.cenario !== "padrao") {
    console.error(`O mock precisa subir sem CENARIO (veio: ${cen && cen.cenario}).`);
    process.exit(2);
  }
  await reset();

  const hoje = hojeSP();
  const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await contexto(b);
  const p = await entrar(ctx);
  const marcar = (corpo, tipo = "application/json") =>
    p.request.post(APP + "/api/refeicoes/marcar", {
      headers: { "content-type": tipo },
      data: tipo === "application/json" ? JSON.stringify(corpo) : String(corpo),
    });

  await etapa("rota", async () => {
    await reset();
    let r = await marcar("data=hoje", "text/plain");
    ok(r.status() === 415, "sem JSON: 415", `veio ${r.status()}`);

    const semSessao = await contexto(b);
    r = await semSessao.request.post(APP + "/api/refeicoes/marcar", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ data: hoje, refeicao: "Almoço", resposta: "comi" }),
    });
    ok(r.status() === 401, "sem sessão: 401", `veio ${r.status()}`);
    await semSessao.close();

    r = await marcar({ data: "x", refeicao: "Almoço", resposta: "comi" });
    ok(r.status() === 400, "pedido inválido: 400", `veio ${r.status()}`);

    r = await marcar({ data: hoje, refeicao: "Almoço", resposta: "comi" });
    ok(r.status() === 200, "comi no almoço: 200", `veio ${r.status()} ${(await r.text()).slice(0, 200)}`);
    let checks = await tabela("meal_checks");
    const meals = await tabela("meals");
    const resp = checks.find((c) => c.date === hoje && c.meal_type === "Almoço");
    const ligada = resp && meals.find((m) => m.id === resp.meal_id);
    ok(resp && resp.status === "done", "a resposta ficou done", JSON.stringify(resp));
    ok(ligada && ligada.date === hoje && ligada.meal_type === "Almoço", "e ligada a uma refeição nova do almoço de hoje", JSON.stringify(ligada));

    r = await marcar({ data: hoje, refeicao: "Almoço", resposta: "desfazer" });
    ok(r.status() === 200, "desfazer: 200", `veio ${r.status()}`);
    checks = await tabela("meal_checks");
    ok(!checks.some((c) => c.date === hoje && c.meal_type === "Almoço"), "desfazer apaga a resposta");
    ok(!(await tabela("meals")).some((m) => ligada && m.id === ligada.id), "e a refeição ligada");

    r = await marcar({ data: somaDias(hoje, -8), refeicao: "Almoço", resposta: "comi" });
    const corpo = await r.json().catch(() => ({}));
    ok(r.status() === 400 && corpo.error === "Essa refeição é de mais de 7 dias.", "8 dias atrás: 400 com a frase da spec", `${r.status()} ${JSON.stringify(corpo)}`);

    r = await marcar({ data: hoje, refeicao: "Ceia", resposta: "comi" });
    ok(r.status() === 400, "refeição fora do cardápio: 400", `veio ${r.status()}`);

    await comFalha("meal_checks", async () => {
      const f = await marcar({ data: hoje, refeicao: "Almoço", resposta: "comi" });
      ok(f.status() === 500, "a resposta que não grava: 500", `veio ${f.status()}`);
      ok(!(await tabela("meals")).some((m) => m.date === hoje && m.meal_type === "Almoço"), "e a refeição criada sai junto");
    }, { escrita: true });
  });

  await etapa("login", async () => {
    // Sem sessão, a refeição da notificação passa pelo login e volta, com a âncora.
    const ontem = somaDias(hoje, -1);
    const c = await contexto(b);
    const q = await c.newPage();
    q.setDefaultTimeout(90000);
    await q.goto(`${APP}/app/dieta?data=${ontem}#refeicao-almoco`, { waitUntil: "networkidle", timeout: 120000 });
    const noLogin = new URL(q.url());
    ok(noLogin.pathname === "/login" && noLogin.searchParams.get("volta") === `/app/dieta?data=${ontem}`,
      "sem sessão, vai ao /login com o volta da refeição", q.url());
    await q.waitForTimeout(1200);
    await q.fill('input[type="email"]', "maria.teste@exemplo.com");
    await q.fill('input[type="password"]', "senha-de-mentira");
    await q.click('button[type="submit"]');
    await q.waitForURL("**/app/dieta**", { timeout: 60000 });
    const depois = new URL(q.url());
    ok(depois.pathname === "/app/dieta" && depois.searchParams.get("data") === ontem && depois.hash === "#refeicao-almoco",
      "depois de entrar, volta à refeição com a data e a âncora", q.url());
    // Já com sessão, o /login com volta vai direto, e o volta de fora do app não.
    await q.goto(`${APP}/login?volta=${encodeURIComponent("/app/nutricionista?aba=cardapio")}`, { waitUntil: "networkidle", timeout: 120000 });
    ok(new URL(q.url()).pathname === "/app/nutricionista", "com sessão, o /login com volta vai ao volta", q.url());
    await q.goto(`${APP}/login?volta=${encodeURIComponent("https://outro.site/app")}`, { waitUntil: "networkidle", timeout: 120000 });
    ok(new URL(q.url()).origin === new URL(APP).origin && new URL(q.url()).pathname === "/app", "volta de fora do app vai à Início", q.url());
    await c.close();
  });

  await etapa("recado", async () => {
    // O recado que o service worker manda ao app aberto, despachado à mão em
    // navigator.serviceWorker (o navegador de teste não mostra notificação).
    const ontem = somaDias(hoje, -1);
    const anteontem = somaDias(hoje, -2);
    const recado = (dados) =>
      p.evaluate((d) => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: d })), dados);
    await p.goto(APP + "/app", { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(800);
    await recado({ tipo: "abrir", url: `/app/dieta?data=${ontem}#refeicao-almoco` });
    await p.waitForURL("**/app/dieta**", { timeout: 60000 });
    let u = new URL(p.url());
    ok(u.pathname === "/app/dieta" && u.searchParams.get("data") === ontem && u.hash === "#refeicao-almoco",
      "da Início, o recado leva à refeição", p.url());

    // Já na Dieta, outro dia: a página recarrega (o marcador posto em window some).
    await p.waitForTimeout(800);
    await p.evaluate(() => { window.__marcador = 1; });
    await recado({ tipo: "abrir", url: `/app/dieta?data=${anteontem}#refeicao-jantar` });
    await p.waitForURL((x) => x.searchParams.get("data") === anteontem, { timeout: 60000 });
    await p.waitForLoadState("networkidle");
    u = new URL(p.url());
    ok(u.searchParams.get("data") === anteontem && u.hash === "#refeicao-jantar", "na Dieta, o recado troca o dia", p.url());
    ok((await p.evaluate(() => window.__marcador)) === undefined, "e a página recarregou");

    // Recado de fora do app, ou de outro tipo, não sai da página.
    const antes = p.url();
    await recado({ tipo: "abrir", url: "https://outro.site/app" });
    await recado({ tipo: "outro", url: "/app" });
    await p.waitForTimeout(1500);
    ok(p.url() === antes, "recado de fora do app, ou de outro tipo, não sai da página", p.url());
  });

  await etapa("perfil", async () => {
    // O dev do mock sobe sem NEXT_PUBLIC_VAPID_PUBLIC_KEY: o push desligado no
    // app inteiro, e os dois blocos dizem que os lembretes chegam em breve.
    await p.goto(APP + "/app/perfil", { waitUntil: "networkidle", timeout: 120000 });
    const bloco = p.locator("section", { has: p.getByRole("heading", { name: "Lembretes das refeições" }) });
    await bloco.waitFor({ timeout: 60000 });
    ok(await bloco.getByText("Os lembretes das refeições chegam em breve.", { exact: true }).isVisible(),
      "o bloco das refeições diz que chegam em breve");
    ok((await bloco.getByRole("switch").count()) === 0 && (await bloco.locator('input[type="time"]').count()) === 0,
      "sem chave nem horário no bloco das refeições");
    ok(await p.getByText("Os lembretes chegam em breve.", { exact: true }).isVisible(), "o lembrete diário também");
    ok((await p.getByRole("switch", { name: "Lembrete diário" }).count()) === 0, "sem a chave do lembrete diário");
    const lateral = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(lateral <= 0, "sem rolagem lateral em 390 px", `${lateral} px a mais`);
    await p.screenshot({ path: `${OUT}/perfil-390.png`, fullPage: true });
  });

  await b.close();
  await reset();
  const falhas = resultados.filter((r) => !r).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await reset().catch(() => {});
  process.exit(1);
});
