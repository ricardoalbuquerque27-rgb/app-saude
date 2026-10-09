// Requer: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
// (ver ferramentas/LEIAME.md), o dev no ar e o mock com CENARIO=carteira.
//
// Entra como nutricionista e faz duas coisas com o detalhe do paciente:
//   1. tira os prints: paciente x celular/computador x claro/escuro, e avisa se
//      alguma página transborda a largura da janela;
//   2. confere na tela o que só a tela mostra: cada verificação ACUSA (sai com
//      código 1) em vez de só escrever no terminal.
//
// Sem OUT, os PNGs vão para uma pasta "prints-nutri" no diretório temporário
// do sistema.
//
// Larguras: celular 390 px; computador 1440 px, que é onde as duas colunas
// existem (começam em `xl`, 1280 px); e 1100 px, uma coluna só.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

// Sem OUT, numa pasta temporária: o padrão antigo (".") despejava uns 27 PNGs
// na raiz do repositório.
const OUT = process.env.OUT || path.join(os.tmpdir(), "prints-nutri");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SECOES = ["alimentacao", "treino", "corpo", "clinico", "conversa", "notas"];
const TZ = "America/Sao_Paulo";

const CELULAR = { nome: "mobile", w: 390, h: 844, mobile: true, escala: 2 };
const COMPUTADOR = { nome: "desktop", w: 1440, h: 900, mobile: false, escala: 1 };
const ESTREITO = { nome: "1100", w: 1100, h: 900, mobile: false, escala: 1 };

// ---------- o que o script acusa ----------
const resultados = [];
function ok(passou, msg, detalhe = "") {
  resultados.push({ passou, msg });
  console.log(`  ${passou ? "OK   " : "FALHA"}  ${msg}`);
  if (!passou && detalhe) console.log(`         ${detalhe}`);
}
// Erros de console e de rede de todas as páginas. O mock aceitava só GET,
// HEAD e POST no CORS, e o PATCH que marca a conversa como lida enchia o
// console de erro sem nenhuma tela quebrar.
const errosDeConsole = [];
let etapa = "prints";
function espiar(page) {
  page.on("console", (m) => {
    if (m.type() === "error") errosDeConsole.push(`[${etapa}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errosDeConsole.push(`[${etapa}] pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const erro = r.failure()?.errorText;
    // O Next cancela por conta própria a busca de uma página que perdeu a vez
    // (o Voltar do aparelho, um router.refresh() seguinte). Não é falha.
    if (erro === "net::ERR_ABORTED" && r.method() === "GET" && r.url().includes("_rsc=")) return;
    errosDeConsole.push(`[${etapa}] requestfailed: ${r.method()} ${r.url()} ${erro}`);
  });
}

// ---------- apoio ----------
/** O dia, no fuso do Brasil, de n dias atrás (negativo = no futuro), em DD/MM/AAAA. */
function diaBR(n) {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() - n * 86400000)).split("-");
  return `${d}/${m}/${a}`;
}

async function contexto(browser, disp, escuro, estado) {
  return browser.newContext({
    viewport: { width: disp.w, height: disp.h },
    deviceScaleFactor: disp.escala,
    isMobile: disp.mobile,
    hasTouch: disp.mobile,
    colorScheme: escuro ? "dark" : "light",
    locale: "pt-BR",
    storageState: estado,
  });
}

/** Login uma vez só; os contextos seguintes reaproveitam os cookies. */
async function entrar(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  for (let tentativa = 1; ; tentativa++) {
    await page.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
    // Sem esperar a hidratação o clique cai antes do onSubmit do React e o
    // formulário faz submit nativo (ver tirar-prints.cjs).
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', "nutri.teste@exemplo.com"); // "nutri" => o mock entra como nutricionista
    await page.fill('input[type="password"]', "senha-de-mentira");
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL("**/app", { timeout: 60000 });
      break;
    } catch (e) {
      if (tentativa >= 2) throw e;
    }
  }
  const estado = await ctx.storageState();
  await ctx.close();
  return estado;
}

