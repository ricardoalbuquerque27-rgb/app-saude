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
    // A Helena é a paciente com mais dado (22 semanas de pesagem, seis
    // consultas, três laudos): a que mais tem chance de transbordar em 390 px.
    for (const k of ["luiza", "pedro", "carlos", "joana", "helena"]) {
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
    ok(/IMC 23,2/.test(txt) && txt.includes("com a altura atual do perfil (168 cm)"),
      'e o IMC diz que vem da altura de hoje: "com a altura atual do perfil (168 cm)"', txt);
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
      // o adendo digitado e não salvo: fechar a página cai no aviso do navegador
      await p.getByLabel("Novo adendo", { exact: true }).fill("Adendo que ainda não foi salvo.");
      let aviso = "";
      p.once("dialog", async (dlg) => {
        aviso = dlg.type();
        await dlg.dismiss();
      });
      await p.close({ runBeforeUnload: true });
      await p.waitForTimeout(500);
      ok(aviso === "beforeunload", `fechar com um adendo digitado e não salvo cai no aviso do navegador (${aviso || "sem aviso"})`);
      await p.close();
    }

    // f2) o CRN apagado em outra aba depois de a página abrir: o perfil tinha
    //     (o concluir de b) gravou), o banco pede de novo, e o diálogo, que
    //     abriu sem o campo, passa a mostrá-lo. Na Joana (ap-10, o rascunho
    //     dela), para não mexer no registro da Luiza.
    {
      const p = await abrir(pc, registro("joana", "ap-10"), { secoes: false });
      await titulo(p).waitFor({ timeout: 60000 });
      await campoLivre(p);
      ok(await abrirConclusao(p), "com o CRN no perfil, o diálogo de concluir abre");
      const dj = dialogo(p);
      ok((await dj.getByLabel("Seu CRN").count()) === 0, "e não pede o CRN, que o perfil já tem");
      const pedidos = [];
      await p.route("**/rest/v1/rpc/concluir_registro", (route) => {
        pedidos.push(route.request().postDataJSON());
        return route.fulfill(recusa("Informe o seu CRN para concluir."));
      });
      await clicar(confirmar(p));
      ok(await apareceu(dj.getByText("Informe o seu CRN para concluir."), 10000),
        'o banco pede o CRN (apagado em outra aba): o diálogo mostra "Informe o seu CRN para concluir."');
      ok(await apareceu(dj.getByLabel("Seu CRN"), 5000), 'e passa a mostrar o campo "Seu CRN"');
      await dj.getByLabel("Seu CRN").fill("CRN-3 54321");
      await clicar(confirmar(p));
      for (let i = 0; i < 50 && pedidos.length < 2; i++) await p.waitForTimeout(100);
      ok(pedidos.length === 2 && pedidos[0]?.p_crn == null && pedidos[1]?.p_crn === "CRN-3 54321",
        "e o CRN digitado vai na tentativa seguinte", JSON.stringify(pedidos.map((x) => x?.p_crn ?? null)));
      await p.unrouteAll({ behavior: "ignoreErrors" });
      ok((await noMock("ap-10"))?.status === "rascunho", "o rascunho da Joana continua rascunho");
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

  console.log("\nVerificação 19: medida da consulta na aba Corpo e CRN no perfil");
  etapa = "medida da consulta e CRN";
  {
    // Do mock (ferramentas/LEIAME.md): a Luiza tem quatro medidas dela e a que
    // o registro de ap-3 (14 dias atrás) publicou: 66,4 kg, com measured_by.
    const MARCA = "na consulta";
    const linhasDoCorpo = (page) => page.locator('#corpo [role="region"] tbody tr');

    // a) a aba Corpo marca a medida do prontuário e só ela
    {
      const page = await abrir(pc, aba("luiza", "corpo"));
      await clicar(page.locator("#corpo summary"));
      const linhas = linhasDoCorpo(page);
      await linhas.first().waitFor({ state: "visible", timeout: 30000 });
      ok((await linhas.count()) === 5, `Corpo da Luiza: 5 medidas, 4 dela e 1 da consulta (${await linhas.count()})`);
      const marcadas = linhas.filter({ has: page.getByText(MARCA, { exact: true }) });
      ok((await marcadas.count()) === 1, `só uma linha tem a marca "${MARCA}"`);
      const txt = (await textoDe(marcadas.first())).replace(/\s+/g, " ");
      ok(txt.includes(diaBR(14)) && txt.includes("66,4"), "e é a da consulta: o dia dela e os 66,4 kg", txt);
      ok((await linhas.filter({ hasNotText: MARCA }).count()) === 4, "as quatro medidas dela ficam sem a marca");
      // O Peso atual diz de onde veio: a de hoje é dela, de casa (spec, "dizendo qual").
      const topo = (await textoDe(page.locator("#corpo dl").first())).replace(/\s+/g, " ");
      ok(topo.includes("65,4 kg") && topo.includes(`em ${diaBR(0)}, em casa`),
        `o Peso atual da Luiza diz "em ${diaBR(0)}, em casa"`, topo);
      await fotografar(page, `${OUT}/corpo-na-consulta-desktop-claro.png`, COMPUTADOR);
      await page.close();
    }
    {
      const ctx = await contexto(browser, COMPUTADOR, true, estado);
      const page = await abrir(ctx, aba("luiza", "corpo"));
      await clicar(page.locator("#corpo summary"));
      await linhasDoCorpo(page).first().waitFor({ state: "visible", timeout: 30000 });
      await fotografar(page, `${OUT}/corpo-na-consulta-desktop-escuro.png`, COMPUTADOR);
      await page.close();
      await ctx.close();
    }
    {
      const page = await abrir(cel, aba("luiza", "corpo"));
      await clicar(page.locator("#corpo summary"));
      await linhasDoCorpo(page).first().waitFor({ state: "visible", timeout: 30000 });
      const m = await transbordo(page);
      ok(m.doc <= m.larg, `Corpo com a marca sem transbordo no celular (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      await page.close();
    }

    // b) o perfil do nutricionista: o campo CRN grava no perfil e volta ao recarregar
    {
      const ROTULO = "CRN (aparece no prontuário)";
      const crnNoMock = async () =>
        (await (await fetch(`${MOCK}/rest/v1/profiles?id=eq.${cen.nutri}`)).json())[0]?.crn;
      const abrirPerfil = async () => {
        const page = await abrir(pc, "/app/perfil", { secoes: false });
        await page.getByText("Nome completo", { exact: true }).waitFor({ timeout: 60000 });
        return page;
      };
      const salvar = async (page) => {
        await clicar(page.getByRole("button", { name: "Salvar alterações" }));
        return apareceu(page.getByRole("button", { name: "Salvo!" }), 30000);
      };

      let page = await abrirPerfil();
      const entrada = campo(page, ROTULO).locator("input");
      ok(await apareceu(entrada), `o Perfil do nutricionista tem o campo "${ROTULO}"`);
      ok((await entrada.inputValue()) === "", "e ele começa vazio (o perfil do mock não tem CRN)");
      ok((await entrada.getAttribute("maxlength")) === "30", "o campo aceita até 30 caracteres (maxlength)");
      await entrada.click();
      await page.keyboard.type("X".repeat(40));
      ok((await entrada.inputValue()).length === 30, "digitar 40 caracteres deixa 30");

      await entrada.fill("  CRN-3 12345  ");
      ok(await salvar(page), "salvar o perfil com o CRN mostra Salvo!");
      ok((await crnNoMock()) === "CRN-3 12345", "o CRN vai para profiles.crn, sem os espaços das pontas", String(await crnNoMock()));
      await page.close();

      page = await abrirPerfil();
      ok((await campo(page, ROTULO).locator("input").inputValue()) === "CRN-3 12345",
        "ao recarregar a página, o CRN reaparece no campo");
      await fotografar(page, `${OUT}/perfil-crn-desktop-claro.png`, COMPUTADOR);

      // vazio salva nulo, e não uma string vazia
      await campo(page, ROTULO).locator("input").fill("   ");
      ok(await salvar(page), "salvar com o CRN em branco mostra Salvo!");
      ok((await crnNoMock()) === null, "e o CRN em branco grava nulo (não texto vazio)", JSON.stringify(await crnNoMock()));
      await page.close();

      const celular = await abrir(cel, "/app/perfil", { secoes: false });
      await celular.getByText("Nome completo", { exact: true }).waitFor({ timeout: 60000 });
      await apareceu(campo(celular, ROTULO).locator("input"));
      const m = await transbordo(celular);
      ok(m.doc <= m.larg, `Perfil com o CRN sem transbordo no celular (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      await celular.close();
    }
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

  console.log("\nVerificação 20: gráficos do nutricionista, abas Corpo e Clínico (Helena, Pedro e Joana)");
  etapa = "Corpo: anel e Evolução";
  {
    // Do mock (ferramentas/LEIAME.md): a Helena tem o vínculo há 154 dias, a
    // média semanal de 74,4 a 70,1 kg com a 8ª semana sem pesagem, seis
    // consultas com peso, cintura e % de gordura (74,6 / 92 / 34,0 até 70,3 / 85
    // / 30,4), a última ontem, no mesmo dia de uma pesagem de casa, e meta de
    // 66 kg: o anel diz 4,3 de 8,6 kg, 50%. O Pedro chegou há 2 dias e nunca
    // registrou nada.
    //
    // O que NÃO se confere: quantas semanas dizem "sem pesagem". A 8ª fica
    // vazia em qualquer dia, mas as pontas dependem do dia da semana em que o
    // mock sobe (no domingo a 1ª só tem a consulta; na segunda a semana em
    // curso é só hoje; no sábado a 1ª tem uma pesagem; na terça a atual tem
    // uma). Por isso: ao menos um "sem pesagem" e a linha em duas partes.
    const ddmm = (n) => diaBR(n).slice(0, 5);
    const corpo = (page) => page.locator("#corpo");
    const figura = (page, titulo) =>
      corpo(page).locator("figure").filter({ has: page.locator("figcaption", { hasText: titulo }) });
    const limpo = async (loc) => (await textoDe(loc)).replace(/\s+/g, " ").trim();
    // innerText não existe em elemento SVG (o eixo do gráfico é um <g>).
    // Um texto por marca do eixo, separados por espaço (textContent cola os <text>: "junjulago").
    const textoSvg = async (loc) =>
      (await loc.evaluate((el) => [...el.querySelectorAll("text")].map((t) => t.textContent).join(" "))).replace(/\s+/g, " ").trim();
    const MESES = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g;

    const conferir = async (page, disp, tema) => {
      const rot = `${disp.nome}/${tema}`;
      const peso = figura(page, "média da semana");
      const desenhou = await apareceu(peso.locator("svg.recharts-surface").first(), 30000);
      ok(desenhou, `Helena: o gráfico do peso desenha (${rot})`);
      if (!desenhou) return;
      // No meio da janela: no celular a barra de baixo é fixa e cobre o toque em
      // qualquer coisa que fique rente ao rodapé.
      await peso.locator('svg[role="img"]').evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

      // o topo e o anel: o mesmo peso atual nos dois
      const topo = await limpo(corpo(page).locator("dl").first());
      ok(topo.includes("70,3 kg") && topo.includes(`em ${diaBR(1)}, na consulta`),
        `Peso atual: 70,3 kg "em ${diaBR(1)}, na consulta", no dia com as duas medidas (${rot})`, topo);
      ok(topo.includes("66 kg") && topo.includes("50%") && topo.includes(`4,3 de 8,6 kg desde ${ddmm(154)}`),
        `o anel diz 66 kg, 50% e "4,3 de 8,6 kg desde ${ddmm(154)}" (${rot})`, topo);
      ok(!topo.includes("faltam"), `e o anel entra no lugar do "faltam N kg" (${rot})`, topo);
      const anel = corpo(page).locator('[role="img"][aria-label^="Progresso até a meta"]');
      ok((await anel.count()) === 1 && (await anel.getAttribute("aria-label")) === "Progresso até a meta: 4,3 de 8,6 kg, 50%",
        `o anel tem role=img e "Progresso até a meta: 4,3 de 8,6 kg, 50%" (${rot})`, await anel.first().getAttribute("aria-label").catch(() => null));

      // o título e a legenda
      const cap = await limpo(peso.locator("figcaption"));
      ok(cap.includes("média da semana") && cap.includes("70,1 kg") && cap.includes("−4,3 kg desde a 1ª semana"),
        `o título do peso diz "média da semana", 70,1 kg e "−4,3 kg desde a 1ª semana" (${rot})`, cap);
      ok(/medida na consulta|consulta/.test(cap) && /meta/.test(cap), `e a legenda cita a consulta e a meta (${rot})`, cap);

      // a linha em duas partes (a lacuna), o "sem pesagem", os pontos e a meta
      const d = (await peso.locator("path.recharts-line-curve").first().getAttribute("d")) || "";
      const partes = (d.match(/M/g) || []).length;
      ok(partes === 2, `a linha da média tem duas partes: a 8ª semana sem pesagem corta a linha (${partes}) (${rot})`, d.slice(0, 120));
      ok((await peso.getByText("sem pesagem", { exact: true }).count()) >= 1,
        `o gráfico escreve "sem pesagem" sobre a falha (${rot})`);
      ok((await peso.locator("circle.ponto-consulta").count()) === 6, `seis pontos de consulta (${rot})`,
        String(await peso.locator("circle.ponto-consulta").count()));
      // (a classe do ReferenceLine fica no <g>; o traço é a <line> dentro dele)
      const linhasDeConsulta = peso.locator(".linha-de-consulta line");
      ok((await linhasDeConsulta.count()) === 6 && !!(await linhasDeConsulta.first().getAttribute("stroke-dasharray")),
        `e seis linhas verticais tracejadas de consulta (${rot})`);
      ok((await peso.getByText("meta 66 kg", { exact: true }).count()) === 1, `a linha da meta diz "meta 66 kg" (${rot})`);
      const meta = peso.locator(".linha-da-meta line");
      ok((await meta.count()) === 1 && !!(await meta.getAttribute("stroke-dasharray")), `a meta é uma linha tracejada (${rot})`);

      // o eixo: meses no X; 3 marcas no Y no celular
      const meses = (await textoSvg(peso.locator(".recharts-xAxis"))).match(MESES) || [];
      ok(meses.length >= 4, `o eixo X marca os meses (${meses.join(" ")}) (${rot})`);
      const marcasY = await peso.locator(".recharts-yAxis .recharts-cartesian-axis-tick").count();
      ok(disp.mobile ? marcasY >= 2 && marcasY <= 3 : marcasY >= 4 && marcasY <= 6, `${disp.mobile ? "no celular, até 3 marcas" : "no computador, de 4 a 6 marcas"} no eixo Y (${marcasY}) (${rot})`);

      // a descrição do SVG
      const svg = peso.locator('svg[role="img"]');
      const desc = (await svg.getAttribute("aria-label")) || "";
      ok(desc.startsWith("Peso de ") && desc.includes("média da semana caiu de 74,4 para 70,1 kg") &&
        desc.includes("seis consultas, a última com 70,3 kg") && desc.includes("meta 66 kg"),
        `o SVG do peso tem role=img e a frase no aria-label (${rot})`, desc);

      // cintura e % de gordura
      const cin = figura(page, "Cintura");
      const gor = figura(page, "% de gordura");
      const capCin = await limpo(cin.locator("figcaption"));
      const capGor = await limpo(gor.locator("figcaption"));
      ok(capCin.includes("85 cm") && capCin.includes("−7 cm"), `a cintura diz 85 cm e −7 cm (${rot})`, capCin);
      ok(capGor.includes("30,4%") && capGor.includes("−3,6 pontos"), `o % de gordura diz 30,4% e −3,6 pontos (${rot})`, capGor);
      ok((await cin.locator("circle.ponto-consulta").count()) === 6 && (await cin.locator("circle.ponto-casa").count()) === 4,
        `cintura: seis pontos cheios (consulta) e quatro vazados (casa) (${rot})`);
      ok((await gor.locator("circle.ponto-consulta").count()) === 6 && (await gor.locator("circle.ponto-casa").count()) === 2,
        `% de gordura: seis pontos cheios e dois vazados (${rot})`);
      ok(((await cin.locator('svg[role="img"]').getAttribute("aria-label")) || "").endsWith("de 92 para 85 cm."),
        `o SVG da cintura diz "de 92 para 85 cm." (${rot})`);
      const caixaC = await cin.boundingBox();
      const caixaG = await gor.boundingBox();
      if (disp.mobile) {
        ok(caixaG.y >= caixaC.y + caixaC.height - 1 && Math.abs(caixaG.x - caixaC.x) < 2,
          `no celular, cintura e gordura ficam uma embaixo da outra (${rot})`, JSON.stringify({ caixaC, caixaG }));
      } else {
        ok(Math.abs(caixaG.y - caixaC.y) < 4 && caixaG.x > caixaC.x + caixaC.width - 2,
          `no computador, cintura e gordura ficam lado a lado (${rot})`, JSON.stringify({ caixaC, caixaG }));
      }

      // as cores no tema: linha e pontos precisam de contraste com o fundo
      const cores = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const lum = ([r, g, b]) => {
          const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const fundo = rgb(getComputedStyle(document.body).backgroundColor);
        const linha = document.querySelector("#corpo figure path.recharts-line-curve");
        const ponto = document.querySelector("#corpo figure circle.ponto-consulta");
        const marca = document.querySelector("#corpo figure .linha-de-consulta line");
        const cs = (el) => getComputedStyle(el);
        return {
          fundo: cs(document.body).backgroundColor,
          traco: cs(linha).stroke,
          preenchimento: cs(ponto).fill,
          razaoLinha: razao(rgb(cs(linha).stroke), fundo),
          razaoPonto: razao(rgb(cs(ponto).fill), fundo),
          razaoMarca: razao(rgb(cs(marca).stroke), fundo),
          espessuraMarca: cs(marca).strokeWidth,
        };
      });
      ok(cores.razaoLinha >= 3 && cores.razaoPonto >= 3,
        `a linha e os pontos da consulta contrastam com o fundo (${tema}): linha ${cores.razaoLinha.toFixed(1)}:1, ponto ${cores.razaoPonto.toFixed(1)}:1`,
        JSON.stringify(cores));
      // A linha vertical de cada consulta era `linha` (1,24:1) e quase sumia.
      ok(cores.razaoMarca >= 3 && cores.espessuraMarca === "1px",
        `as linhas das consultas (1 px, tracejadas) contrastam com o fundo (${tema}): ${cores.razaoMarca.toFixed(1)}:1`,
        JSON.stringify(cores));

      // a dica: o mouse no computador, o toque no celular
      const apontar = async (x, y) => (disp.mobile ? page.touchscreen.tap(x, y) : page.mouse.move(x, y));
      const dica = peso.getByRole("tooltip");
      {
        const caixa = await peso.locator("circle.ponto-semana").nth(10).boundingBox();
        await apontar(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
        const apareceuDica = await apareceu(dica, 5000);
        const t = apareceuDica ? await limpo(dica) : "";
        ok(apareceuDica && /Semana de \d{2}\/\d{2} a \d{2}\/\d{2}/.test(t) && /média \d+(,\d)? kg/.test(t) && /\d+ pesagens/.test(t),
          `${disp.mobile ? "tocar" : "passar o mouse"} numa semana mostra "Semana de dd/mm a dd/mm", a média e as pesagens (${rot})`, t);
        const tb = apareceuDica ? await dica.boundingBox() : null;
        ok(!!tb && tb.x >= 0 && tb.x + tb.width <= disp.w, `e a dica cabe na janela (${rot})`, JSON.stringify(tb));
      }
      {
        const caixa = await peso.locator("circle.ponto-consulta").nth(5).boundingBox();
        await apontar(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
        await page.waitForTimeout(200);
        const t = (await apareceu(dica, 5000)) ? await limpo(dica) : "";
        ok(t.includes(`consulta de ${ddmm(1)}`) && t.includes("70,3 kg"),
          `a dica da última consulta diz "consulta de ${ddmm(1)}" e 70,3 kg (${rot})`, t);
      }
      {
        const eixo = await peso.locator(".recharts-xAxis .recharts-cartesian-axis-line").boundingBox();
        await apontar(eixo.x + eixo.width - 9, eixo.y - 100);
        await page.waitForTimeout(200);
        const t = (await apareceu(dica, 5000)) ? await limpo(dica) : "";
        ok(t.includes("semana em curso"), `na ponta direita a dica diz "semana em curso" (${rot})`, t);
      }

      if (disp.mobile) {
        const m = await transbordo(page);
        ok(m.doc <= m.larg, `Corpo da Helena sem transbordo no celular (${tema}) (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
      }
      await fotografar(page, `${OUT}/corpo-evolucao-${disp.nome}-${tema}.png`, disp);
    };

    for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
      for (const disp of [COMPUTADOR, CELULAR]) {
        const ctx = await contexto(browser, disp, escuro, estado);
        const page = await abrir(ctx, aba("helena", "corpo"));
        await conferir(page, disp, tema);
        await page.close();
        await ctx.close();
      }
    }

    // pouco dado: o Pedro nunca registrou nada, e o paciente sem tendência não
    // ganha gráfico nem anel.
    {
      const page = await abrir(pc, aba("pedro", "corpo"));
      const txt = await limpo(corpo(page));
      ok(txt.includes("Ainda não dá para ver tendência"), 'Pedro: no lugar do gráfico, "Ainda não dá para ver tendência"', txt);
      ok((await corpo(page).locator("figure svg.recharts-surface").count()) === 0, "e nenhum gráfico de peso, cintura ou gordura");
      ok((await corpo(page).locator('[role="img"][aria-label^="Progresso"]').count()) === 0, "e nenhum anel (sem meta nem peso)");
      // Sem meta não há o que editar (spec): o link diz "definir nas metas".
      ok((await corpo(page).getByRole("link", { name: "definir nas metas" }).count()) === 1 &&
        (await corpo(page).getByRole("link", { name: "editar nas metas" }).count()) === 0,
        'e, sem meta, o link diz "definir nas metas" (e não "editar")', txt);
      ok(txt.includes("Cintura") && txt.includes("% de gordura"), "e a linha diz que cintura e % de gordura ficaram de fora", txt);
      await fotografar(page, `${OUT}/corpo-pouco-dado-desktop-claro.png`, COMPUTADOR);
      await page.close();
    }

    // leitura que falha: o erro da aba, nunca "Ainda não dá" nem um gráfico vazio
    for (const tabela of ["body_measurements", "patient_links", "appointments"]) {
      await fetch(MOCK + "/__falhar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabela }),
      });
      const page = await abrir(pc, aba("helena", "corpo"));
      const txt = await limpo(corpo(page));
      ok(txt.includes("Não foi possível carregar as medidas") && !txt.includes("Ainda não dá para ver tendência") &&
        (await corpo(page).locator("figure").count()) === 0,
        `${tabela} falha: o erro da aba, e não "Ainda não dá" nem gráfico`, txt);
      await page.close();
      await fetch(MOCK + "/__reset", { method: "POST" });
    }
  }
  // ---- Clínico: o comparativo dos exames (Helena, Joana e Pedro) ----
  etapa = "Clínico: comparativo dos exames";
  {
    // Do mock (ferramentas/LEIAME.md): a Helena tem 18 resultados de 8 exames, em
    // três laudos de 300, 245 e 192 dias atrás e um resultado sem número de 185
    // dias. O que a tela tem de dizer, na ordem em que a lógica (lib/exames.ts)
    // os põe: Triglicerídeos (saiu da faixa), LDL e Colesterol total (mais perto:
    // o "< 190" do laudo é estrito, e o 190 ainda está fora), depois os que estão
    // dentro (Glicemia de jejum, Vitamina B12, Vitamina D), depois os de um
    // resultado só (VLDL-colesterol, a ferritina por último). "Glicose" e
    // "Glicemia de jejum" são uma linha só, com minigráfico, e a Vitamina D
    // também; os outros dizem "N resultados".
    //
    // O selo do Último sai da faixa da linha, não do status gravado: a B12 está
    // gravada "atencao" (o app antigo a julgava pela tabela em pg/mL) e o selo
    // diz "Normal" (235 dentro de 148 a 664); o VLDL tem gravada a referência
    // da tabela do colesterol total ("< 190 mg/dL") e fica sem faixa nem selo.
    //
    // A data leva o ano quando não é o de hoje (o laudo de 300 dias atrás, e os
    // outros conforme o dia em que o mock sobe): `dm`.
    const LAUDO_1 = 300, LAUDO_2 = 245, LAUDO_3 = 192, HEMOLISADA = 185;
    const dm = (n) => {
      const [d, m, a] = diaBR(n).split("/");
      return a === diaBR(0).split("/")[2] ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`;
    };
    const limpo = async (loc) => (await textoDe(loc)).replace(/\s+/g, " ").trim();
    const painel = (page) => page.locator("#clinico");
    const tabela = (page) => page.getByRole("region", { name: "Comparativo dos exames" });
    const lista = (page) => page.getByRole("list", { name: "Resultados dos exames" });
    // A mesma ordem de antes do "<" estrito: o Colesterol total passou de
    // primeiro dos que estão dentro a último dos que seguem fora.
    const ORDEM = ["Triglicerídeos", "Colesterol LDL", "Colesterol total", "Glicemia de jejum", "Vitamina B12", "Vitamina D", "VLDL-colesterol", "Ferritina"];
    const VAZIA = { nome: "", ref: "", ultimo: "", anterior: "", mudou: "", tendencia: "", graficos: 0 };

    // As linhas da tabela de uma vez: o nome e a faixa na primeira coluna, e o
    // texto de cada uma das outras quatro.
    const lerLinhas = (page) =>
      tabela(page).locator("tbody tr").evaluateAll((trs) =>
        trs.map((tr) => {
          const [nome, ref] = tr.querySelector("th").innerText.split("\n").map((t) => t.trim());
          const [ultimo, anterior, mudou, tendencia] = [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim());
          return { nome, ref, ultimo, anterior, mudou, tendencia, graficos: tr.querySelectorAll('svg[role="img"]').length };
        })
      );

    const rgb = (s) => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const razao = (a, b) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };

    const conferir = async (page, disp, tema) => {
      const rot = `${disp.nome}/${tema}`;
      const caixa = tabela(page);
      const desenhou = await apareceu(caixa, 20000);
      ok(desenhou, `Helena: o Clínico mostra a tabela do comparativo dos exames (${rot})`);
      if (!desenhou) return;
      await caixa.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

      // a linha de resumo, com os três números
      const resumo = await limpo(painel(page).locator("p", { hasText: "melhores ou dentro da faixa" }).first());
      ok(resumo.includes("4 melhores ou dentro da faixa") && resumo.includes("1 pior que antes") && resumo.includes("2 só com um resultado"),
        `a linha de resumo diz 4 melhores ou dentro da faixa, 1 pior que antes e 2 só com um resultado (${rot})`, resumo);

      // a ordem e o texto de cada linha
      const linhas = await lerLinhas(page);
      const nomes = linhas.map((l) => l.nome);
      ok(JSON.stringify(nomes) === JSON.stringify(ORDEM), `a tabela na ordem: ${ORDEM.join(", ")} (${rot})`, nomes.join(", "));
      ok(!nomes.some((n) => /Glicose/.test(n)), `"Glicose" e "Glicemia de jejum" são uma linha só, a da Glicemia (${rot})`, nomes.join(", "));
      const l = (nome) => linhas.find((x) => x.nome === nome) || VAZIA;

      const trig = l("Triglicerídeos");
      ok(trig.ref === "ref. < 150" && trig.ultimo.includes("168 mg/dL") && trig.ultimo.includes("Alterado") && trig.ultimo.includes(dm(LAUDO_3)),
        `Triglicerídeos: ref. < 150, último 168 mg/dL com o selo Alterado (fora da faixa do laudo) e a data ${dm(LAUDO_3)} (${rot})`, JSON.stringify(trig));
      ok(trig.ultimo.includes(`mais de um resultado em ${dm(LAUDO_3)}`),
        `e avisa "mais de um resultado em ${dm(LAUDO_3)}" (o 165 do mesmo dia) (${rot})`, JSON.stringify(trig));
      ok(trig.anterior === `141 · ${dm(LAUDO_1)}` && trig.mudou.includes("+27") && trig.mudou.includes("saiu da faixa") && trig.tendencia === "2 resultados" && trig.graficos === 0,
        `Triglicerídeos: anterior "141 · ${dm(LAUDO_1)}", +27, "saiu da faixa" e "2 resultados" no lugar do gráfico (${rot})`, JSON.stringify(trig));
      const ldl = l("Colesterol LDL");
      ok(ldl.ultimo.includes("132 mg/dL") && ldl.ultimo.includes("Alterado") && ldl.anterior === `145 · ${dm(LAUDO_1)}` && ldl.mudou.includes("−13") && ldl.mudou.includes("mais perto da faixa"),
        `LDL: 132 mg/dL Alterado, anterior "145 · ${dm(LAUDO_1)}", −13 e "mais perto da faixa" (${rot})`, JSON.stringify(ldl));
      const vitD = l("Vitamina D");
      ok(vitD.ultimo.includes("38 ng/mL") && vitD.ultimo.includes("Normal") && vitD.anterior === `24 · ${dm(LAUDO_2)}` && vitD.mudou.includes("+14") && vitD.mudou.includes("entrou na faixa"),
        `Vitamina D: 38 ng/mL Normal, anterior "24 · ${dm(LAUDO_2)}", +14 e "entrou na faixa" (${rot})`, JSON.stringify(vitD));
      const glic = l("Glicemia de jejum");
      ok(glic.ultimo.includes("92 mg/dL") && glic.ultimo.includes("Normal") && glic.anterior === `98 · ${dm(LAUDO_2)}` && glic.mudou.includes("−6") && glic.mudou.includes("segue na faixa"),
        `Glicemia de jejum: 92 mg/dL Normal, anterior "98 · ${dm(LAUDO_2)}" (a série de 3 junta Glicose e Glicemia), −6 e "segue na faixa" (${rot})`, JSON.stringify(glic));
      ok(glic.ultimo.includes(`depois: Amostra hemolisada em ${dm(HEMOLISADA)}`),
        `e diz o resultado sem número que veio depois: "depois: Amostra hemolisada em ${dm(HEMOLISADA)}" (${rot})`, JSON.stringify(glic));
      // O anterior da B12 está em outra unidade (310 pg/mL contra 235 pmol/L): sem
      // unidade, o 310 pareceria estar em pmol/L. A coluna não mostra o número.
      // O selo é "Normal" (235 dentro de 148 a 664), e não o "atencao" gravado.
      const b12 = l("Vitamina B12");
      ok(b12.ref === "ref. 148 a 664" && b12.ultimo.includes("235 pmol/L") && b12.ultimo.includes("Normal") && !b12.ultimo.includes("Atenção") &&
        b12.mudou === "unidade diferente do anterior" && b12.tendencia === "2 resultados",
        `Vitamina B12: 235 pmol/L com o selo Normal (da faixa do laudo, não o status gravado), "unidade diferente do anterior", sem diferença numérica (${rot})`, JSON.stringify(b12));
      ok(b12.anterior === dm(LAUDO_1) && !b12.anterior.includes("310") && !b12.anterior.includes("pg"),
        `e o Anterior da B12 mostra só a data ${dm(LAUDO_1)}, sem o 310 (${rot})`, b12.anterior);
      // Colesterol total e VLDL-colesterol caem no mesmo dia: duas linhas.
      const colTotal = l("Colesterol total");
      const vldl = l("VLDL-colesterol");
      ok(colTotal.ultimo.includes("190 mg/dL") && colTotal.anterior === `200 · ${dm(LAUDO_1)}` && vldl.ultimo.includes("24 mg/dL"),
        `Colesterol total (190, anterior 200) e VLDL-colesterol (24) do mesmo dia são duas linhas (${rot})`, JSON.stringify({ colTotal, vldl }));
      ok(colTotal.ref === "ref. < 190" && colTotal.ultimo.includes("Alterado") && colTotal.mudou.includes("−10") && colTotal.mudou.includes("mais perto da faixa"),
        `Colesterol total: com "< 190" o 190 ainda está fora, Alterado, −10 e "mais perto da faixa" (${rot})`, JSON.stringify(colTotal));
      ok(vldl.mudou === "primeiro resultado" && vldl.anterior === "—" && vldl.tendencia === "1 resultado",
        `VLDL-colesterol: "primeiro resultado", anterior "—" e "1 resultado" (${rot})`, JSON.stringify(vldl));
      ok(vldl.ref === "sem faixa de referência" && !/Normal|Atenção|Alterado/.test(vldl.ultimo),
        `e a referência gravada "< 190 mg/dL" (a da tabela do colesterol total) não vale como laudo: sem faixa e sem selo (${rot})`, JSON.stringify(vldl));
      // Os avisos em clin-atencao sobre o fundo: par de texto testado (4,5:1).
      const avisos = await caixa.locator(".aviso-do-exame").evaluateAll((els) =>
        els.map((el) => ({ texto: el.textContent, cor: getComputedStyle(el).color }))
      );
      const fundoDoAviso = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(avisos.length === 2 && avisos.every((a) => razao(a.cor, fundoDoAviso) >= 4.5),
        `os dois avisos da tabela contrastam com o fundo (${tema}): ${avisos.map((a) => razao(a.cor, fundoDoAviso).toFixed(1)).join(" e ")}:1`,
        JSON.stringify({ avisos, fundoDoAviso }));
      const ferr = l("Ferritina");
      ok(ferr.ultimo.includes("45 ng/mL") && ferr.ultimo.includes(dm(LAUDO_2)) && ferr.mudou === "primeiro resultado" && ferr.tendencia === "1 resultado",
        `Ferritina, por último: 45 ng/mL em ${dm(LAUDO_2)}, "primeiro resultado" e "1 resultado" (${rot})`, JSON.stringify(ferr));

      // o minigráfico: só nas linhas com 3 resultados na mesma unidade
      const graficos = await caixa.locator('svg[role="img"]').count();
      ok(graficos === 2 && glic.graficos === 1 && vitD.graficos === 1 && linhas.filter((x) => x.graficos).length === 2,
        `só duas linhas têm minigráfico (Glicemia de jejum e Vitamina D): ${graficos} svg[role=img] na tabela (${rot})`, JSON.stringify(linhas.map((x) => [x.nome, x.graficos])));
      ok(glic.tendencia === "" && vitD.tendencia === "", `e nelas o gráfico ocupa o lugar do "N resultados" (${rot})`, JSON.stringify([glic.tendencia, vitD.tendencia]));
      const minis = await caixa.locator('svg[role="img"]').evaluateAll((svgs) =>
        svgs.map((s) => {
          const estilo = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
          return {
            rotulo: s.getAttribute("aria-label"),
            largura: s.getAttribute("width"),
            altura: s.getAttribute("height"),
            pontos: s.querySelectorAll("circle.ponto-do-exame").length,
            faixa: estilo(s.querySelector("rect.faixa-do-exame"), "fill"),
            linha: estilo(s.querySelector(".linha-do-exame"), "stroke"),
            ponto: estilo(s.querySelector("circle.ponto-do-exame"), "fill"),
            bordas: [...s.querySelectorAll("line.borda-da-faixa")].map((l) => ({
              traco: getComputedStyle(l).stroke,
              espessura: getComputedStyle(l).strokeWidth,
            })),
          };
        })
      );
      const rotuloD = `Vitamina D: 18 em ${dm(LAUDO_1)}, 24 em ${dm(LAUDO_2)}, 38 em ${dm(LAUDO_3)}; faixa de 30 a 100.`;
      const rotuloG = `Glicemia de jejum: 101 em ${dm(LAUDO_1)}, 98 em ${dm(LAUDO_2)}, 92 em ${dm(LAUDO_3)}; faixa de 70 a 99.`;
      ok(minis.some((m) => m.rotulo === rotuloD) && minis.some((m) => m.rotulo === rotuloG),
        `cada minigráfico tem role=img e a frase no aria-label (${rot})`, JSON.stringify(minis.map((m) => m.rotulo)));
      ok(minis.every((m) => m.largura === "120" && m.altura === "36" && m.pontos === 3 && m.faixa && m.linha && m.ponto),
        `120×36, três pontos, a linha e a faixa sombreada em cada um (${rot})`, JSON.stringify(minis));
      const caixaDoSvg = await caixa.locator('svg[role="img"]').first().boundingBox();
      ok(!!caixaDoSvg && Math.abs(caixaDoSvg.width - 120) < 1.5 && Math.abs(caixaDoSvg.height - 36) < 1.5,
        `e desenhado em 120×36 px (${rot})`, JSON.stringify(caixaDoSvg));
      const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      // As bordas da faixa: o preenchimento sozinho dá ~1,1:1 contra a página, e o
      // limite da faixa é informação (WCAG 1.4.11, 3:1). Cada minigráfico da
      // Helena tem uma borda dentro do desenho: a de cima na Glicemia (99, a
      // faixa passa do piso) e a de baixo na Vitamina D (30, a faixa passa do
      // teto); a outra cai fora da escala e não ganha linha.
      ok(minis.length === 2 && minis.every((m) => m.bordas.length === 1 && m.bordas[0].espessura === "1px"),
        `cada minigráfico tem uma borda de faixa de 1 px (a outra cai fora do desenho) (${rot})`, JSON.stringify(minis.map((m) => m.bordas)));
      const rb = minis.map((m) => (m.bordas[0] ? razao(m.bordas[0].traco, fundo) : 0));
      ok(rb.length === 2 && rb.every((r) => r >= 3),
        `as bordas da faixa contrastam com o fundo da página (${tema}): ${rb.map((r) => r.toFixed(1)).join(" e ")}:1`,
        JSON.stringify({ bordas: minis.map((m) => m.bordas), fundo }));
      const rz = minis.map((m) => ({
        linhaNaFaixa: razao(m.linha, m.faixa),
        pontoNaFaixa: razao(m.ponto, m.faixa),
        linhaNoFundo: razao(m.linha, fundo),
      }));
      ok(rz.every((r) => r.linhaNaFaixa >= 3 && r.pontoNaFaixa >= 3 && r.linhaNoFundo >= 3),
        `a linha e os pontos contrastam com a faixa e com o fundo (${tema}): linha/faixa ${rz.map((r) => r.linhaNaFaixa.toFixed(1)).join(" e ")}:1, linha/fundo ${rz.map((r) => r.linhaNoFundo.toFixed(1)).join(" e ")}:1`,
        JSON.stringify({ minis, fundo }));

      // a nota da ordem e a caixa com foco
      const nota = await limpo(painel(page).locator("p", { hasText: "Ordem: primeiro o que piorou" }));
      ok(nota.includes("A faixa é a do laudo") && nota.includes("3 resultados ou mais"), `a nota explica a ordem, a faixa e o minigráfico (${rot})`, nota);
      ok((await caixa.getAttribute("tabindex")) === "0", `a caixa da tabela recebe foco do teclado (tabindex=0) (${rot})`);

      if (disp.mobile) {
        const m = await transbordo(page);
        ok(m.doc <= m.larg, `Clínico da Helena sem transbordo no celular (${tema}) (documento ${m.doc}px, janela ${m.larg}px)`, m.vaza.join(" | "));
        const med = await caixa.evaluate((el) => ({ tabela: el.scrollWidth, caixa: el.clientWidth }));
        ok(med.tabela > med.caixa + 8 && med.caixa <= disp.w, `no celular a tabela rola dentro da própria caixa (${med.tabela}px de tabela em ${med.caixa}px de caixa) (${tema})`);
        await caixa.focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(600);
        ok((await caixa.evaluate((el) => el.scrollLeft)) > 0, `e o teclado rola a caixa depois de ela receber foco (${tema})`);
        await caixa.evaluate((el) => { el.style.scrollBehavior = "auto"; el.scrollLeft = 0; });
      }
      await fotografar(page, `${OUT}/clinico-comparativo-${disp.nome}-${tema}.png`, disp);
      if (disp.mobile) {
        // as colunas da direita, que o primeiro print deixa para fora da caixa
        await caixa.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        await fotografar(page, `${OUT}/clinico-comparativo-${disp.nome}-${tema}-direita.png`, disp);
      }

      // "Ver todos os resultados (N)": a lista de sempre, do mais novo ao mais velho
      const verTodos = painel(page).locator("summary", { hasText: "Ver todos os resultados (18)" });
      const todos = lista(page);
      ok((await apareceu(verTodos, 5000)) && !(await todos.isVisible()), `"Ver todos os resultados (18)" começa fechado (${rot})`);
      await verTodos.scrollIntoViewIfNeeded();
      await verTodos.click();
      const abriu = await apareceu(todos, 5000);
      ok(abriu, `clicar em "Ver todos os resultados (18)" abre a lista (${rot})`);
      if (abriu) {
        const itens = await todos.locator("li").evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, " ").trim()));
        const datas = itens.map((t) => (t.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join(""));
        ok(itens.length === 18 && datas.every(Boolean) && datas.every((d, i) => i === 0 || d <= datas[i - 1]),
          `a lista tem os 18 resultados, do mais novo ao mais velho (${rot})`, itens.join(" | "));
        ok(itens[0].includes(diaBR(HEMOLISADA)) && itens[0].includes("Amostra hemolisada") && itens[itens.length - 1].includes(diaBR(LAUDO_1)),
          `começa no "Amostra hemolisada" de ${diaBR(HEMOLISADA)} e acaba em ${diaBR(LAUDO_1)} (${rot})`, `${itens[0]} ... ${itens[itens.length - 1]}`);
        ok(itens.some((t) => t.includes("Glicose") && t.includes("101 mg/dL")),
          `e a lista traz o "Glicose" de 101, que a tabela juntou à Glicemia de jejum (${rot})`);
        ok((await limpo(painel(page).locator("summary", { hasText: "Esconder resultados" }))).includes("Esconder resultados"),
          `aberta, o botão passa a dizer "Esconder resultados" (${rot})`);
        if (disp.nome === "desktop" && tema === "claro") await fotografar(page, `${OUT}/clinico-todos-os-resultados-desktop-claro.png`, disp);
      }
    };

    for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
      for (const disp of [COMPUTADOR, CELULAR]) {
        const ctx = await contexto(browser, disp, escuro, estado);
        const page = await abrir(ctx, aba("helena", "clinico"));
        await conferir(page, disp, tema);
        await page.close();
        await ctx.close();
      }
    }

    // Todos os exames com um resultado só: "Sem comparação ainda" e a lista
    // de sempre, sem tabela nem minigráfico. A Joana tem três exames, cada um
    // com um resultado.
    {
      const page = await abrir(pc, aba("joana", "clinico"));
      const txt = await limpo(painel(page));
      ok(txt.includes("Sem comparação ainda"), 'Joana: cada exame tem um resultado só, e a tela diz "Sem comparação ainda"', txt);
      ok((await tabela(page).count()) === 0 && (await painel(page).locator('svg[role="img"]').count()) === 0 &&
        (await painel(page).locator("summary", { hasText: "Ver todos" }).count()) === 0,
        "e não tem tabela, nem minigráfico, nem o botão \"Ver todos os resultados\"");
      const itens = await lista(page).locator("li").evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, " ").trim()));
      ok(itens.length === 3 && (await lista(page).isVisible()), "a lista de sempre aparece aberta, com os três resultados", itens.join(" | "));
      // (os dois de 20 dias atrás são do mesmo laudo: a ordem entre eles não importa)
      const glicemia = itens.find((t) => t.includes("Glicemia de jejum")) || "";
      ok(glicemia.includes("118 mg/dL") && glicemia.includes("alterado") && glicemia.includes("ref. 70 a 99") &&
        glicemia.includes("Repetir em 30 dias.") && (itens[2] || "").includes("Colesterol LDL"),
        "com a situação (alterado), a faixa e a observação de cada um, o mais novo primeiro (o LDL de 210 dias atrás por último)", itens.join(" | "));
      await fotografar(page, `${OUT}/clinico-sem-comparacao-desktop-claro.png`, COMPUTADOR);
      await page.close();
    }
    {
      const page = await abrir(pc, aba("pedro", "clinico"));
      ok((await limpo(painel(page))).includes("Nenhum exame registrado."), 'Pedro, sem exames: "Nenhum exame registrado."');
      await page.close();
    }

    // leitura dos exames que falha: o erro só no bloco Exames, nunca "Sem
    // comparação ainda" nem "Nenhum exame". O tratamento continua: antes, o
    // erro derrubava a aba inteira (e com 200 exames, para sempre).
    {
      await fetch(MOCK + "/__falhar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabela: "exams" }),
      });
      const page = await abrir(pc, aba("helena", "clinico"));
      const txt = await limpo(painel(page));
      ok(txt.includes("Não foi possível carregar os exames") && !txt.includes("Não foi possível carregar os dados clínicos") &&
        !txt.includes("Sem comparação ainda") && !txt.includes("Nenhum exame registrado") && (await tabela(page).count()) === 0,
        "exams falha: o erro só do bloco Exames, e não o da aba, \"Sem comparação ainda\", \"Nenhum exame\" nem tabela", txt);
      ok(txt.includes("Tratamento") && (txt.includes("Sem tratamento ativo") || txt.includes("Próxima dose")),
        "e o Tratamento continua na tela", txt);
      await page.close();
      await fetch(MOCK + "/__reset", { method: "POST" });
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
