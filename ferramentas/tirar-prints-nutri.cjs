// Requer: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
// (ver ferramentas/LEIAME.md), o dev no ar e o mock com CENARIO=carteira.
//
// Entra como nutricionista e faz duas coisas com o detalhe do paciente, que é
// em abas (Resumo, Alimentação, Treino, Corpo, Clínico, Consultas; ?aba=) e
// com a agenda (/app/agenda):
//   1. tira os prints: paciente/aba x celular/computador x claro/escuro, e avisa
//      se alguma página transborda a largura da janela;
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
// Todas as seções com âncora. Só as da aba aberta existem na página; a
// conversa e as notas ficam fora das abas e estão sempre lá.
const SECOES = ["alimentacao", "treino", "corpo", "clinico", "conversa", "notas"];
const SEMPRE = ["conversa", "notas"];
/** O que confirma que a aba carregou: a seção dela (o Resumo não tem âncora, tem os números). */
const SINAL_DA_ABA = {
  resumo: 'dl:has-text("dias com registro")',
  alimentacao: "#alimentacao",
  treino: "#treino",
  corpo: "#corpo",
  clinico: "#clinico",
  consultas: "#consultas",
};
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

/** Abre uma rota do paciente e espera a aba dela, a conversa e as notas streamarem. */
async function abrir(ctx, caminho, { secoes = true } = {}) {
  const page = await ctx.newPage();
  espiar(page);
  await page.goto(APP + caminho, { waitUntil: "load", timeout: 120000 });
  if (secoes) {
    const aba = new URL(APP + caminho).searchParams.get("aba") || "resumo";
    await page.waitForSelector(SINAL_DA_ABA[aba], { state: "attached", timeout: 60000 });
    for (const s of SEMPRE) await page.waitForSelector(`#${s}`, { state: "attached", timeout: 60000 });
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
  // As consultas voltam ao que o cenário subiu: a Verificação 15 aceita
  // pedidos e fecha consultas, e uma segunda rodada acharia outra agenda.
  await fetch(MOCK + "/__reset", { method: "POST" });
  const rota = (k) => `/app/pacientes/${P[k]}`;
  /** A rota de uma aba; o Resumo é a rota sem parâmetro. */
  const aba = (k, a) => rota(k) + (a === "resumo" ? "" : `?aba=${a}`);

  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const estado = await entrar(browser);

  // =====================================================================
  // 1. Prints
  // =====================================================================
  console.log("\nPrints");
  const TELAS = [
    // Beatriz, a que tem de tudo, em todas as abas.
    ["beatriz", "beatriz", "resumo", null],
    ["beatriz-alimentacao", "beatriz", "alimentacao", null],
    ["beatriz-treino", "beatriz", "treino", null],
    ["beatriz-corpo", "beatriz", "corpo", null],
    ["beatriz-clinico", "beatriz", "clinico", null],
    ["beatriz-consultas", "beatriz", "consultas", null], // pedido de consulta aberto
    ["beatriz-metas", "beatriz", "alimentacao", abrirMetas], // com "Editar metas" aberto
    // Os outros, no Resumo, onde cada um é diferente.
    ["luiza", "luiza", "resumo", null], // sem alertas
    ["pedro", "pedro", "resumo", null], // recém-chegado
    ["carlos", "carlos", "resumo", null], // dose atrasada
    ["joana", "joana", "resumo", null], // parada, com exame
  ];
  for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
    for (const disp of [CELULAR, COMPUTADOR]) {
      const ctx = await contexto(browser, disp, escuro, estado);
      for (const [nome, paciente, qual, preparo] of TELAS) {
        const page = await abrir(ctx, aba(paciente, qual));
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
  // Entre `lg` e `xl` a página fica numa coluna só. Na Alimentação, a aba
  // com a tabela, que é o que mais pede largura.
  {
    const ctx = await contexto(browser, ESTREITO, false, estado);
    const page = await abrir(ctx, aba("beatriz", "alimentacao"));
    const m = await transbordo(page);
    const arquivo = `${OUT}/beatriz-alimentacao-${ESTREITO.nome}-claro.png`;
    await fotografar(page, arquivo, ESTREITO);
    ok(m.doc <= m.larg, `sem transbordo: ${arquivo} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
    await page.close();
    await ctx.close();
  }

  // A agenda nas três vistas, nos dois temas e nas duas larguras.
  console.log("\nAgenda (prints)");
  for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
    for (const disp of [CELULAR, COMPUTADOR]) {
      const ctx = await contexto(browser, disp, escuro, estado);
      for (const vista of ["dia", "semana", "mes"]) {
        const page = await abrir(ctx, `/app/agenda?vista=${vista}`, { secoes: false });
        await page.locator('nav[aria-label="Vista da agenda"]').waitFor({ timeout: 60000 });
        ok(!/Não foi possível carregar/.test(await textoDe(page.locator("body"))), `agenda sem erro: ${vista}/${disp.nome}/${tema}`);
        const m = await transbordo(page);
        const arquivo = `${OUT}/agenda-${vista}-${disp.nome}-${tema}.png`;
        await fotografar(page, arquivo, disp);
        ok(m.doc <= m.larg, `sem transbordo: ${arquivo} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        await page.close();
      }
      await ctx.close();
    }
  }

  // Erro e transbordo em TODAS as abas de todos os pacientes, sem print: os
  // prints acima só mostram as abas da Beatriz, e as abas vazias do Pedro ou
  // o Clínico da Joana (exame fora) também precisam caber em 390 px.
  console.log("\nTodas as abas de todos os pacientes (erro e transbordo)");
  etapa = "todas as abas";
  for (const disp of [CELULAR, COMPUTADOR]) {
    const ctx = await contexto(browser, disp, false, estado);
    for (const k of ["luiza", "pedro", "carlos", "joana"]) {
      for (const a of ["alimentacao", "treino", "corpo", "clinico", "consultas"]) {
        const page = await abrir(ctx, aba(k, a));
        ok(!/Não foi possível carregar/.test(await textoDe(page.locator("body"))), `nenhuma seção com erro: ${k}/${a}/${disp.nome}`);
        const m = await transbordo(page);
        ok(m.doc <= m.larg, `sem transbordo: ${k}/${a}/${disp.nome} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        await page.close();
      }
    }
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
    await page.close();
    const metas = await abrir(pc, aba("pedro", "alimentacao"));
    ok((await metas.getByRole("button", { name: "Definir metas" }).count()) === 1, 'pedro: sem metas, o botão da Alimentação é "Definir metas"');
    await metas.close();
  }

  // =====================================================================
  // 3. Verificações na tela
  // =====================================================================
  console.log("\nVerificação 1: rascunho sobrevive (computador)");
  etapa = "Verificação 1";
  {
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
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
    const page = await abrir(pc, aba("beatriz", "clinico"));
    const clinico = await textoDe(page.locator("#clinico"));
    ok(clinico.includes("Ozempic") && clinico.includes("0,5 mg"), "Beatriz: o Clínico mostra o tratamento mais recente (Ozempic, 0,5 mg)", clinico);
    ok(!clinico.includes("Saxenda"), "Beatriz: o Clínico NÃO mostra o mais antigo (Saxenda)", clinico);
    ok(clinico.includes(`Próxima dose: ${diaBR(-3)}`) && !clinico.includes("atrasada"),
      `Beatriz: a próxima dose do mais novo é ${diaBR(-3)} e não está atrasada`, clinico);
    await page.close();
    const resumo = await abrir(pc, rota("beatriz"));
    ok(!(await textoDe(fila(resumo))).includes("Dose atrasada"), "Beatriz: a fila NÃO acusa dose atrasada (a vencida é a do tratamento antigo)");
    await resumo.close();
    const carlos = await abrir(pc, aba("carlos", "clinico"));
    ok((await textoDe(carlos.locator("#clinico"))).includes("atrasada"), "Carlos: o Clínico marca a dose como atrasada");
    await carlos.close();
    const carlosResumo = await abrir(pc, rota("carlos"));
    ok((await textoDe(fila(carlosResumo))).includes("Dose atrasada"), "Carlos: a fila acusa dose atrasada");
    await carlosResumo.close();
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
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
    const alimentacao = page.locator("#alimentacao");
    const itens = alimentacao.locator("ul.bg-clin-atencao-fundo > li");
    ok((await itens.count()) === 1, `Alimentação lista 1 desvio (achados ${await itens.count()})`);
    const txt = await textoDe(itens.first());
    ok(/Calorias:\s*ela está usando 2\.200 kcal/.test(txt), `e é o de calorias: "${txt.replace(/\s+/g, " ")}"`);
    const tudo = await textoDe(alimentacao);
    ok(!/workout_plan|undefined|Treino B|Água:/.test(tudo), "o aviso do plano de treino e o aviso com baixa não aparecem em Alimentação");
    ok(tudo.includes("1.800 kcal"), 'a coluna "Meta" mostra o que o nutricionista prescreveu (1.800 kcal), não o 2.200 do perfil');
    await page.close();
    const resumo = await abrir(pc, rota("beatriz"));
    ok((await textoDe(fila(resumo))).includes("2 mudanças na sua prescrição"), 'a fila conta os DOIS avisos abertos ("2 mudanças na sua prescrição")');
    await resumo.close();
  }

  console.log("\nVerificação 7: o editor de metas abre com a prescrição (R15)");
  etapa = "Verificação 7";
  {
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
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
    const page = await abrir(pc, aba("beatriz", "treino"));
    const treino = page.locator("#treino");
    const itens = treino.locator("ul.bg-clin-atencao-fundo > li");
    ok((await itens.count()) === 1, `Treino lista 1 mudança do plano (achadas ${await itens.count()})`);
    const txt = (await textoDe(itens.first())).replace(/\s+/g, " ");
    // O mock grava como o gatilho do banco: `field` com o nome da sessão e
    // `current_value` 'removido pelo paciente'.
    ok(/^Treino B — Inferiores: ela tirou do plano · \d{2}\/\d{2}\/\d{4}$/.test(txt.trim()),
      `e é a do Treino B, por extenso: "${txt}"`);
    ok(!/workout_plan|removido pelo paciente|undefined|daily_|Calorias/.test(await textoDe(treino)),
      "sem o valor cru do gatilho, nome de coluna nem aviso de meta no Treino");
    await page.close();
  }
  {
    const page = await abrir(pc, rota("beatriz"));
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
      await outra.close();
      const treinoOutra = await abrir(pc, aba(k, "treino"));
      ok((await treinoOutra.locator("#treino ul.bg-clin-atencao-fundo").count()) === 0, `${k}: o Treino não lista mudança nenhuma`);
      await treinoOutra.close();
    }
  }

  console.log("\nVerificação 10: Aplicar metas espera a página nova");
  etapa = "Verificação 10";
  {
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
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
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
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
    // Trocar de aba agora desmontaria o formulário do mesmo jeito.
    let aviso = "";
    page.once("dialog", (d) => {
      aviso = `${d.type()}: ${d.message()}`;
      d.accept();
    });
    await page.locator('nav[aria-label="Assuntos do paciente"]').getByRole("link", { name: "Treino" }).click();
    await page.waitForTimeout(800);
    ok(aviso === "alert: Ainda salvando. Espere terminar para trocar de aba.",
      `com a RPC em voo, a barra de abas avisa e não troca ("${aviso}")`);
    ok(new URL(page.url()).searchParams.get("aba") === "alimentacao", "e a página continua na Alimentação");
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
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
    const bloqueio = page.getByRole("button", { name: "Salve ou cancele a edição de Cardápio" });
    await clicar(page.getByRole("button", { name: "Editar cardápio" }));
    const nome = page.getByPlaceholder("Nome do plano (ex.: Plano de outubro)");
    await nome.waitFor({ state: "visible", timeout: 30000 });
    ok((await page.getByRole("button", { name: "Editar metas" }).count()) === 1, 'cardápio aberto sem rascunho: "Editar metas" continua livre');
    await nome.fill("Plano alimentar — fase 2");
    await apareceu(bloqueio.first());
    // O "Editar plano" mora na aba Treino; aqui só o das metas trava.
    ok((await page.getByRole("button", { name: "Editar metas" }).count()) === 0 &&
      (await bloqueio.count()) === 1,
      'com o nome do plano digitado, metas diz "Salve ou cancele a edição de Cardápio"');
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/rest/v1/meal_plans"), { timeout: 30000 }),
      clicar(page.getByRole("button", { name: "Salvar nome e orientação" })),
    ]);
    await apareceu(page.getByRole("button", { name: "Editar metas" }));
    ok((await bloqueio.count()) === 0, 'salvou o nome: "Editar metas" volta');
    // A opção nova de uma refeição também é rascunho; descartá-la solta.
    await clicar(page.locator("#alimentacao").getByRole("button", { name: /^(Adicionar|Outra opção)$/ }).first());
    await page.getByPlaceholder(/2 ovos mexidos/).fill("Iogurte natural com aveia");
    await apareceu(bloqueio.first());
    ok((await bloqueio.count()) === 1, "a opção nova digitada também trava as metas");
    await clicar(page.getByRole("button", { name: "Descartar esta opção" }));
    await apareceu(page.getByRole("button", { name: "Editar metas" }));
    ok((await bloqueio.count()) === 0, "descartar a opção nova solta a trava");
    await page.close();
  }
  {
    // No escuro, a cópia `.dark :where(.tema-clinico) .btn-ghost` tem duas
    // classes e vencia o `text-clin-texto-2` do aviso de bloqueio.
    const escuro = await contexto(browser, COMPUTADOR, true, estado);
    const page = await abrir(escuro, aba("beatriz", "alimentacao"));
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

  console.log("\nVerificação 13: Criar plano espera a página nova (R23)");
  etapa = "Verificação 13";
  {
    // Pedro não tem cardápio: o botão do cabeçalho é "Criar plano".
    const page = await abrir(pc, aba("pedro", "alimentacao"));
    await clicar(page.getByRole("button", { name: "Montar cardápio" }));
    const criar = page.getByRole("button", { name: "Criar plano" });
    await pronto(criar);
    let inserts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/rest/v1/meal_plans") inserts++;
    });
    let soltar;
    const segura = new Promise((r) => (soltar = r));
    const daPagina = (u) => u.pathname === rota("pedro") && u.searchParams.has("_rsc");
    await page.route((u) => daPagina(u), async (route) => {
      await segura;
      await route.continue();
    });
    const pedidoDaPagina = page.waitForRequest((r) => daPagina(new URL(r.url())), { timeout: 30000 });
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/rest/v1/meal_plans", { timeout: 30000 }),
      criar.click(),
    ]);
    await pedidoDaPagina;
    const andamento = page.getByRole("button", { name: "Criando…" });
    ok((await apareceu(andamento)) && (await andamento.isDisabled()),
      'plano inserido e página nova a caminho: o botão diz "Criando…" e está desligado');
    await andamento.click({ force: true, timeout: 2000 }).catch(() => {});
    soltar();
    // O mock não guarda nada: a página nova volta sem plano e o botão volta a
    // ser "Criar plano". É o sinal de que a transição acabou.
    ok(await apareceu(page.getByRole("button", { name: "Criar plano" }), 30000), "quando a página nova chega, o botão volta");
    ok(inserts === 1, `um insert em meal_plans só, mesmo com o segundo clique (${inserts})`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.close();
  }

  console.log("\nVerificação 14: as abas");
  etapa = "Verificação 14";
  const atual = (page) => page.locator('nav[aria-label="Assuntos do paciente"] a[aria-current="page"]');
  const daAba = (page, a) => {
    const u = new URL(page.url());
    return (u.searchParams.get("aba") || "resumo") === a;
  };
  {
    // Sem parâmetro abre o Resumo, e só ele: as outras abas nem montam.
    const page = await abrir(pc, rota("beatriz"));
    ok((await textoDe(atual(page))) === "Resumo", `sem ?aba= a aba marcada é o Resumo (${await textoDe(atual(page))})`);
    let fora = 0;
    for (const s of ["alimentacao", "treino", "corpo", "clinico"]) fora += await page.locator(`#${s}`).count();
    ok(fora === 0, `no Resumo nenhuma seção das outras abas está na página (${fora})`);
    ok((await page.locator("#conversa").count()) === 1 && (await page.locator("#notas").count()) === 1,
      "a conversa e as notas estão no Resumo");
    // "Ver semana" na fila abre a aba Treino.
    await clicar(fila(page).getByRole("link", { name: "Ver semana" }));
    await page.waitForURL((u) => u.searchParams.get("aba") === "treino", { timeout: 30000 });
    await page.locator("#treino").waitFor({ state: "attached", timeout: 60000 });
    ok((await textoDe(atual(page))) === "Treino", '"Ver semana" abre a aba Treino, marcada na barra');
    ok((await page.locator("#conversa").count()) === 1, "a conversa continua lá na aba Treino");
    // O Voltar do navegador volta para a aba anterior.
    await page.goBack();
    await page.waitForURL((u) => !u.searchParams.has("aba"), { timeout: 30000 });
    await page.locator('dl:has-text("dias com registro")').first().waitFor({ state: "attached", timeout: 60000 });
    ok((await textoDe(atual(page))) === "Resumo", "o Voltar do navegador volta para o Resumo");
    await page.close();
  }
  {
    const page = await abrir(pc, rota("joana"));
    await clicar(fila(page).getByRole("link", { name: "Ver clínico" }));
    await page.waitForURL((u) => u.searchParams.get("aba") === "clinico", { timeout: 30000 });
    await page.locator("#clinico").waitFor({ state: "attached", timeout: 60000 });
    ok((await textoDe(atual(page))) === "Clínico", '"Ver clínico" na fila da Joana abre a aba Clínico');
    await page.close();
  }
  {
    const page = await abrir(pc, aba("beatriz", "corpo"));
    await clicar(page.locator("#corpo").getByRole("link", { name: "editar nas metas" }));
    await page.waitForURL((u) => u.searchParams.get("aba") === "alimentacao", { timeout: 30000 });
    await page.locator("#alimentacao").waitFor({ state: "attached", timeout: 60000 });
    ok(daAba(page, "alimentacao"), '"editar nas metas" no Corpo abre a aba Alimentação');
    await page.close();
  }
  {
    // Um ?aba= desconhecido cai no Resumo, não numa tela vazia.
    const page = await abrir(pc, rota("beatriz") + "?aba=prescricao", { secoes: false });
    await page.locator('dl:has-text("dias com registro")').first().waitFor({ state: "attached", timeout: 60000 });
    ok((await textoDe(atual(page))) === "Resumo", "?aba=prescricao (que não existe) abre o Resumo");
    await page.close();
  }
  {
    // Trocar de aba com metas alteradas pergunta antes; sem alteração, troca direto.
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
    await abrirMetas(page);
    const kcal = campo(page, "Calorias/dia").locator("input");
    await kcal.fill("1900");
    const linkTreino = page.locator('nav[aria-label="Assuntos do paciente"]').getByRole("link", { name: "Treino" });
    let pergunta = "";
    page.once("dialog", (d) => {
      pergunta = d.message();
      d.dismiss();
    });
    await clicar(linkTreino);
    await page.waitForTimeout(800);
    ok(pergunta === "Descartar as alterações em Metas?", `com metas alteradas, trocar de aba pergunta antes ("${pergunta}")`);
    ok(daAba(page, "alimentacao") && (await kcal.inputValue()) === "1900",
      "e quem cancela fica na Alimentação com o 1900 digitado");
    page.once("dialog", (d) => d.accept());
    await clicar(linkTreino);
    await page.waitForURL((u) => u.searchParams.get("aba") === "treino", { timeout: 30000 });
    await page.locator("#treino").waitFor({ state: "attached", timeout: 60000 });
    ok(daAba(page, "treino"), "quem confirma vai para a aba Treino");
    // A trava se soltou: o plano abre.
    ok((await page.getByRole("button", { name: "Editar plano" }).count()) === 1, 'e o "Editar plano" está livre (a trava das metas se soltou)');
    await page.close();
  }
  {
    const page = await abrir(pc, aba("beatriz", "alimentacao"));
    await abrirMetas(page);
    let perguntou = false;
    page.once("dialog", (d) => {
      perguntou = true;
      d.dismiss();
    });
    await clicar(page.locator('nav[aria-label="Assuntos do paciente"]').getByRole("link", { name: "Corpo" }));
    await page.waitForURL((u) => u.searchParams.get("aba") === "corpo", { timeout: 30000 });
    ok(!perguntou && daAba(page, "corpo"), "com o editor aberto e nada digitado, troca direto, sem perguntar");
    page.removeAllListeners("dialog");
    await page.close();
  }
  {
    // No celular, a tela cheia da conversa leva a aba junto, e o Voltar cai nela.
    const page = await abrir(cel, aba("beatriz", "alimentacao"));
    await clicar(page.getByRole("link", { name: /^Mensagem/ }));
    await page.waitForURL(/conversa=1/, { timeout: 30000 });
    const u = new URL(page.url());
    ok(u.searchParams.get("aba") === "alimentacao", `a tela cheia da conversa guarda a aba (${u.search})`);
    await clicar(page.getByRole("link", { name: "Voltar" }));
    await page.waitForFunction(() => !location.search.includes("conversa=1"), null, { timeout: 30000 });
    ok(daAba(page, "alimentacao"), `o Voltar volta para a aba Alimentação (${new URL(page.url()).search})`);
    // As cinco abas não cabem em 390 px: a barra rola, a página não.
    const m = await transbordo(page);
    ok(m.doc <= m.larg, `no celular a barra de abas não alarga a página (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
    await page.close();
  }

  {
    // No celular, abrir a conversa em tela cheia e voltar não desmonta o
    // rascunho: é o motivo de a tela cheia levar ?aba= junto.
    const page = await abrir(cel, aba("beatriz", "alimentacao"));
    await abrirMetas(page);
    const kcal = campo(page, "Calorias/dia").locator("input");
    await kcal.fill("1900");
    await clicar(page.getByRole("link", { name: /^Mensagem/ }));
    await page.waitForURL(/conversa=1/, { timeout: 30000 });
    await clicar(page.getByRole("link", { name: "Voltar" }));
    await page.waitForFunction(() => !location.search.includes("conversa=1"), null, { timeout: 30000 });
    ok((await kcal.inputValue()) === "1900" && (await page.getByRole("button", { name: "Fechar edição" }).count()) === 1,
      `celular: abrir a conversa e voltar mantém o editor de metas aberto com o 1900 (${await kcal.inputValue()})`);
    await page.close();
  }
  {
    // Cada aba tem o próprio título: o leitor de tela anuncia a troca.
    const page = await abrir(pc, aba("beatriz", "treino"));
    ok((await page.title()) === "Treino · Paciente · Pace Fit", `o título da página diz a aba (${await page.title()})`);
    await page.close();
  }

  // =====================================================================
  // 15. Consultas e agenda
  // =====================================================================
  console.log("\nVerificação 15: consultas e agenda");
  etapa = "consultas";
  {
    const diaSP = (n) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(Date.now() + n * 86400000));
    const agenda = (q = "") => `/app/agenda${q}`;
    const vista = (page) => page.locator('nav[aria-label="Vista da agenda"]');
    const aviso = (page) => page.locator('section[aria-labelledby="pendencias-agenda"]');
    const janela = (page) => page.locator("dialog[open]");
    const abrirAgenda = async (ctx, q) => {
      const page = await abrir(ctx, agenda(q), { secoes: false });
      await vista(page).waitFor({ timeout: 60000 });
      return page;
    };

    // a) a vista padrão é o Dia de hoje, e a linha de aviso conta as pendências
    {
      const ctx = await contexto(browser, COMPUTADOR, false, {
        ...estado,
        cookies: estado.cookies.filter((c) => c.name !== "agenda_vista"),
      });
      const page = await abrirAgenda(ctx, "");
      ok((await textoDe(page.locator("h2").first())).includes("hoje"), "sem cookie nem ?vista=, a agenda abre no Dia de hoje");
      const txt = await textoDe(aviso(page));
      ok(txt.includes("2 pedidos aguardando") && txt.includes("1 consulta sem desfecho"),
        "a linha de aviso conta 2 pedidos (Beatriz, Carlos) e 1 sem desfecho (Joana)", txt);
      // b) a última vista usada fica: Semana, e depois /app/agenda sem ?vista=
      await page.close();
      const semana = await abrirAgenda(ctx, "?vista=semana");
      await semana.waitForTimeout(300);
      await semana.close();
      const de_novo = await abrirAgenda(ctx, "");
      ok((await de_novo.locator('nav[aria-label="Vista da agenda"] [aria-current="page"]').innerText()).trim() === "Semana",
        "sem ?vista=, a agenda abre na última vista usada (Semana)");
      await de_novo.close();
      await ctx.close();
    }

    // c) a semana põe cada consulta no dia certo, e o pedido tracejado
    {
      const page = await abrirAgenda(pc, `?vista=semana&data=${diaSP(2)}`);
      const bloco = page.locator('button[title^="10:15 Beatriz"]');
      ok((await bloco.count()) === 1, "Semana: o pedido da Beatriz (daqui a 2 dias, 10:15) aparece na grade");
      const luiza = await page.locator('button[title^="10:00 Luiza"]').boundingBox();
      const bea = await bloco.first().boundingBox();
      ok(!!luiza && !!bea && bea.x >= luiza.x + luiza.width - 4,
        "Semana: Luiza 10:00 e Beatriz 10:15, que se sobrepõem, ficam lado a lado");
      const borda = await bloco.first().evaluate((el) => getComputedStyle(el).borderTopStyle).catch(() => "");
      ok(borda === "dashed", `Semana: pedido é tracejado (${borda})`);
      await page.close();
    }
    // d) o mês marca a pendência no dia da Joana (sem desfecho há 5 dias)
    {
      const page = await abrirAgenda(pc, `?vista=mes&data=${diaSP(-5)}`);
      // Só o link do calendário: o "Dia" da troca de vista aponta para o mesmo endereço.
      const dia = page.locator(`ol a[href="/app/agenda?vista=dia&data=${diaSP(-5)}"]`);
      ok(/pendência/.test((await dia.getAttribute("aria-label")) || ""), "Mês: o dia da consulta sem desfecho tem a marca de pendência");
      // A consulta aparece no dia com hora e nome, e não só "1 consulta" em
      // cinza, que o dono do produto não via; a pendência, tracejada.
      const joana = dia.locator('[title^="10:30 Joana"]');
      ok(await apareceu(joana), "Mês: o dia da Joana mostra a consulta com hora e nome");
      const borda = await joana.first().evaluate((el) => getComputedStyle(el).borderTopStyle).catch(() => "");
      ok(borda === "dashed", `Mês: a consulta sem desfecho é tracejada (${borda})`);
      await page.close();
    }
    // d2) amanhã: a remarcação do Carlos (09:00) e a 1ª consulta do Pedro (11:00), em ordem de hora
    {
      const page = await abrirAgenda(pc, `?vista=mes&data=${diaSP(1)}`);
      const dia = page.locator(`ol a[href="/app/agenda?vista=dia&data=${diaSP(1)}"]`);
      const pedro = dia.locator('[title^="11:00 Pedro"]');
      ok(await apareceu(pedro), "Mês: o dia de amanhã mostra a 1ª consulta do Pedro, 11:00");
      const borda = await pedro.first().evaluate((el) => getComputedStyle(el).borderTopStyle).catch(() => "");
      ok(borda !== "dashed", `Mês: consulta agendada não é tracejada (${borda})`);
      const titulos = await dia.locator("[title]").evaluateAll((els) => els.map((e) => e.getAttribute("title")));
      ok(
        titulos.length === 2 && titulos[0].startsWith("09:00 Carlos") && titulos[1].startsWith("11:00 Pedro"),
        "Mês: as consultas do dia saem em ordem de hora",
        JSON.stringify(titulos)
      );
      await page.close();
    }

    // e) aceitar o pedido da Beatriz pela linha de aviso
    {
      const page = await abrirAgenda(pc, "?vista=dia");
      await clicar(aviso(page).getByRole("button", { name: /Beatriz Rocha pediu consulta/ }));
      await janela(page).waitFor({ timeout: 30000 });
      ok((await textoDe(janela(page))).includes("Pode ser online?"), "o painel mostra o recado do pedido");
      await page.waitForFunction(() => document.querySelector("dialog[open]")?.textContent?.includes("Bate com"), null, { timeout: 30000 }).catch(() => {});
      ok((await textoDe(janela(page))).includes("Bate com 10:00 Luiza Prado"),
        "o painel do pedido avisa que o horário pedido bate com a consulta da Luiza", await textoDe(janela(page)));
      await clicar(janela(page).getByRole("button", { name: "Aceitar" }));
      await page.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 30000 });
      await page.waitForFunction(
        () => (document.querySelector('section[aria-labelledby="pendencias-agenda"]')?.textContent || "").includes("1 pedido aguardando"),
        null, { timeout: 30000 }
      ).catch(() => {});
      ok((await textoDe(aviso(page))).includes("1 pedido aguardando"), "Aceitar fecha o painel e o aviso passa a 1 pedido", await textoDe(aviso(page)));
      await page.close();
      const resumo = await abrir(pc, rota("beatriz"));
      ok(!(await textoDe(fila(resumo))).includes("Pediu uma consulta"), "depois de aceito, a fila da Beatriz não acusa mais o pedido");
      await resumo.close();
    }

    // f) Carlos: manter horário tira a pendência; a próxima consulta aparece
    {
      const page = await abrir(pc, aba("carlos", "consultas"));
      ok((await textoDe(page.locator("#consultas"))).includes("Prefiro sexta de manhã"), "Consultas do Carlos: o recado da remarcação aparece");
      await clicar(page.locator("#consultas").getByRole("button", { name: "Manter horário" }));
      await page.waitForFunction(() => !document.querySelector("#consultas")?.textContent?.includes("Precisa de você"), null, { timeout: 30000 }).catch(() => {});
      const txt = await textoDe(page.locator("#consultas"));
      ok(!txt.includes("Precisa de você") && txt.includes("Próxima consulta"), "Manter horário: some a pendência e fica a próxima consulta", txt.slice(0, 200));
      // O cabeçalho do paciente é o <header> com o nome (h1); o primeiro da
      // página é o do AppShell no celular, escondido no computador.
      ok((await textoDe(page.locator("header:has(h1)"))).includes("Próxima consulta"), "o cabeçalho do Carlos mostra a próxima consulta");
      await page.close();
    }

    // g) Joana: fechar a sem desfecho como realizada
    {
      const page = await abrir(pc, aba("joana", "consultas"));
      await clicar(page.locator("#consultas").getByRole("button", { name: "Realizada", exact: true }));
      await page.waitForFunction(() => !document.querySelector("#consultas")?.textContent?.includes("Precisa de você"), null, { timeout: 30000 }).catch(() => {});
      ok(!(await textoDe(page.locator("#consultas"))).includes("Precisa de você"), "Realizada tira a consulta da Joana das pendências");
      ok((await textoDe(page.locator("#consultas"))).includes("Sem retorno marcado"),
        "sem próxima consulta, a realizada sobe como 'Sem retorno marcado', com o Marcar retorno");
      // "Realizada" abre o formulário do retorno, e ele SOBREVIVE ao refresh
      // (a consulta muda de grupo, mas é o mesmo painel).
      const form = page.locator("#consultas form");
      ok((await form.count()) === 1 && (await textoDe(page.locator("#consultas"))).includes("Marcar retorno"),
        "depois de 'Realizada', o formulário do retorno continua aberto quando a página recarrega");
      await page.close();
      const resumo = await abrir(pc, rota("joana"));
      ok(!(await textoDe(fila(resumo))).includes("sem desfecho"), "a fila da Joana não acusa mais consulta sem desfecho");
      ok(/Desde a última consulta \(\d\d\/\d\d\)/.test(await textoDe(resumo.locator("body"))), "o Resumo da Joana passa a ter 'Desde a última consulta'");
      await resumo.close();
    }

    // g2) Luiza: a consulta que está acontecendo já oferece Realizada e Faltou
    {
      const page = await abrir(pc, aba("luiza", "consultas"));
      const proxima = page.locator("#consultas li:has(> h3:text-is('Próxima consulta'))");
      ok((await proxima.getByRole("button", { name: "Realizada", exact: true }).count()) === 1 &&
        (await proxima.getByRole("button", { name: "Faltou", exact: true }).count()) === 1,
        "consulta em andamento: Realizada e Faltou sem esperar o fim");
      await page.close();
    }

    // h) marcar consulta: sem paciente avisa; em cima da Luiza avisa o choque e salva
    {
      const d2 = diaSP(2);
      const page = await abrirAgenda(pc, `?vista=dia&data=${d2}`);
      await clicar(page.getByRole("button", { name: "Marcar consulta" }));
      const j = janela(page);
      await j.waitFor({ timeout: 30000 });
      await j.locator('input[type="time"]').fill("10:15");
      await clicar(j.getByRole("button", { name: "Marcar consulta" }));
      ok((await textoDe(j)).includes("Escolha o paciente."), "Marcar consulta sem paciente pede o paciente");
      await j.locator("select").first().selectOption({ label: "Pedro Alves" });
      await page.waitForFunction(() => document.querySelector("dialog[open]")?.textContent?.includes("Bate com"), null, { timeout: 30000 }).catch(() => {});
      ok((await textoDe(j)).includes("Bate com 10:00 Luiza Prado"), "o formulário avisa o choque com a consulta da Luiza", await textoDe(j));
      await clicar(j.getByRole("button", { name: "Marcar consulta" }));
      await page.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 30000 });
      await page.waitForFunction(() => document.body.textContent.includes("10:15"), null, { timeout: 30000 }).catch(() => {});
      const lista = await textoDe(page.locator("main"));
      ok(lista.includes("10:15") && lista.includes("Pedro Alves"), "choque avisa e não impede: a consulta do Pedro às 10:15 entra no dia");
      await page.close();
    }

    // i) no celular, a seta mostra que há aba escondida e rola até Consultas
    {
      const page = await abrir(cel, rota("beatriz"));
      const seta = page.locator('[data-mais-abas="depois"]');
      ok(await seta.isVisible(), "celular: a barra de abas mostra a seta de que há mais abas");
      await seta.click();
      await page.waitForTimeout(600);
      const caixa = await page.getByRole("link", { name: "Consultas", exact: true }).boundingBox();
      ok(!!caixa && caixa.x + caixa.width <= 390, `celular: depois da seta, a aba Consultas fica na tela (${caixa && Math.round(caixa.x + caixa.width)}px)`);
      await page.close();
    }
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

  // =====================================================================
  // 16. Registro da consulta: o rascunho
  // =====================================================================
  console.log("\nVerificação 16: registro da consulta (rascunho)");
  etapa = "registro";
  {
    // Do mock (ferramentas/LEIAME.md): ap-13 é a consulta da Luiza em
    // andamento (começou há 10 min, retorno, sem registro); ap-3 é a de 14 dias
    // atrás, com registro concluído, a medida de 66,4 kg e o "observar".
    const EM_ANDAMENTO = "ap-13";
    const CONCLUIDA = "ap-3";
    const OBSERVAR = "Adesão no fim de semana. Testar café da manhã com ovos.";
    const registro = (k, c) => `${rota(k)}/consultas/${c}`;
    const ddmm = (n) => diaBR(n).slice(0, 5);
    /** O registro da consulta como está no mock agora (o "banco"). */
    const noMock = async (consulta) =>
      (await (await fetch(`${MOCK}/rest/v1/consultation_records?appointment_id=eq.${consulta}`)).json())[0] ?? null;
    const titulo = (page) => page.getByRole("heading", { level: 1, name: /^Consulta de / });
    const contextoDe = (page) => page.locator('aside[aria-label="Para esta consulta"]');
    const status = (page) => page.locator("[data-status-rascunho]");
    const selo = (page) => page.getByText("Rascunho", { exact: true });

    // a) a consulta em andamento, sem registro: título, "Evolução" e nenhum selo
    const page = await abrir(pc, registro("luiza", EM_ANDAMENTO), { secoes: false });
    const carregou = await apareceu(titulo(page), 30000);
    ok(carregou, `a página do registro abre (${registro("luiza", EM_ANDAMENTO)})`);
    if (!carregou) {
      ok(false, "o resto da Verificação 16 não rodou: a página do registro não abriu");
      await page.close();
    } else {
      ok(/^Consulta de \S+, \d\d\/\d\d às \d\d:\d\d$/.test((await textoDe(titulo(page))).trim()),
        `o título diz o dia e a hora ("${(await textoDe(titulo(page))).trim()}")`);
      ok((await page.title()) === "Registro · Paciente · Pace Fit", `o título da aba do navegador (${await page.title()})`);
      const evolucao = page.getByLabel("Evolução", { exact: true });
      ok((await evolucao.count()) === 1, 'retorno: a primeira parte se chama "Evolução"');
      ok((await selo(page).count()) === 0, "sem registro, a página não mostra o selo Rascunho antes de digitar");
      ok(!(await noMock(EM_ANDAMENTO)), "e o mock não tem registro desta consulta (abrir não cria rascunho)");
      const m = await transbordo(page);
      ok(m.doc <= m.larg, `registro sem transbordo no computador (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));

      // b) digitar: "Salvando…" e depois "Salvo às"; a segunda digitação chega
      //    com a primeira gravação em voo (a resposta segura 3 s) e vira a
      //    próxima, com o updated_at que a primeira devolveu.
      const pedidos = [];
      const respostas = [];
      let segurar = true;
      await page.route("**/rest/v1/rpc/salvar_registro", async (route) => {
        pedidos.push(route.request().postDataJSON());
        const resposta = await route.fetch();
        respostas.push(await resposta.json());
        if (segurar) {
          segurar = false;
          await new Promise((r) => setTimeout(r, 3000));
        }
        await route.fulfill({ response: resposta });
      });
      await pronto(evolucao);
      await evolucao.click();
      await evolucao.pressSequentially("Primeira parte.");
      ok(await apareceu(status(page).getByText("Salvando…"), 10000), 'digitar na Evolução mostra "Salvando…"');
      ok(!(await status(page).innerText()).includes("Salvo às"), "a primeira gravação ainda está em voo quando a segunda digitação começa");
      await evolucao.pressSequentially(" Segunda parte.");
      await page.waitForFunction(
        () => /Salvo às/.test(document.querySelector("[data-status-rascunho]")?.textContent || ""),
        null, { timeout: 30000 }
      ).catch(() => {});
      // Espera a segunda gravação terminar (o "Salvo às" da primeira pode vir antes).
      for (let i = 0; i < 100 && !(respostas.length >= 2 && /Salvo às/.test(await status(page).innerText())); i++)
        await page.waitForTimeout(100);
      ok(/Salvo às \d\d:\d\d/.test(await status(page).innerText()), `depois aparece "Salvo às" (${await status(page).innerText()})`);
      ok(pedidos.length === 2, `duas gravações, uma depois da outra (${pedidos.length})`);
      ok(pedidos[0]?.p_visto_em === null, "a primeira gravação cria o rascunho (p_visto_em nulo)");
      ok(!!respostas[0]?.updated_at && pedidos[1]?.p_visto_em === respostas[0].updated_at,
        "a segunda vai com o updated_at exato que a primeira devolveu",
        `${pedidos[1]?.p_visto_em} x ${respostas[0]?.updated_at}`);
      const salvo = await noMock(EM_ANDAMENTO);
      ok(salvo?.anamnese === "Primeira parte. Segunda parte.",
        "digitar durante o salvamento: as duas partes do texto estão no mock", JSON.stringify(salvo?.anamnese));
      ok(!(await textoDe(page.locator("body"))).includes("mudou em outra aba"), 'e não aparece "mudou em outra aba"');
      ok(await selo(page).isVisible(), "depois de digitar, o selo Rascunho aparece");
      await page.unrouteAll({ behavior: "ignoreErrors" });

      // c) recarregar: o texto volta do banco
      await page.reload({ waitUntil: "load" });
      await titulo(page).waitFor({ timeout: 60000 });
      ok((await page.getByLabel("Evolução", { exact: true }).inputValue()) === "Primeira parte. Segunda parte.",
        "recarregar a página traz o texto de volta do banco");

      // c2) o Voltar do navegador devolve a página do cache do roteador do
      //     Next, montada ANTES desta digitação: o editor confere o banco ao
      //     abrir e segue de onde parou, sem "mudou em outra aba".
      {
        const ateNoMock = async (texto) => {
          for (let i = 0; i < 60 && (await noMock(EM_ANDAMENTO))?.anamnese !== texto; i++) await page.waitForTimeout(100);
          return (await noMock(EM_ANDAMENTO))?.anamnese === texto;
        };
        const ev = page.getByLabel("Evolução", { exact: true });
        await clicar(ev);
        await ev.press("End");
        await ev.pressSequentially(" Terceira parte.");
        await ateNoMock("Primeira parte. Segunda parte. Terceira parte.");
        await page.waitForFunction(() => /Salvo às/.test(document.querySelector("[data-status-rascunho]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
        await clicar(contextoDe(page).locator(`a[href="${registro("luiza", CONCLUIDA)}"]`));
        await page.waitForURL((u) => u.pathname.endsWith(`/consultas/${CONCLUIDA}`), { timeout: 30000 });
        await page.goBack();
        await page.waitForURL((u) => u.pathname.endsWith(`/consultas/${EM_ANDAMENTO}`), { timeout: 30000 });
        await titulo(page).waitFor({ timeout: 60000 });
        // `:disabled`, e não a propriedade `disabled`: dentro de um fieldset
        // desligado a propriedade continua falsa (e a espera não esperava).
        await page.waitForFunction(() => {
          const t = document.querySelector("textarea");
          return t && !t.matches(":disabled");
        }, null, { timeout: 30000 }).catch(() => {});
        ok((await ev.inputValue()) === "Primeira parte. Segunda parte. Terceira parte.",
          "Voltar do navegador: a Evolução tem o texto que estava no banco, e não o do cache", JSON.stringify(await ev.inputValue()));
        await clicar(ev);
        await ev.press("End");
        await ev.pressSequentially(" Quarta parte.");
        ok(await ateNoMock("Primeira parte. Segunda parte. Terceira parte. Quarta parte."),
          "e a digitação seguinte grava", JSON.stringify((await noMock(EM_ANDAMENTO))?.anamnese));
        await page.waitForFunction(() => /Salvo às/.test(document.querySelector("[data-status-rascunho]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
        ok(/Salvo às/.test(await status(page).innerText()) && !(await textoDe(page.locator("body"))).includes("mudou em outra aba"),
          'com "Salvo às" e sem "mudou em outra aba"', await status(page).innerText());
      }

      // d) o "antes" do peso é o da consulta de 14 dias atrás; IMC com a altura do perfil (168 cm)
      const peso = campo(page, "Peso (kg)");
      ok((await textoDe(peso)).includes(`antes 66,4 em ${ddmm(14)}`),
        `embaixo do Peso: "antes 66,4 em ${ddmm(14)}"`, await textoDe(peso));
      const campoPeso = peso.locator("input");
      ok((await campoPeso.getAttribute("inputmode")) === "decimal", "o peso abre o teclado numérico (inputmode decimal)");
      await pronto(campoPeso);
      await campoPeso.fill("718");
      await campoPeso.blur();
      ok(await apareceu(peso.getByText("Peso fora da faixa (20 a 400 kg)."), 5000), "peso 718 marca o campo com a faixa");
      ok((await campoPeso.getAttribute("aria-invalid")) === "true", "e o campo fica aria-invalid");
      await campoPeso.fill("65,6");
      await campoPeso.blur();
      const imc = page.locator("[data-imc]");
      ok((await textoDe(imc)).includes("IMC 23,2") && (await textoDe(imc)).includes("168 cm"),
        `IMC com a altura do perfil: 65,6 kg e 168 cm dão 23,2 (${await textoDe(imc)})`);
      ok((await campoPeso.getAttribute("aria-invalid")) !== "true", "corrigido, o campo deixa de ser inválido");
      for (let i = 0; i < 50 && (await noMock(EM_ANDAMENTO))?.medidas?.weight_kg !== 65.6; i++) await page.waitForTimeout(100);
      ok((await noMock(EM_ANDAMENTO))?.medidas?.weight_kg === 65.6, "sair do campo salva o peso (65,6 no mock)",
        JSON.stringify((await noMock(EM_ANDAMENTO))?.medidas));

      // d1) medida inválida não apaga a que já estava salva, e o topo não diz "Salvo às"
      {
        await campoPeso.fill("6x");
        await campoPeso.blur();
        await page.waitForTimeout(800);
        ok((await noMock(EM_ANDAMENTO))?.medidas?.weight_kg === 65.6,
          'peso "6x" não apaga o 65,6 que estava salvo', JSON.stringify((await noMock(EM_ANDAMENTO))?.medidas));
        const s = await status(page).innerText();
        ok(!s.includes("Salvo às") && s.includes("não salvo"), `com o campo inválido, o topo diz que não salvou ("${s}")`);
        await campoPeso.fill("65,6");
        await campoPeso.blur();
        await page.waitForFunction(() => /Salvo às/.test(document.querySelector("[data-status-rascunho]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
        ok(/Salvo às/.test(await status(page).innerText()), `corrigido, volta o "Salvo às" (${await status(page).innerText()})`);
      }

      // d2) gravação que falha (aqui, "ok" sem updated_at) não perde o texto,
      //     e "Tentar de novo" grava; sair com alteração fora do banco avisa.
      {
        let falhar = true;
        await page.route("**/rest/v1/rpc/salvar_registro", async (route) => {
          if (!falhar) return route.continue();
          falhar = false;
          return route.fulfill({
            status: 200, contentType: "application/json",
            headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true }),
          });
        });
        const diag = page.getByLabel("Diagnóstico nutricional", { exact: true });
        await diag.fill("Eutrofia.");
        await diag.blur();
        ok(await apareceu(page.getByRole("alert").filter({ hasText: "Não foi possível salvar" }), 10000),
          'gravação "ok" sem updated_at conta como falha: "Não foi possível salvar"');
        ok((await diag.inputValue()) === "Eutrofia." && (await noMock(EM_ANDAMENTO))?.diagnostico !== "Eutrofia.",
          "e o texto continua no campo, fora do banco");
        await clicar(page.getByRole("button", { name: "Tentar de novo" }));
        for (let i = 0; i < 50 && (await noMock(EM_ANDAMENTO))?.diagnostico !== "Eutrofia."; i++) await page.waitForTimeout(100);
        ok((await noMock(EM_ANDAMENTO))?.diagnostico === "Eutrofia.", '"Tentar de novo" grava o que tinha falhado');
        await page.unrouteAll({ behavior: "ignoreErrors" });

        await page.getByLabel("Observar no retorno", { exact: true }).fill("Água.");
        let aviso = "";
        page.once("dialog", async (d) => {
          aviso = d.type();
          await d.dismiss();
        });
        // Antes dos 1,5 s: a alteração ainda não foi para o banco.
        await page.close({ runBeforeUnload: true });
        await page.waitForTimeout(500);
        ok(aviso === "beforeunload", `fechar a página com alteração não gravada cai no aviso do navegador (${aviso || "sem aviso"})`);
        for (let i = 0; i < 50 && (await noMock(EM_ANDAMENTO))?.observar !== "Água."; i++) await page.waitForTimeout(100);
        ok((await noMock(EM_ANDAMENTO))?.observar === "Água.", "quem fica na página tem a alteração gravada logo depois");
      }

      // e) a coluna "Para esta consulta": o "observar" do registro de 14 dias atrás
      const ctxTxt = await textoDe(contextoDe(page));
      ok(ctxTxt.includes(OBSERVAR) && ctxTxt.includes(`registro de ${ddmm(14)}`),
        `"Para esta consulta" mostra o "Observar no retorno" do registro de ${ddmm(14)}`, ctxTxt);
      ok(ctxTxt.includes(`Desde a última consulta (${ddmm(14)})`), '"Para esta consulta" tem o "desde a última consulta"', ctxTxt);
      ok(ctxTxt.includes("65,4 kg"), "e a última medida que a paciente lançou em casa (65,4 kg)", ctxTxt);
      ok((await contextoDe(page).locator(`a[href="${registro("luiza", CONCLUIDA)}"]`).count()) === 1,
        "e o registro anterior, com link");
      for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
        const ctx = await contexto(browser, COMPUTADOR, escuro, estado);
        const p = await abrir(ctx, registro("luiza", EM_ANDAMENTO), { secoes: false });
        await titulo(p).waitFor({ timeout: 60000 });
        await fotografar(p, `${OUT}/registro-rascunho-desktop-${tema}.png`, COMPUTADOR);
        await p.close();
        await ctx.close();
      }
      await page.close();

      // f) celular: sem transbordo; o contexto recolhido, com o "observar" à vista
      for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
        const ctx = await contexto(browser, CELULAR, escuro, estado);
        const p = await abrir(ctx, registro("luiza", EM_ANDAMENTO), { secoes: false });
        await titulo(p).waitFor({ timeout: 60000 });
        const mc = await transbordo(p);
        ok(mc.doc <= mc.larg, `registro sem transbordo no celular, ${tema} (documento ${mc.doc}px, janela ${mc.larg}px)`, mc.vaza.join(" | "));
        if (!escuro) {
          ok(await p.getByText(OBSERVAR).isVisible(), 'celular: o "Observar no retorno" fica à vista');
          const botao = contextoDe(p).getByRole("button", { name: /Para esta consulta/ });
          ok((await botao.getAttribute("aria-expanded")) === "false", "celular: o resto do contexto começa recolhido");
          ok(!(await contextoDe(p).getByText(/Desde a última consulta/).isVisible()), 'celular: recolhido, o "desde a última" não aparece');
          await clicar(botao);
          ok(await apareceu(contextoDe(p).getByText(/Desde a última consulta/), 5000), "celular: tocar abre o contexto");
          await clicar(botao);
        }
        await fotografar(p, `${OUT}/registro-rascunho-mobile-${tema}.png`, CELULAR);
        await p.close();
        await ctx.close();
      }

      // g) sem vínculo, consulta de outro paciente, registro concluído e leitura que falha
      {
        const p = await abrir(pc, "/app/pacientes/00000000-0000-0000-0000-000000000000/consultas/ap-13", { secoes: false });
        ok(await apareceu(p.getByText("Sem acesso a este paciente"), 30000), 'registro de paciente sem vínculo: "Sem acesso a este paciente"');
        ok((await p.locator("textarea").count()) === 0, "e nenhum campo do registro");
        await p.close();
      }
      {
        // notFound() chega como o conteúdo do 404, não como o código: o
        // loading.tsx de pacientes/[id] já mandou o começo da página (200)
        // quando a consulta se mostra de outro paciente. Pelo request do
        // contexto (com os cookies do login), sem abrir o navegador.
        for (const [k, c, oQue] of [
          ["beatriz", EM_ANDAMENTO, "consulta de outro paciente"],
          ["luiza", "ap-que-nao-existe", "consulta que não existe"],
        ]) {
          const html = await (await pc.request.get(APP + registro(k, c))).text();
          ok(html.includes("This page could not be found") && !html.includes("<textarea"),
            `${oQue}: a página de "não encontrada", sem o formulário`);
        }
      }
      {
        const p = await abrir(pc, registro("luiza", CONCLUIDA), { secoes: false });
        await titulo(p).waitFor({ timeout: 60000 });
        // A única caixa de texto de um registro concluído é a do novo adendo (Verificação 17).
        ok((await p.locator("main input").count()) === 0 && (await p.locator("textarea").count()) === 1 &&
          (await p.getByLabel("Novo adendo", { exact: true }).count()) === 1,
          "registro concluído: sem campos de edição das cinco partes");
        await p.close();
      }
      {
        // ap-11: a 1ª consulta do Pedro, amanhã; ap-5: a 1ª da Beatriz, realizada há 30 dias, sem registro.
        const p = await abrir(pc, registro("pedro", "ap-11"), { secoes: false });
        await titulo(p).waitFor({ timeout: 60000 });
        ok((await p.locator("textarea").count()) === 0 && (await textoDe(p.locator("main"))).includes("ainda não começou"),
          "consulta que ainda não começou: diz isso, sem formulário que o banco recusaria");
        await p.close();
        // ap-6: o pedido da Beatriz (daqui a 2 dias), ainda não aceito.
        const pedido = await abrir(pc, registro("beatriz", "ap-6"), { secoes: false });
        await titulo(pedido).waitFor({ timeout: 60000 });
        ok((await textoDe(pedido.locator("main"))).includes("Pedido de consulta ainda não aceito"),
          "pedido: diz que não foi aceito, e não que ainda não começou");
        await pedido.close();
        const q = await abrir(pc, registro("beatriz", "ap-5"), { secoes: false });
        await titulo(q).waitFor({ timeout: 60000 });
        ok((await q.getByLabel("Anamnese", { exact: true }).count()) === 1, '1ª consulta: a primeira parte se chama "Anamnese"');
        await q.close();
      }

      // h) Descartar rascunho pergunta antes, apaga no banco e volta para a aba Consultas
      {
        const p = await abrir(pc, registro("luiza", EM_ANDAMENTO), { secoes: false });
        const descartar = p.getByRole("button", { name: "Descartar rascunho" });
        let pergunta = "";
        p.once("dialog", (d) => {
          pergunta = d.message();
          d.dismiss();
        });
        await clicar(descartar);
        await p.waitForTimeout(500);
        ok(/Descartar o rascunho/.test(pergunta), `"Descartar rascunho" pergunta antes ("${pergunta}")`);
        ok(!!(await noMock(EM_ANDAMENTO)), "quem cancela fica com o rascunho");
        p.once("dialog", (d) => d.accept());
        await clicar(descartar);
        await p.waitForURL((u) => u.searchParams.get("aba") === "consultas", { timeout: 30000 }).catch(() => {});
        ok(new URL(p.url()).searchParams.get("aba") === "consultas", `quem confirma volta para a aba Consultas (${p.url()})`);
        ok(!(await noMock(EM_ANDAMENTO)), "e o rascunho sai do mock");
        await p.close();
      }

      // i) leitura do registro que falha: só o erro, nunca o formulário em branco
      {
        await fetch(MOCK + "/__falhar", { method: "POST", body: JSON.stringify({ tabela: "consultation_records" }) });
        const p = await abrir(pc, registro("joana", "ap-10"), { secoes: false });
        ok(await apareceu(p.getByText(/Não foi possível carregar/), 30000), "registro que não carrega mostra o erro");
        ok((await p.locator("textarea").count()) === 0, "e nenhum campo em branco por cima do rascunho que não se vê");
        await p.close();
        await fetch(MOCK + "/__reset", { method: "POST" });
      }
    }
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

  // =====================================================================
  // 17. Registro da consulta: concluir, registro concluído e adendo
  // =====================================================================
  console.log("\nVerificação 17: registro da consulta (concluir, concluído e adendo)");
  etapa = "registro concluído";
  {
    // ap-13: a consulta da Luiza em andamento, sem registro (peso de 14 dias
    // atrás: 66,4 kg, na consulta ap-3, que tem registro concluído e um adendo).
    const EM_ANDAMENTO = "ap-13";
    const CONCLUIDA = "ap-3";
    const registro = (k, c) => `${rota(k)}/consultas/${c}`;
    const REGISTRO_API = `${MOCK}/rest/v1/consultation_records?appointment_id=eq.`;
    const noMock = async (consulta) => (await (await fetch(REGISTRO_API + consulta)).json())[0] ?? null;
    const doMock = async (tabela, filtro) => (await fetch(`${MOCK}/rest/v1/${tabela}?${filtro}`)).json();
    const diaNoMock = (instante) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instante));
    const ddmm = (n) => diaBR(n).slice(0, 5);
    const titulo = (page) => page.getByRole("heading", { level: 1, name: /^Consulta de / });
    const status = (page) => page.locator("[data-status-rascunho]");
    const dialogo = (page) => page.getByRole("dialog", { name: "Concluir o registro?" });
    const confirmar = (page) => dialogo(page).getByRole("button", { name: /^Conclu/ });
    const botaoDaPagina = (page) => page.getByRole("button", { name: "Concluir registro", exact: true });
    // `:disabled`, e não a propriedade `disabled`: dentro de um fieldset
    // desligado a propriedade continua falsa.
    const campoLivre = (page) => page.waitForFunction(() => {
      const t = document.querySelector("textarea");
      return !!t && !t.matches(":disabled");
    }, null, { timeout: 30000 }).then(() => true, () => false);
    const salvouTudo = (page) => page.waitForFunction(
      () => /Salvo às/.test(document.querySelector("[data-status-rascunho]")?.textContent || ""), null, { timeout: 30000 }
    ).then(() => true, () => false);
    const abrirConclusao = async (page) => {
      await clicar(botaoDaPagina(page));
      return apareceu(dialogo(page), 10000);
    };
    const voltar = async (page) => {
      await dialogo(page).getByRole("button", { name: "Voltar" }).click();
      await dialogo(page).waitFor({ state: "hidden", timeout: 10000 });
    };
    const semEspaco = (t) => t.replace(/\s+/g, " ").trim();
    /** Resposta de função do banco inventada pela verificação (o mock não recusa isso sozinho). */
    const recusa = (error) => ({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: false, error }),
    });

    // a) a conferência do banco ao abrir tem prazo: uma leitura que não volta
    //    não deixa o formulário desligado para sempre.
    {
      const p = await pc.newPage();
      espiar(p);
      let segurando = false;
      await p.route("**/rest/v1/consultation_records**", async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        segurando = true;
        await new Promise((r) => setTimeout(r, 11000));
        segurando = false;
        await route.continue();
      });
      await p.goto(APP + registro("luiza", EM_ANDAMENTO), { waitUntil: "load", timeout: 120000 });
      await titulo(p).waitFor({ timeout: 60000 });
      const liberou = await campoLivre(p);
      ok(liberou && segurando, "a conferência do banco ao abrir tem prazo: o formulário libera com a leitura ainda sem resposta");
      ok(!(await status(p).innerText()).includes("Conferindo"), 'e o topo deixa de dizer "Conferindo o rascunho…"', await status(p).innerText());
      for (let i = 0; i < 150 && segurando; i++) await p.waitForTimeout(100);
      ok(!(await status(p).innerText()).includes("Conferindo") && !(await p.locator("textarea").first().isDisabled()),
        "a resposta que chega depois do prazo não desliga o formulário de novo");
      await p.close();
    }

    // b) concluir: o diálogo, o CRN, a faixa, o salvamento em voo e o duplo clique
    const page = await abrir(pc, registro("luiza", EM_ANDAMENTO), { secoes: false });
    await titulo(page).waitFor({ timeout: 60000 });
    let chamadas = 0;
    page.on("request", (r) => { if (r.url().includes("/rpc/concluir_registro")) chamadas++; });
    await campoLivre(page);
    ok(await botaoDaPagina(page).isDisabled(), '"Concluir registro" fica desabilitado enquanto não há nada escrito');
    const evolucao = page.getByLabel("Evolução", { exact: true });
    await evolucao.fill("Retorno em dia. Boa adesão ao cardápio.");
    ok(await botaoDaPagina(page).isEnabled(), "e libera com uma parte preenchida");
    const peso = campo(page, "Peso (kg)").locator("input");
    await peso.fill("65,6");
    await peso.blur();
    await salvouTudo(page);

    ok(await abrirConclusao(page), '"Concluir registro" abre o diálogo');
    const d = dialogo(page);
    const dTxt = semEspaco(await textoDe(d));
    ok(/não pode ser editado nem apagado/.test(dTxt) && /“medida na consulta”/.test(dTxt) && /fica marcada como realizada/.test(dTxt),
      "o diálogo diz o que muda: trava, medidas no histórico e consulta realizada", dTxt);
    ok(dTxt.includes("Confira as medidas") && dTxt.includes("Peso 65,6 kg"), "e mostra as medidas para conferir (Peso 65,6 kg)", dTxt);
    ok(await d.getByLabel("Seu CRN").isVisible(), 'o nutri do mock não tem CRN: o diálogo pede "Seu CRN"');
    const mDlg = await transbordo(page);
    ok(mDlg.doc <= mDlg.larg, `diálogo de concluir sem transbordo no computador (documento ${mDlg.doc}px, janela ${mDlg.larg}px)`, mDlg.vaza.join(" | "));
    await fotografar(page, `${OUT}/registro-concluir-desktop-claro.png`, COMPUTADOR);

    // sem CRN: a recusa é do banco, e o diálogo fica aberto com o texto dela
    await clicar(confirmar(page));
    ok(await apareceu(d.getByText("Informe o seu CRN para concluir."), 10000),
      'concluir sem CRN: o diálogo mostra "Informe o seu CRN para concluir."');
    ok(chamadas === 1 && (await noMock(EM_ANDAMENTO))?.status === "rascunho",
      `e o registro continua rascunho (${chamadas} chamada ao banco)`);
    await voltar(page);

    // peso 718: a tela diz a faixa e nem chama o banco
    await peso.fill("718");
    await peso.blur();
    ok(await abrirConclusao(page), "com o peso inválido o diálogo abre do mesmo jeito");
    ok(semEspaco(await textoDe(d)).includes("Peso “718”"), "e marca a medida que não vale na conferência", semEspaco(await textoDe(d)));
    await d.getByLabel("Seu CRN").fill("CRN-3 12345");
    await clicar(confirmar(page));
    ok(await apareceu(d.getByText("Peso fora da faixa (20 a 400 kg)."), 10000),
      'peso 718: o diálogo mostra "Peso fora da faixa (20 a 400 kg)."');
    ok(chamadas === 1, `e o banco não é chamado (${chamadas} chamada no total)`);
    ok((await noMock(EM_ANDAMENTO))?.medidas?.weight_kg === 65.6, "e o peso 718 não foi para o banco (continua 65,6)");
    await voltar(page);
    await peso.fill("65,6");
    await peso.blur();
    await salvouTudo(page);

    // a Conduta ainda está sendo gravada (resposta segurada) quando se confirma;
    // o duplo clique no botão conclui uma vez só
    const respostas = [];
    const pedidosConcluir = [];
    page.on("request", (r) => { if (r.url().includes("/rpc/concluir_registro")) pedidosConcluir.push(r.postDataJSON()); });
    await page.route("**/rest/v1/rpc/salvar_registro", async (route) => {
      const resposta = await route.fetch();
      respostas.push(await resposta.json());
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({ response: resposta });
    });
    // A conclusão em si também demora a responder: o diálogo tem de continuar
    // lá, ocupado, e não parecer cancelável enquanto algo irreversível corre.
    await page.route("**/rest/v1/rpc/concluir_registro", async (route) => {
      const resposta = await route.fetch();
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({ response: resposta });
    });
    const conduta = page.getByLabel("Conduta", { exact: true });
    await conduta.fill("Manter o plano de 1.800 kcal.");
    await conduta.blur();
    ok(await abrirConclusao(page), "concluir com uma gravação ainda em voo");
    await d.getByLabel("Seu CRN").fill("CRN-3 12345");
    await confirmar(page).dblclick();
    {
      // "Concluindo…": Esc (duas vezes: o Chrome fecha na segunda mesmo com o
      // cancel impedido), clique no fundo escuro e o X não fecham.
      ok(await apareceu(d.getByRole("button", { name: "Concluindo…" }), 5000), 'o botão passa a "Concluindo…"');
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      ok(await d.getByRole("button", { name: "Fechar" }).isDisabled({ timeout: 2000 }).catch(() => false), 'durante "Concluindo…" o X do diálogo fica desabilitado');
      await page.waitForTimeout(300);
      ok(await page.evaluate(() => !!document.querySelector("dialog")?.open) && (await d.isVisible()),
        'durante "Concluindo…" Esc e o clique no fundo não fecham o diálogo');
    }
    ok(await page.waitForFunction(() => /Concluído em/.test(document.body.innerText), null, { timeout: 40000 }).then(() => true, () => false),
      "concluir com o CRN: a página vira registro concluído");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    ok(pedidosConcluir.length === 1, `o duplo clique conclui uma vez só (${pedidosConcluir.length} chamadas)`);
    ok(!!respostas.at(-1)?.updated_at && pedidosConcluir[0]?.p_visto_em === respostas.at(-1).updated_at,
      "a conclusão vai com o updated_at exato da última gravação (a que estava em voo)",
      `${pedidosConcluir[0]?.p_visto_em} x ${respostas.at(-1)?.updated_at}`);
    ok(pedidosConcluir[0]?.p_crn === "CRN-3 12345", "e com o CRN digitado");
    const concluido = await noMock(EM_ANDAMENTO);
    ok(concluido?.status === "concluido" && concluido?.conduta === "Manter o plano de 1.800 kcal.",
      "o que estava em voo entrou no registro concluído", JSON.stringify(concluido?.conduta));

    // c) o registro concluído
    const main = page.locator("main");
    const txt = semEspaco(await textoDe(main));
    ok(new RegExp(`Concluído em ${diaBR(0)} às \\d\\d:\\d\\d por Ricardo Albuquerque · CRN-3 12345`).test(txt),
      'o topo diz "Concluído em … às … por Ricardo Albuquerque · CRN-3 12345"', txt.slice(0, 300));
    ok(txt.includes("Retorno em dia. Boa adesão ao cardápio.") && txt.includes("Manter o plano de 1.800 kcal.") &&
      /Evolução/.test(txt) && /Diagnóstico nutricional/.test(txt) && /Observar no retorno/.test(txt),
      "as partes aparecem para leitura");
    ok((await main.locator("input").count()) === 0 && (await page.locator("textarea").count()) === 1 &&
      (await page.getByLabel("Novo adendo", { exact: true }).count()) === 1,
      "sem campos de edição: a única caixa de texto é a do novo adendo");
    ok(txt.includes("−0,8") && txt.includes(`desde ${ddmm(14)}`), `a medida traz a diferença para a consulta anterior (−0,8 desde ${ddmm(14)})`, txt);
    ok(/IMC 23,2/.test(txt) && txt.includes("168 cm"), "e o IMC com a altura do perfil (23,2 com 168 cm)");
    const mC = await transbordo(page);
    ok(mC.doc <= mC.larg, `registro concluído sem transbordo no computador (documento ${mC.doc}px, janela ${mC.larg}px)`, mC.vaza.join(" | "));
    await fotografar(page, `${OUT}/registro-concluido-desktop-claro.png`, COMPUTADOR);

    // d) o que ficou no banco
    const consultaNoMock = (await doMock("appointments", `id=eq.${EM_ANDAMENTO}`))[0];
    ok(consultaNoMock?.status === "realizada", "no mock a consulta virou realizada", consultaNoMock?.status);
    const medidasNoMock = await doMock("body_measurements", `appointment_id=eq.${EM_ANDAMENTO}`);
    const diaDaConsulta = consultaNoMock ? diaNoMock(consultaNoMock.starts_at) : "";
    ok(medidasNoMock.length === 1 && medidasNoMock[0].date === diaDaConsulta && medidasNoMock[0].weight_kg === 65.6 &&
      medidasNoMock[0].measured_by === cen.nutri,
      `e a medida tem a data da consulta em São Paulo (${diaDaConsulta}) e o autor`, JSON.stringify(medidasNoMock));
    const perfilNoMock = (await doMock("profiles", `id=eq.${cen.nutri}`))[0];
    ok(perfilNoMock?.crn === "CRN-3 12345", "o CRN ficou no perfil do nutri", String(perfilNoMock?.crn));

    // e) o adendo: vazio não salva; o que o banco recusa aparece; o certo entra na lista
    const novo = page.getByLabel("Novo adendo", { exact: true });
    const salvarAdendo = page.getByRole("button", { name: "Salvar adendo" });
    ok(txt.includes("Nenhum adendo"), "sem adendo, a lista diz que não há");
    ok(await salvarAdendo.isDisabled(), '"Novo adendo" vazio não salva: o botão fica desabilitado');
    await novo.fill("   \n  ");
    ok(await salvarAdendo.isDisabled(), "e só com espaços também");
    await page.route("**/rest/v1/rpc/adicionar_adendo", (route) => route.fulfill(recusa("Escreva o adendo (até 5.000 caracteres).")));
    await novo.fill("Texto que o banco recusa.");
    await clicar(salvarAdendo);
    ok(await apareceu(page.getByText("Escreva o adendo (até 5.000 caracteres)."), 10000),
      "a recusa do banco aparece ao lado do campo");
    ok((await novo.inputValue()) === "Texto que o banco recusa.", "e o texto continua no campo");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const ADENDO = "A paciente mandou o exame de glicemia em jejum: 98 mg/dL. Sem mudança na conduta.";
    await novo.fill(ADENDO);
    await clicar(salvarAdendo);
    const artigo = page.locator("article", { hasText: ADENDO });
    ok(await apareceu(artigo, 15000), "o adendo aparece na lista");
    const aTxt = semEspaco(await textoDe(artigo));
    ok(new RegExp(`${diaBR(0)} às \\d\\d:\\d\\d · Ricardo Albuquerque · CRN-3 12345`).test(aTxt),
      "com a data, a hora, o nome e o CRN de quem assinou", aTxt);
    for (let i = 0; i < 50 && (await novo.inputValue()) !== ""; i++) await page.waitForTimeout(100);
    ok((await novo.inputValue()) === "", "e o campo esvazia depois que o adendo entra");
    ok((await doMock("consultation_addenda", `record_id=eq.${concluido.id}`)).length === 1, "no mock o adendo é do registro");
    await page.close();

    // f) um registro concluído de verdade (o do mock): assinatura e adendo de datas antigas, sem "desde"
    {
      const p = await abrir(pc, registro("luiza", CONCLUIDA), { secoes: false });
      await titulo(p).waitFor({ timeout: 60000 });
      const t = semEspaco(await textoDe(p.locator("main")));
      ok(t.includes(`Concluído em ${diaBR(14)} às 10:52 por Ricardo Albuquerque · CRN-3 12345`),
        `o registro de ap-3 diz quando e quem concluiu (${diaBR(14)} às 10:52)`, t.slice(0, 300));
      ok(t.includes("Peso 66,4 kg") || /Peso\s*66,4 kg/.test(t), "e mostra o peso de 66,4 kg");
      ok(!t.includes("desde"), "sem medida de consulta anterior, não há diferença para mostrar");
      ok(t.includes("Correção da conduta: o retorno é em 21 dias") && t.includes(`${diaBR(9)} às 16:20 · Ricardo Albuquerque · CRN-3 12345`),
        "o adendo que já existia aparece com a data dele e a assinatura");
      await p.close();
    }

    // g) prints do concluído (escuro no computador; claro e escuro no celular)
    for (const [tema, escuro, disp] of [["escuro", true, COMPUTADOR], ["claro", false, CELULAR], ["escuro", true, CELULAR]]) {
      const ctx = await contexto(browser, disp, escuro, estado);
      const p = await abrir(ctx, registro("luiza", EM_ANDAMENTO), { secoes: false });
      await titulo(p).waitFor({ timeout: 60000 });
      const m = await transbordo(p);
      ok(m.doc <= m.larg, `registro concluído sem transbordo: ${disp.nome}/${tema} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      await fotografar(p, `${OUT}/registro-concluido-${disp.nome}-${tema}.png`, disp);
      await p.close();
      await ctx.close();
    }
    await fetch(MOCK + "/__reset", { method: "POST" });

    // h) as recusas do banco no diálogo: outra aba escreveu primeiro (a gravação
    //    falha e o banco nem é chamado) e uma consulta que virou falta
    {
      const a = await abrir(pc, registro("luiza", EM_ANDAMENTO), { secoes: false });
      const b = await abrir(pc, registro("luiza", EM_ANDAMENTO), { secoes: false });
      await titulo(a).waitFor({ timeout: 60000 });
      await titulo(b).waitFor({ timeout: 60000 });
      await campoLivre(a);
      await campoLivre(b);
      let chamadasB = 0;
      b.on("request", (r) => { if (r.url().includes("/rpc/concluir_registro")) chamadasB++; });
      await a.getByLabel("Evolução", { exact: true }).fill("Escrito na primeira aba.");
      const pesoA = campo(a, "Peso (kg)").locator("input");
      await pesoA.fill("65,6");
      await pesoA.blur();
      await salvouTudo(a);
      await b.getByLabel("Evolução", { exact: true }).fill("Escrito na segunda aba.");
      ok(await abrirConclusao(b), "na aba que ficou para trás o diálogo abre");
      await dialogo(b).getByLabel("Seu CRN").fill("CRN-3 12345");
      await clicar(confirmar(b));
      ok(await apareceu(dialogo(b).getByText("O rascunho mudou em outra aba. Recarregue a página."), 15000),
        'a gravação que falha antes de concluir aparece no diálogo: "O rascunho mudou em outra aba."');
      ok(chamadasB === 0, `e o banco não recebe a conclusão (${chamadasB} chamadas)`);
      ok((await noMock(EM_ANDAMENTO))?.status === "rascunho", "o registro segue rascunho");
      await b.close();

      // a aba A está em dia: a recusa agora vem da conclusão
      await campoLivre(a);
      ok(await abrirConclusao(a), "na aba em dia o diálogo abre");
      await dialogo(a).getByLabel("Seu CRN").fill("CRN-3 12345");
      await a.route("**/rest/v1/rpc/concluir_registro", (route) => route.fulfill(recusa("Consulta com falta ou cancelada não tem registro.")));
      await clicar(confirmar(a));
      ok(await apareceu(dialogo(a).getByText("Consulta com falta ou cancelada não tem registro."), 15000),
        "a recusa do banco ao concluir aparece no diálogo");
      ok(await dialogo(a).isVisible() && (await dialogo(a).getByLabel("Seu CRN").inputValue()) === "CRN-3 12345",
        "e o diálogo continua aberto, com o CRN digitado");
      await a.unrouteAll({ behavior: "ignoreErrors" });
      await voltar(a);
      // o formulário voltou a valer depois da recusa
      ok(await a.getByLabel("Evolução", { exact: true }).isEnabled(), "recusado, o formulário fica livre para editar");

      // prints do diálogo (o rascunho está no mock): escuro no computador, claro e escuro no celular
      for (const [tema, escuro, disp] of [["escuro", true, COMPUTADOR], ["claro", false, CELULAR], ["escuro", true, CELULAR]]) {
        const ctx = await contexto(browser, disp, escuro, estado);
        const p = await abrir(ctx, registro("luiza", EM_ANDAMENTO), { secoes: false });
        await titulo(p).waitFor({ timeout: 60000 });
        await campoLivre(p);
        const abriu = await abrirConclusao(p);
        ok(abriu, `o diálogo abre: ${disp.nome}/${tema}`);
        const m = await transbordo(p);
        ok(m.doc <= m.larg, `diálogo de concluir sem transbordo: ${disp.nome}/${tema} (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        await fotografar(p, `${OUT}/registro-concluir-${disp.nome}-${tema}.png`, disp);
        await p.close();
        await ctx.close();
      }
      await a.close();
    }
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

  // =====================================================================
  // 18. Por onde se chega ao registro: painel, aba Consultas e agenda
  // =====================================================================
  console.log("\nVerificação 18: entradas do registro (painel, aba Consultas e agenda)");
  etapa = "entradas do registro";
  {
    // Do mock (ferramentas/LEIAME.md): Luiza tem ap-1 (faltou, 42 dias atrás),
    // ap-2 (realizada, 28 dias, sem registro), ap-3 (realizada, 14 dias, com
    // registro concluído e "observar") e ap-13 (em andamento, sem registro);
    // Joana tem ap-10, sem desfecho, com rascunho.
    const EM_ANDAMENTO = "ap-13";
    const CONCLUIDA = "ap-3";
    const SEM_REGISTRO_ANTIGA = "ap-2";
    const SEM_DESFECHO = "ap-10";
    const OBSERVAR = "Adesão no fim de semana. Testar café da manhã com ovos.";
    const ddmm = (n) => diaBR(n).slice(0, 5);
    const diaSP = (n) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(Date.now() + n * 86400000));
    const destino = (k, c) => `${rota(k)}/consultas/${c}`;
    const janela = (page) => page.locator("dialog[open]");
    const aviso = (page) => page.locator('section[aria-labelledby="pendencias-agenda"]');
    const consultas = (page) => page.locator("#consultas");
    // Pelo dia que está NA LINHA (summary): o painel dentro do <details> pode
    // citar outro dia ("Observar no retorno (29/09)") e casaria com duas.
    const linhaDoHistorico = (page, dias) =>
      consultas(page).locator("details").filter({ has: page.locator("summary", { hasText: ddmm(dias) }) });
    const SELOS = /Sem registro|Rascunho|Registrada/;
    const abrirAgenda = async (ctx, q) => {
      const page = await abrir(ctx, `/app/agenda${q}`, { secoes: false });
      await page.locator('nav[aria-label="Vista da agenda"]').waitFor({ timeout: 60000 });
      return page;
    };
    const abrirConsultaDoDia = async (page, nome) => {
      await clicar(page.locator("main ul[role=list] li button", { hasText: nome }).first());
      await janela(page).waitFor({ timeout: 30000 });
      return janela(page);
    };
    /** Abre o <details> de uma consulta do histórico e devolve o painel dentro dele. */
    const abrirHistorico = async (page, dias) => {
      const linha = linhaDoHistorico(page, dias);
      await clicar(linha.locator("summary"));
      return linha;
    };
    const statusNoMock = async (consulta) =>
      (await (await fetch(`${MOCK}/rest/v1/consultation_records?appointment_id=eq.${consulta}`)).json())[0]?.status ?? null;
    await fetch(MOCK + "/__reset", { method: "POST" });

    // a) agenda, Dia de hoje: a consulta em andamento da Luiza (sem registro)
    //    tem "Registrar consulta" e o "observar" do registro anterior
    {
      const page = await abrirAgenda(pc, "?vista=dia");
      const j = await abrirConsultaDoDia(page, "Luiza Prado");
      const link = j.getByRole("link", { name: "Registrar consulta", exact: true });
      ok(await apareceu(link), 'agenda: o painel da consulta em andamento da Luiza tem "Registrar consulta"');
      ok((await link.getAttribute("href").catch(() => null)) === destino("luiza", EM_ANDAMENTO),
        "agenda: o botão leva à página do registro daquela consulta");
      const txt = await textoDe(j);
      ok(txt.includes(`Observar no retorno (${ddmm(14)})`) && txt.includes(OBSERVAR),
        'agenda: o painel traz o "Observar no retorno" do registro anterior, com o dia', txt);
      ok(txt.includes("Sem registro"), 'agenda: o painel mostra o selo "Sem registro"', txt);
      ok(!/Não foi possível/.test(txt), "agenda: sem aviso de leitura que falhou quando a leitura deu certo", txt);
      // o botão é o primário: "Realizada" deixa de ser, para não haver dois
      const fundo = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor, null, { timeout: 5000 }).catch(() => "");
      const botaoRealizada = j.getByRole("button", { name: "Realizada", exact: true });
      const realizada = await fundo(botaoRealizada);
      const registrar = await fundo(link);
      // `fundo` devolve "" quando o botão não existe: sem exigir os dois, um
      // "Realizada" que sumiu passava por "só um primário".
      ok((await botaoRealizada.count()) === 1 && !!realizada && !!registrar && realizada !== registrar,
        "agenda: só um botão primário no painel (o do registro), e o Realizada continua lá", `${realizada} / ${registrar}`);
      await link.click({ timeout: 5000 }).catch(() => {});
      await page.waitForURL("**" + destino("luiza", EM_ANDAMENTO), { timeout: 10000 }).catch(() => {});
      ok(page.url().endsWith(destino("luiza", EM_ANDAMENTO)) &&
        (await apareceu(page.getByRole("heading", { level: 1, name: /^Consulta de / }), 30000)),
        "agenda: clicar no botão abre a página do registro");
      await page.close();
    }

    // b) agenda: a sem desfecho da Joana, que tem rascunho, "Continuar registro"
    {
      const page = await abrirAgenda(pc, "?vista=dia");
      await clicar(aviso(page).getByRole("button", { name: /Joana Ferreira: consulta de .* sem desfecho/ }));
      const j = janela(page);
      await j.waitFor({ timeout: 30000 });
      const link = j.getByRole("link", { name: "Continuar registro", exact: true });
      ok(await apareceu(link), 'agenda: o painel da Joana (sem desfecho, com rascunho) tem "Continuar registro"');
      ok((await link.getAttribute("href").catch(() => null)) === destino("joana", SEM_DESFECHO),
        "agenda: o botão da Joana leva ao registro da consulta sem desfecho");
      const txt = await textoDe(j);
      ok(!txt.includes("Registrar consulta") && txt.includes("Rascunho"),
        'agenda: com rascunho não aparece "Registrar consulta", e o selo é "Rascunho"', txt);
      ok(!txt.includes("Observar no retorno"), "agenda: a Joana não tem registro concluído, então nada a observar", txt);
      await page.close();
    }

    // c) aba Consultas da Luiza: selos e botões de cada consulta
    {
      const page = await abrir(pc, aba("luiza", "consultas"));
      const proxima = consultas(page).locator("li:has(> h3:text-is('Próxima consulta'))");
      const txtProxima = await textoDe(proxima);
      ok(txtProxima.includes("Sem registro"), 'aba Consultas: a consulta em andamento tem o selo "Sem registro"', txtProxima);
      ok((await proxima.getByRole("link", { name: "Registrar consulta", exact: true }).count()) === 1,
        'aba Consultas: e o botão "Registrar consulta"');
      ok(txtProxima.includes(`Observar no retorno (${ddmm(14)})`) && txtProxima.includes(OBSERVAR),
        'aba Consultas: o painel traz o "Observar no retorno"', txtProxima);

      const concluida = linhaDoHistorico(page, 14);
      ok((await textoDe(concluida.locator("summary"))).includes("Registrada"),
        'aba Consultas: a de 14 dias atrás (com registro concluído) mostra "Registrada" na linha');
      ok(!(await textoDe(concluida.locator("summary"))).includes("Sem registro"), "...e não o 'Sem registro'");
      await abrirHistorico(page, 14);
      const link = concluida.getByRole("link", { name: "Ver registro", exact: true });
      ok(await apareceu(link), 'aba Consultas: a registrada abre com "Ver registro"');
      ok((await link.getAttribute("href").catch(() => null)) === destino("luiza", CONCLUIDA), "...que leva ao registro dela");
      ok(!(await textoDe(concluida)).includes("Observar no retorno"),
        'aba Consultas: o registro concluído não mostra o próprio "observar" como se fosse de antes dele');

      const antiga = linhaDoHistorico(page, 28);
      ok((await textoDe(antiga.locator("summary"))).includes("Sem registro"),
        'aba Consultas: a realizada de 28 dias atrás, sem registro, mostra "Sem registro"');
      await abrirHistorico(page, 28);
      ok((await antiga.getByRole("link", { name: "Registrar consulta", exact: true }).count()) === 1,
        'aba Consultas: ela abre com "Registrar consulta"');
      ok(!(await textoDe(antiga)).includes("Observar no retorno"),
        'aba Consultas: o "observar" de um registro concluído depois dela não aparece nela');

      const faltou = linhaDoHistorico(page, 42);
      await abrirHistorico(page, 42);
      const txtFaltou = await textoDe(faltou);
      ok(!SELOS.test(txtFaltou) && (await faltou.getByRole("link", { name: /registro|Registrar/i }).count()) === 0,
        "aba Consultas: a que faltou (42 dias atrás) fica sem selo e sem botão de registro", txtFaltou);
      const futura = linhaDoHistorico(page, -2);
      ok(!SELOS.test(await textoDe(futura.locator("summary"))),
        "aba Consultas: a consulta futura também fica sem selo");
      // O observar é para preparar o retorno: vale na consulta futura, mesmo
      // sem o botão do registro (que só vem quando ela começa).
      await abrirHistorico(page, -2);
      const txtFutura = await textoDe(futura);
      ok(txtFutura.includes(`Observar no retorno (${ddmm(14)})`) && txtFutura.includes(OBSERVAR),
        'aba Consultas: a consulta futura (ap-4, daqui a 2 dias) mostra o "Observar no retorno"', txtFutura);
      ok((await futura.getByRole("link", { name: /registro|Registrar/i }).count()) === 0,
        "aba Consultas: e a futura segue sem botão de registro");

      const m = await transbordo(page);
      ok(m.doc <= m.larg, `aba Consultas com selos sem transbordo no computador (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      await fotografar(page, `${OUT}/consultas-selos-desktop-claro.png`, COMPUTADOR);
      await page.close();
    }

    // d) Joana: o rascunho aparece na aba, e "Faltou" mostra a recusa do banco
    {
      const page = await abrir(pc, aba("joana", "consultas"));
      const painel = consultas(page);
      ok((await textoDe(painel)).includes("Rascunho") &&
        (await painel.getByRole("link", { name: "Continuar registro", exact: true }).count()) === 1,
        'aba Consultas: a sem desfecho da Joana tem o selo "Rascunho" e "Continuar registro"');
      await clicar(painel.getByRole("button", { name: "Faltou", exact: true }));
      ok(await apareceu(painel.getByText("Descarte o rascunho do registro antes."), 15000),
        '"Faltou" numa consulta com rascunho mostra "Descarte o rascunho do registro antes."');
      ok((await statusNoMock(SEM_DESFECHO)) === "rascunho", "e o rascunho segue no banco");
      await page.close();
    }

    // d2) o "observar" é o do registro da consulta que começou por último, e
    //     não o do concluído por último: o nutri preenche hoje o registro de
    //     uma consulta ANTIGA (ap-2, de 28 dias atrás), concluído depois do de
    //     ap-3 (14 dias) e até depois de ap-13 começar. A instrução que vale
    //     segue sendo a de ap-3, com o dia da consulta dela.
    {
      const ANTIGO = "Observar antigo, concluído hoje.";
      // O mock lê o usuário do payload do token; a verificação faz a chamada
      // como o nutri, sem passar pela tela.
      const token = "x." + Buffer.from(JSON.stringify({ sub: cen.nutri })).toString("base64url") + ".y";
      const rpc = async (nome, args) =>
        (await fetch(`${MOCK}/rest/v1/rpc/${nome}`, {
          method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(args),
        })).json();
      const salvo = await rpc("salvar_registro", {
        p_consulta: SEM_REGISTRO_ANTIGA, p_visto_em: null,
        p_campos: { anamnese: "Preenchido depois, de memória.", observar: ANTIGO, medidas: {} },
      });
      const concluido = await rpc("concluir_registro", {
        p_consulta: SEM_REGISTRO_ANTIGA, p_visto_em: salvo.updated_at, p_crn: "CRN-3 12345",
      });
      ok(salvo.ok === true && concluido.ok === true && (await statusNoMock(SEM_REGISTRO_ANTIGA)) === "concluido",
        "cenário: o registro da consulta de 28 dias atrás foi concluído agora, depois do de 14 dias", JSON.stringify([salvo, concluido]));

      const page = await abrir(pc, aba("luiza", "consultas"));
      const proxima = consultas(page).locator("li:has(> h3:text-is('Próxima consulta'))");
      const txtProxima = await textoDe(proxima);
      ok(txtProxima.includes(OBSERVAR) && txtProxima.includes(`Observar no retorno (${ddmm(14)})`),
        'concluído fora de ordem: a consulta em andamento mostra o observar da consulta MAIS RECENTE (a de 14 dias), com o dia dela', txtProxima);
      ok(!txtProxima.includes(ANTIGO), "e não o do registro concluído por último, que é de uma consulta mais velha", txtProxima);
      await abrirHistorico(page, -2);
      const txtFutura = await textoDe(linhaDoHistorico(page, -2));
      ok(txtFutura.includes(OBSERVAR) && !txtFutura.includes(ANTIGO),
        "concluído fora de ordem: a consulta futura mostra o mesmo observar", txtFutura);
      ok((await textoDe(linhaDoHistorico(page, 28).locator("summary"))).includes("Registrada"),
        'e a de 28 dias atrás, agora com registro, mostra "Registrada"');
      for (const dias of [28, 14]) {
        await abrirHistorico(page, dias);
        ok(!(await textoDe(linhaDoHistorico(page, dias))).includes("Observar no retorno"),
          `concluído fora de ordem: a consulta de ${dias} dias atrás não mostra o observar de uma consulta posterior ou o próprio`);
      }
      await page.close();

      // a agenda lê o observar de quem tem consulta futura na tela (sem o
      // botão do registro, que ela ainda não tem)
      const agendaFutura = await abrirAgenda(pc, `?vista=dia&data=${diaSP(2)}`);
      const j = await abrirConsultaDoDia(agendaFutura, "Luiza Prado");
      const txtAgenda = await textoDe(j);
      ok(txtAgenda.includes(OBSERVAR) && txtAgenda.includes(`Observar no retorno (${ddmm(14)})`) && !txtAgenda.includes(ANTIGO),
        "agenda: a consulta da Luiza daqui a 2 dias mostra o observar da consulta mais recente", txtAgenda);
      ok((await j.getByRole("link", { name: /registro|Registrar/i }).count()) === 0,
        "agenda: e a consulta futura não tem botão de registro");
      await agendaFutura.close();
    }
    await fetch(MOCK + "/__reset", { method: "POST" });

    // e) a leitura dos registros falha: a aba mostra a lista sem selos e o aviso
    await fetch(MOCK + "/__falhar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tabela: "consultation_records" }),
    });
    {
      const page = await abrir(pc, aba("luiza", "consultas"));
      const txt = await textoDe(consultas(page));
      ok(txt.includes("Não foi possível carregar os registros."),
        'registros que não carregam: a aba Consultas avisa "Não foi possível carregar os registros."', txt);
      ok(txt.includes("Próxima consulta") && txt.includes("Histórico"), "e a lista de consultas continua lá");
      ok(!SELOS.test(txt), 'e não há selo nenhum: "Sem registro" em tudo seria dizer o que não se sabe', txt);
      const proxima = consultas(page).locator("li:has(> h3:text-is('Próxima consulta'))");
      ok((await proxima.getByRole("link", { name: "Abrir registro", exact: true }).count()) === 1 &&
        (await proxima.getByRole("link", { name: "Registrar consulta", exact: true }).count()) === 0,
        'e o painel oferece "Abrir registro" em vez de adivinhar "Registrar consulta"');
      ok((await textoDe(proxima)).includes("Não foi possível carregar o Observar no retorno."),
        'e o painel diz que o "Observar no retorno" não carregou, em vez de omitir');
      await page.close();
    }
    // ...e a agenda: o botão neutro e a linha do observar
    {
      const page = await abrirAgenda(pc, "?vista=dia");
      const j = await abrirConsultaDoDia(page, "Luiza Prado");
      const link = j.getByRole("link", { name: "Abrir registro", exact: true });
      ok(await apareceu(link), 'registros que não carregam: a agenda mostra "Abrir registro" no painel');
      ok((await link.getAttribute("href").catch(() => null)) === destino("luiza", EM_ANDAMENTO),
        "e ele leva à mesma página do registro");
      const txt = await textoDe(j);
      ok(!txt.includes("Registrar consulta") && !SELOS.test(txt), 'e não adivinha "Registrar consulta" nem mostra selo', txt);
      ok(txt.includes("Não foi possível carregar o Observar no retorno."),
        'agenda: a linha "Não foi possível carregar o Observar no retorno."', txt);
      await page.close();
    }
    await fetch(MOCK + "/__reset", { method: "POST" });

    // f) celular: sem transbordo na aba, nem no painel da agenda
    {
      const page = await abrir(cel, aba("luiza", "consultas"));
      await abrirHistorico(page, 14);
      const m = await transbordo(page);
      ok(m.doc <= m.larg, `aba Consultas com selos sem transbordo no celular (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      await fotografar(page, `${OUT}/consultas-selos-mobile-claro.png`, CELULAR);
      await page.close();
      const agendaCel = await abrirAgenda(cel, "?vista=dia");
      await abrirConsultaDoDia(agendaCel, "Luiza Prado");
      const n = await transbordo(agendaCel);
      ok(n.doc <= n.larg, `painel da agenda com o botão do registro sem transbordo no celular (documento ${n.doc}px, janela ${n.larg}px)`, n.vaza.join(" | "));
      await agendaCel.close();
    }
    // g) prints no escuro
    {
      const ctx = await contexto(browser, COMPUTADOR, true, estado);
      const page = await abrir(ctx, aba("luiza", "consultas"));
      await abrirHistorico(page, 14);
      await fotografar(page, `${OUT}/consultas-selos-desktop-escuro.png`, COMPUTADOR);
      await page.close();
      await ctx.close();
    }
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

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