/** Abre uma rota do paciente e espera as seis seções streamarem. */
async function abrir(ctx, caminho, { secoes = true } = {}) {
  const page = await ctx.newPage();
  espiar(page);
  await page.goto(APP + caminho, { waitUntil: "load", timeout: 120000 });
  if (secoes) {
    for (const s of SECOES) await page.waitForSelector(`#${s}`, { state: "attached", timeout: 60000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Espera o elemento aparecer E hidratar: clicar antes disso não faz nada. */
async function pronto(loc) {
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.evaluate(
    (el) =>
      new Promise((resolve) => {
        const inicio = Date.now();
        (function esperar() {
          const hidratou = Object.keys(el).some((k) => k.startsWith("__reactProps$"));
          if (hidratou || Date.now() - inicio > 30000) return resolve();
          setTimeout(esperar, 100);
        })();
      })
  );
  return loc;
}
async function clicar(loc) {
  await pronto(loc);
  await loc.click();
}
/** Espera o elemento ficar visível; devolve se ficou, para a verificação acusar em vez de quebrar. */
async function apareceu(loc, timeout = 10000) {
  return loc.waitFor({ state: "visible", timeout }).then(() => true, () => false);
}

const textoDe = (loc) => loc.innerText();
const campo = (page, rotulo) => page.locator(`div:has(> label:text-is("${rotulo}"))`).first();

async function abrirMetas(page) {
  await clicar(page.getByRole("button", { name: "Editar metas" }));
  await page.getByRole("button", { name: "Aplicar metas" }).waitFor({ state: "visible", timeout: 30000 });
}

/**
 * A página inteira num PNG. No celular a janela cresce até a altura do
 * documento antes da foto: sem isso, a barra de baixo (position: fixed)
 * aparece por cima do meio da página, onde estava a primeira tela, e parece
 * que ela cobre o conteúdo. Assim ela fica onde ficaria no fim da rolagem.
 */
async function fotografar(page, arquivo, disp) {
  if (disp.mobile) {
    const altura = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: disp.w, height: altura });
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: arquivo, fullPage: true });
}

async function transbordo(page) {
  return page.evaluate(() => {
    const larg = window.innerWidth;
    const doc = document.documentElement.scrollWidth;
    // Só para dizer ONDE vaza; quem decide é `doc > larg`. Caixa que rola por
    // dentro (overflow-x-auto) vaza de propósito e não conta.
    const vaza = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > larg + 1 && !e.closest('[class*="overflow-x-auto"]'))
      .slice(0, 4)
      .map((e) => e.tagName.toLowerCase() + "." + String(e.className).split(" ").slice(0, 2).join("."));
    return { larg, doc, vaza };
  });
}

(async () => {
  // O mock diz qual cenário subiu e quem é quem.
  let cen;
  try {
    cen = await (await fetch(MOCK + "/__cenario")).json();
  } catch {
    console.error(`Sem resposta do mock em ${MOCK}. Suba: CENARIO=carteira node ferramentas/mock-supabase.cjs`);
    process.exit(2);
  }
  if (cen.cenario !== "carteira" || !cen.pacientes?.beatriz) {
    console.error(`O mock subiu com o cenário "${cen.cenario}". Suba com CENARIO=carteira.`);
    process.exit(2);
  }
  const P = cen.pacientes;
  const rota = (k) => `/app/pacientes/${P[k]}`;

  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const estado = await entrar(browser);

  // =====================================================================
  // 1. Prints
  // =====================================================================
  console.log("\nPrints");
  const TELAS = [
    ["beatriz", "beatriz", null], // com alertas
    ["luiza", "luiza", null], // sem alertas
    ["pedro", "pedro", null], // recém-chegado
    ["carlos", "carlos", null], // dose atrasada
    ["joana", "joana", null], // parada, com exame
    ["beatriz-metas", "beatriz", abrirMetas], // com "Editar metas" aberto
  ];
  for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
    for (const disp of [CELULAR, COMPUTADOR]) {
      const ctx = await contexto(browser, disp, escuro, estado);
      for (const [nome, paciente, preparo] of TELAS) {
        const page = await abrir(ctx, rota(paciente));
        if (preparo) await preparo(page);
        const texto = await textoDe(page.locator("body"));
        ok(!/Não foi possível carregar/.test(texto), `nenhuma seção com erro: ${nome}/${disp.nome}/${tema}`);
        const m = await transbordo(page);
        const arquivo = `${OUT}/${nome}-${disp.nome}-${tema}.png`;
        await fotografar(page, arquivo, disp);
        ok(m.doc <= m.larg, `sem transbordo: ${arquivo} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        await page.close();
      }
      // A conversa em tela cheia, que só existe no celular.
      if (disp === CELULAR) {
        const page = await abrir(ctx, rota("beatriz") + "?conversa=1");
        const m = await transbordo(page);
        const arquivo = `${OUT}/beatriz-conversa-${disp.nome}-${tema}.png`;
        await fotografar(page, arquivo, disp);
        ok(m.doc <= m.larg, `sem transbordo: ${arquivo} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        await page.close();
      }
      await ctx.close();
    }
  }
  // Entre `lg` e `xl` a página fica numa coluna só.
  {
    const ctx = await contexto(browser, ESTREITO, false, estado);
    const page = await abrir(ctx, rota("beatriz"));
    const m = await transbordo(page);
    const arquivo = `${OUT}/beatriz-${ESTREITO.nome}-claro.png`;
    await fotografar(page, arquivo, ESTREITO);
    ok(m.doc <= m.larg, `sem transbordo: ${arquivo} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
    await page.close();
    await ctx.close();
  }

  // =====================================================================
  // 2. O cenário faz o que diz (a fila de cada paciente)
  // =====================================================================
  console.log("\nCenário: a fila de cada paciente (computador)");
  etapa = "cenário";
  const pc = await contexto(browser, COMPUTADOR, false, estado);
  const fila = (page) => page.locator('section[aria-labelledby="fila-titulo"]');
  const ESPERADO = {
    carlos: { tem: ["Dose atrasada"], nao: ["mudança", "sem registrar", "Nunca registrou", "exame"] },
    beatriz: {
      tem: ["2 mudanças na sua prescrição", "Faltou a 1 treino (7d)"],
      nao: ["Dose atrasada", "sem registrar", "Nunca registrou", "exame"],
    },
    joana: { tem: ["12 dias sem registrar", "1 exame fora da referência"], nao: ["Dose atrasada", "mudança"] },
    pedro: { tem: ["Nunca registrou nada"], nao: ["Dose atrasada", "mudança", "exame"] },
  };
  for (const [k, e] of Object.entries(ESPERADO)) {
    const page = await abrir(pc, rota(k));
    const txt = await textoDe(fila(page));
    for (const t of e.tem) ok(txt.includes(t), `${k}: a fila diz "${t}"`, `fila: ${JSON.stringify(txt)}`);
    for (const t of e.nao) ok(!txt.includes(t), `${k}: a fila NÃO diz "${t}"`, `fila: ${JSON.stringify(txt)}`);
    await page.close();
  }
  {
    const page = await abrir(pc, rota("luiza"));
    ok((await fila(page).count()) === 0, "luiza: sem alerta, a seção 'Por que está na sua fila' nem aparece");
    ok((await page.getByRole("button", { name: /Reaplicar/ }).count()) === 0, "luiza: sem botão Reaplicar");
    await page.close();
  }
  {
    // Quem nunca registrou nada vê "—", e não "0/7".
    const page = await abrir(pc, rota("pedro"));
    const numeros = await textoDe(page.locator('dl:has-text("dias com registro")').first());
    ok(/dias com registro\s*—/.test(numeros) && !numeros.includes("0/7"), 'pedro: "—" em dias com registro, e não "0/7"', numeros);
    ok((await page.getByRole("button", { name: "Definir metas" }).count()) === 1, 'pedro: sem metas, o botão é "Definir metas"');
    await page.close();
  }

  // =====================================================================
  // 3. Verificações na tela
  // =====================================================================
  console.log("\nVerificação 1: rascunho sobrevive (computador)");
  etapa = "Verificação 1";
  {
    const page = await abrir(pc, rota("beatriz"));
    await abrirMetas(page);
    const kcal = campo(page, "Calorias/dia").locator("input");
    await kcal.fill("1900");
    // Enviar uma mensagem pela coluna lateral refaz as consultas do servidor
    // (router.refresh) e não pode desmontar o formulário aberto.
    const caixa = page.locator("#conversa textarea");
    await caixa.fill("Mensagem de teste do script de prints.");
    const daPagina = (r) => new URL(r.url()).pathname === `/app/pacientes/${P.beatriz}`;
    const [post, patch, rsc] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/rest/v1/patient_notes"), { timeout: 30000 }),
      page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/rest/v1/patient_notes"), { timeout: 30000 }),
      page.waitForResponse((r) => r.request().method() === "GET" && r.url().includes("_rsc=") && daPagina(r), { timeout: 30000 }),
      clicar(page.locator("#conversa").getByRole("button", { name: "Enviar" })),
    ]);
    // O botão diz "Enviando…" até a página nova estar na tela (useRecarregar);
    // a volta do "Enviar" é o sinal de que o React aplicou o que veio.
    await page.locator("#conversa").getByRole("button", { name: "Enviar", exact: true }).waitFor({ state: "visible", timeout: 30000 });
    ok(post.ok() && patch.ok(), `a mensagem foi enviada e marcada como lida (POST ${post.status()}, PATCH ${patch.status()})`);
    ok(rsc.ok(), `o servidor refez a página (GET ?_rsc=, ${rsc.status()})`);
    ok((await caixa.inputValue()) === "", "a caixa da mensagem esvaziou (o envio terminou)");
    ok((await kcal.inputValue()) === "1900", `o campo de calorias continua com 1900 (achado "${await kcal.inputValue()}")`);
    ok((await page.getByRole("button", { name: "Fechar edição" }).count()) === 1, "o editor de metas continua aberto");
    await page.close();
  }

  console.log("\nVerificação 2: voltar fecha a conversa (celular)");
  etapa = "Verificação 2";
  const cel = await contexto(browser, CELULAR, false, estado);
  {
    const page = await abrir(cel, rota("beatriz"));
    ok((await page.getByRole("heading", { level: 1, name: "Beatriz Rocha" }).isVisible()), "antes: o título 'Beatriz Rocha' está visível");
    await clicar(page.getByRole("link", { name: /^Mensagem/ }));
    await page.waitForURL(/conversa=1/, { timeout: 30000 });
    await page.getByRole("link", { name: "Voltar" }).waitFor({ state: "visible", timeout: 30000 });
    ok(true, "Mensagem abre a conversa em tela cheia (?conversa=1, com o link Voltar)");
    ok(!(await page.getByRole("heading", { level: 1, name: "Beatriz Rocha" }).isVisible()), "em tela cheia o cabeçalho some (a conversa está sozinha)");
    await page.goBack();
    await page.waitForFunction(() => !location.search.includes("conversa=1"), null, { timeout: 30000 });
    await page.getByRole("heading", { level: 1, name: "Beatriz Rocha" }).waitFor({ state: "visible", timeout: 30000 });
    ok(!page.url().includes("conversa=1"), `depois do goBack a URL fica sem conversa=1 (${page.url()})`);
    ok(await page.getByRole("heading", { level: 1, name: "Beatriz Rocha" }).isVisible(), "depois do goBack o título 'Beatriz Rocha' está visível");
    await page.close();
  }
  {
    // O link Voltar usa `replace`: com push, o Voltar do aparelho reabria a
    // conversa que a pessoa tinha acabado de fechar.
    const page = await abrir(cel, "/app/pacientes", { secoes: false });
    await clicar(page.locator(`a[href="${rota("beatriz")}"]`).first());
    await page.waitForURL((u) => u.pathname === rota("beatriz"), { timeout: 60000 });
    await clicar(page.getByRole("link", { name: /^Mensagem/ }));
    await page.waitForURL(/conversa=1/, { timeout: 60000 });
    const antes = await page.evaluate(() => history.length);
    await clicar(page.getByRole("link", { name: "Voltar" }));
    await page.waitForFunction(() => !location.search.includes("conversa=1"), null, { timeout: 30000 });
    const depois = await page.evaluate(() => history.length);
    ok(depois === antes, `Voltar não empilha outra entrada no histórico (${antes} antes, ${depois} depois)`);
    await page.goBack();
    await page.waitForTimeout(1500); // com push, é aqui que a conversa reabriria
    const u = new URL(page.url());
    ok(u.pathname === rota("beatriz") && !u.search.includes("conversa"),
      `o goBack seguinte não reabre a conversa (${u.pathname}${u.search})`);
    await page.close();
  }

  console.log("\nVerificação 3: dois tratamentos ativos (R12)");
  etapa = "Verificação 3";
  {
    const page = await abrir(pc, rota("beatriz"));
    const clinico = await textoDe(page.locator("#clinico"));
    ok(clinico.includes("Ozempic") && clinico.includes("0,5 mg"), "Beatriz: o Clínico mostra o tratamento mais recente (Ozempic, 0,5 mg)", clinico);
    ok(!clinico.includes("Saxenda"), "Beatriz: o Clínico NÃO mostra o mais antigo (Saxenda)", clinico);
    ok(clinico.includes(`Próxima dose: ${diaBR(-3)}`) && !clinico.includes("atrasada"),
      `Beatriz: a próxima dose do mais novo é ${diaBR(-3)} e não está atrasada`, clinico);
    ok(!(await textoDe(fila(page))).includes("Dose atrasada"), "Beatriz: a fila NÃO acusa dose atrasada (a vencida é a do tratamento antigo)");
    await page.close();
    const carlos = await abrir(pc, rota("carlos"));
    ok((await textoDe(carlos.locator("#clinico"))).includes("atrasada"), "Carlos: o Clínico marca a dose como atrasada");
    ok((await textoDe(fila(carlos))).includes("Dose atrasada"), "Carlos: a fila acusa dose atrasada");
    await carlos.close();
  }

  console.log("\nVerificação 4: sem vínculo");
  etapa = "Verificação 4";
  {
    const page = await abrir(pc, "/app/pacientes/00000000-0000-0000-0000-000000000000", { secoes: false });
    await page.getByText("Sem acesso a este paciente").waitFor({ state: "visible", timeout: 30000 });
    ok(true, 'o paciente sem vínculo mostra "Sem acesso a este paciente"');
    let secoes = 0;
    for (const s of SECOES) secoes += await page.locator(`#${s}`).count();
    ok(secoes === 0, `e nenhuma seção roda (${secoes} encontradas)`);
    await page.close();
  }

  console.log("\nVerificação 5: Reaplicar (R16)");
  etapa = "Verificação 5";
  {
    const page = await abrir(pc, rota("beatriz"));
    const botao = page.getByRole("button", { name: "Reaplicar 1.800 kcal" });
    ok((await botao.count()) === 1, 'Beatriz tem um desvio de meta aberto: "Reaplicar 1.800 kcal" aparece');
    const [req, res] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/rest/v1/rpc/set_patient_goals"), { timeout: 30000 }),
      page.waitForResponse((r) => r.url().includes("/rest/v1/rpc/set_patient_goals") && r.request().method() === "POST", { timeout: 30000 }),
      clicar(botao),
    ]);
    const corpo = req.postDataJSON();
    const quatro = { p_patient: P.beatriz, p_calories: 1800, p_protein: 110, p_water: 2500, p_weight: 65, p_notes: null };
    ok(JSON.stringify(corpo) === JSON.stringify(quatro), "a RPC set_patient_goals leva as QUATRO metas da última prescrição", JSON.stringify(corpo));
    ok(res.status() === 200 && JSON.stringify(await res.json()) === JSON.stringify({ ok: true }), `e o mock responde { ok: true } (${res.status()})`);
    // "Reaplicando…" até a página nova chegar; o mock não guarda nada, então
    // o aviso continua aberto e o botão volta com o rótulo de antes.
    await page.getByRole("button", { name: "Reaplicar 1.800 kcal" }).waitFor({ state: "visible", timeout: 30000 });
    ok(!(await textoDe(page.locator("body"))).includes("Não foi possível reaplicar"), "nenhum erro de Reaplicar na tela");
    await page.close();
  }

  console.log("\nVerificação 6: só os desvios de META aparecem na Alimentação (R16)");
  etapa = "Verificação 6";
  {
    const page = await abrir(pc, rota("beatriz"));
    const alimentacao = page.locator("#alimentacao");
    const itens = alimentacao.locator("ul.bg-clin-atencao-fundo > li");
    ok((await itens.count()) === 1, `Alimentação lista 1 desvio (achados ${await itens.count()})`);
    const txt = await textoDe(itens.first());
    ok(/Calorias:\s*ela está usando 2\.200 kcal/.test(txt), `e é o de calorias: "${txt.replace(/\s+/g, " ")}"`);
    const tudo = await textoDe(alimentacao);
    ok(!/workout_plan|undefined|Treino B|Água:/.test(tudo), "o aviso do plano de treino e o aviso com baixa não aparecem em Alimentação");
    ok(tudo.includes("1.800 kcal"), 'a coluna "Meta" mostra o que o nutricionista prescreveu (1.800 kcal), não o 2.200 do perfil');
    ok((await textoDe(fila(page))).includes("2 mudanças na sua prescrição"), 'a fila conta os DOIS avisos abertos ("2 mudanças na sua prescrição")');
    await page.close();
  }

  console.log("\nVerificação 7: o editor de metas abre com a prescrição (R15)");
  etapa = "Verificação 7";
  {
    const page = await abrir(pc, rota("beatriz"));
    await abrirMetas(page);
    const valor = (r) => campo(page, r).locator("input").inputValue();
    const achados = [await valor("Calorias/dia"), await valor("Proteína/dia (g)"), await valor("Água/dia (ml)"), await valor("Peso alvo (kg)")];
    ok(JSON.stringify(achados) === JSON.stringify(["1800", "110", "2500", "65"]),
      `o editor abre com 1800 / 110 / 2500 / 65, a prescrição (achados ${achados.join(" / ")})`);
    ok((await textoDe(campo(page, "Calorias/dia"))).includes("ela está usando 2.200 kcal"), 'embaixo de Calorias: "ela está usando 2.200 kcal"');
    let outros = "";
    for (const r of ["Proteína/dia (g)", "Água/dia (ml)", "Peso alvo (kg)"]) outros += await textoDe(campo(page, r));
    ok(!/usando/.test(outros), "os outros três campos não trazem aviso");
    await page.close();
  }

  console.log("\nVerificação 8: os números do topo e a semana de treino (Beatriz)");
  etapa = "Verificação 8";
  {
    const page = await abrir(pc, rota("beatriz"));
    const numeros = (await textoDe(page.locator('dl:has-text("dias com registro")').first())).replace(/\s+/g, " ");
    ok(/dias com registro 6\/7/.test(numeros) && /treinos \(7 dias\) 3 de 4/.test(numeros), `números do topo: 6/7 dias, 3 de 4 treinos (${numeros})`);
    ok((await page.getByRole("link", { name: /Mensagem.*2 não lidas/ }).count()) === 1, "o botão Mensagem traz as 2 não lidas");
    await page.close();
  }

  console.log("\nVerificação 9: a mudança do plano de treino aparece (R19)");
  etapa = "Verificação 9";
  {
    const page = await abrir(pc, rota("beatriz"));
    const treino = page.locator("#treino");
    const itens = treino.locator("ul.bg-clin-atencao-fundo > li");
    ok((await itens.count()) === 1, `Treino lista 1 mudança do plano (achadas ${await itens.count()})`);
    const txt = (await textoDe(itens.first())).replace(/\s+/g, " ");
    ok(/Plano de treino: você definiu Treino B — Inferiores; ela está sem essa sessão · \d{2}\/\d{2}\/\d{4}/.test(txt),
      `e é a do Treino B, por extenso: "${txt}"`);
    ok(!/workout_plan|undefined|daily_|Calorias/.test(await textoDe(treino)), "sem nome cru de coluna nem aviso de meta no Treino");
    const botao = page.getByRole("button", { name: "Reaplicar 1.800 kcal" });
    const idObs = await botao.getAttribute("aria-describedby");
    const obs = idObs ? page.locator(`[id="${idObs}"]`) : null;
    const textoObs = obs ? await textoDe(obs) : "";
    ok(textoObs === "Também dá baixa na mudança do plano de treino.",
      'com os dois avisos abertos, embaixo do Reaplicar: "Também dá baixa na mudança do plano de treino." (e o botão aponta para ela)', textoObs);
    if (obs) {
      const b = await botao.boundingBox();
      const o = await obs.boundingBox();
      ok(o.y >= b.y + b.height - 1, `a linha fica embaixo do botão (botão termina em ${Math.round(b.y + b.height)}, linha começa em ${Math.round(o.y)})`);
      const cor = await obs.evaluate((el) => getComputedStyle(el).color);
      const esperada = await obs.evaluate((el) => {
        const t = document.createElement("span");
        t.style.color = "var(--clin-atencao-texto-2)";
        el.appendChild(t);
        const c = getComputedStyle(t).color;
        t.remove();
        return c;
      });
      ok(cor === esperada, `em atencao-texto-2 (${cor})`);
    }
    await page.close();
    for (const k of ["carlos", "luiza"]) {
      const outra = await abrir(pc, rota(k));
      ok(!(await textoDe(outra.locator("body"))).includes("Também dá baixa"), `${k}: sem a linha "Também dá baixa"`);
      ok((await outra.locator("#treino ul.bg-clin-atencao-fundo").count()) === 0, `${k}: o Treino não lista mudança nenhuma`);
      await outra.close();
    }
  }

  console.log("\nVerificação 10: Aplicar metas espera a página nova");
  etapa = "Verificação 10";
  {
    const page = await abrir(pc, rota("beatriz"));
    await abrirMetas(page);
    let rpcs = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/rest/v1/rpc/set_patient_goals")) rpcs++;
    });
    // Segura a página nova (o GET ?_rsc= do router.refresh) para olhar o meio
    // do caminho: a RPC já voltou e a tela ainda tem o dado velho.
    let soltar;
    const segura = new Promise((r) => (soltar = r));
    const daPagina = (u) => u.pathname === rota("beatriz") && u.searchParams.has("_rsc");
    await page.route((u) => daPagina(u), async (route) => {
      await segura;
      await route.continue();
    });
    const pedidoDaPagina = page.waitForRequest((r) => daPagina(new URL(r.url())), { timeout: 30000 });
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/rest/v1/rpc/set_patient_goals") && r.request().method() === "POST", { timeout: 30000 }),
      clicar(page.getByRole("button", { name: "Aplicar metas" })),
    ]);
    await pedidoDaPagina;
    const andamento = page.getByRole("button", { name: "Aplicando…" });
    ok((await apareceu(andamento)) && (await andamento.isDisabled()),
      'RPC de volta e página nova a caminho: o botão diz "Aplicando…" e está desligado');
    const cancelar = page.locator("form").filter({ has: page.getByRole("button", { name: /Aplica/ }) })
      .getByRole("button", { name: "Cancelar" });
    ok((await cancelar.count()) === 1 && (await cancelar.isDisabled()), "o Cancelar também");
    // Um segundo clique agora gravaria outra prescrição.
    await andamento.click({ force: true, timeout: 2000 }).catch(() => {});
    soltar();
    ok(await apareceu(page.getByRole("button", { name: "Editar metas" }), 30000),
      "quando a página nova chega, o editor fecha sozinho");
    ok(rpcs === 1, `uma RPC só, mesmo com o segundo clique (${rpcs})`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.close();
  }

  console.log("\nVerificação 11: Fechar edição com a RPC em voo");
  etapa = "Verificação 11";
  {
    const page = await abrir(pc, rota("beatriz"));
    await abrirMetas(page);
    const kcal = campo(page, "Calorias/dia").locator("input");
    await kcal.fill("1950");
    // Segura a RPC e depois responde com a recusa da própria função
    // ({ ok: false }), que não suja o console como um 500 sujaria.
    let soltar;
    const segura = new Promise((r) => (soltar = r));
    await page.route((u) => u.pathname.endsWith("/rest/v1/rpc/set_patient_goals"), async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await segura;
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        body: JSON.stringify({ ok: false, error: "Recusa simulada pelo script." }),
      });
    });
    await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/rest/v1/rpc/set_patient_goals"), { timeout: 30000 }),
      clicar(page.getByRole("button", { name: "Aplicar metas" })),
    ]);
    const fechar = page.getByRole("button", { name: "Fechar edição" });
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Fechar edição" && b.disabled),
      null, { timeout: 10000 }
    ).catch(() => {});
    ok(await fechar.isDisabled(), '"Fechar edição" fica desligado com a RPC em voo');
    soltar();
    ok((await apareceu(page.getByText("Recusa simulada pelo script."), 30000)) &&
      (await page.getByRole("button", { name: "Aplicar metas" }).count()) === 1,
      "a recusa aparece embaixo do formulário, que continua aberto");
    ok(!(await fechar.isDisabled()), 'e "Fechar edição" volta a funcionar');
    ok((await kcal.inputValue()) === "1950", `o valor digitado continua lá (${await kcal.inputValue()})`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.close();
  }

  console.log("\nVerificação 12: o rascunho do cardápio trava as outras seções");
  etapa = "Verificação 12";
  {
    const page = await abrir(pc, rota("beatriz"));
    const bloqueio = page.getByRole("button", { name: "Salve ou cancele a edição de Cardápio" });
    await clicar(page.getByRole("button", { name: "Editar cardápio" }));
    const nome = page.getByPlaceholder("Nome do plano (ex.: Plano de outubro)");
    await nome.waitFor({ state: "visible", timeout: 30000 });
    ok((await page.getByRole("button", { name: "Editar metas" }).count()) === 1, 'cardápio aberto sem rascunho: "Editar metas" continua livre');
    await nome.fill("Plano alimentar — fase 2");
    await apareceu(bloqueio.first());
    ok((await page.getByRole("button", { name: "Editar metas" }).count()) === 0 &&
      (await page.getByRole("button", { name: "Editar plano" }).count()) === 0 &&
      (await bloqueio.count()) === 2,
      'com o nome do plano digitado, metas e treino dizem "Salve ou cancele a edição de Cardápio"');
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/rest/v1/meal_plans"), { timeout: 30000 }),
      clicar(page.getByRole("button", { name: "Salvar nome e orientação" })),
    ]);
    await apareceu(page.getByRole("button", { name: "Editar metas" }));
    ok((await bloqueio.count()) === 0, 'salvou o nome: "Editar metas" e "Editar plano" voltam');
    // A opção nova de uma refeição também é rascunho; descartá-la solta.
    await clicar(page.locator("#alimentacao").getByRole("button", { name: /^(Adicionar|Outra opção)$/ }).first());
    await page.getByPlaceholder(/2 ovos mexidos/).fill("Iogurte natural com aveia");
    await apareceu(bloqueio.first());
    ok((await bloqueio.count()) === 2, "a opção nova digitada também trava as outras seções");
    await clicar(page.getByRole("button", { name: "Descartar esta opção" }));
    await apareceu(page.getByRole("button", { name: "Editar metas" }));
    ok((await bloqueio.count()) === 0, "descartar a opção nova solta a trava");
    await page.close();
  }
  {
    // No escuro, a cópia `.dark :where(.tema-clinico) .btn-ghost` tem duas
    // classes e vencia o `text-clin-texto-2` do aviso de bloqueio.
    const escuro = await contexto(browser, COMPUTADOR, true, estado);
    const page = await abrir(escuro, rota("beatriz"));
    await clicar(page.getByRole("button", { name: "Editar cardápio" }));
    await page.getByPlaceholder("Nome do plano (ex.: Plano de outubro)").fill("Plano alimentar — fase 2");
    const aviso = page.getByRole("button", { name: "Salve ou cancele a edição de Cardápio" }).first();
    if (await apareceu(aviso)) {
      // O React reaproveita o <button> do "Editar metas", e o `.btn` tem
      // `transition`: a cor anda de `texto` para `texto-2` por uns 150 ms.
      // Mede depois de a transição acabar.
      await aviso.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const [cor, esperada] = await aviso.evaluate((el) => {
        const t = document.createElement("span");
        t.style.color = "var(--clin-texto-2)";
        el.appendChild(t);
        const c = getComputedStyle(t).color;
        t.remove();
        return [getComputedStyle(el).color, c];
      });
      ok(cor === esperada, `no escuro, o aviso de bloqueio sai em texto-2 (${cor}, esperado ${esperada})`);
    } else {
      ok(false, "no escuro, o aviso de bloqueio aparece");
    }
    await page.close();
    await escuro.close();
  }

  console.log("\nConsole e rede");
  ok(errosDeConsole.length === 0, `nenhum erro de console, de página ou de rede em todas as telas (${errosDeConsole.length})`,
    [...new Set(errosDeConsole)].slice(0, 8).join("\n         "));

  await pc.close();
  await cel.close();
  await browser.close();

  const falhas = resultados.filter((r) => !r.passou);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram, ${falhas.length} falharam.`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
