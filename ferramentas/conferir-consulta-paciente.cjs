// O cartão de consulta do lado do paciente (Início e "Meu plano"), com a
// Maria do cenário padrão: ver a próxima, pedir remarcação, cancelar, pedir
// consulta e cancelar o pedido; e a medida que o nutri tirou na consulta, que
// a página Medidas marca e não deixa excluir (nem o banco deixa), e o Perfil,
// que não mostra o CRN. Acusa com código de saída 1.
//
// Precisa do mock SEM cenário (`node ferramentas/mock-supabase.cjs`) e do dev
// no ar (ver LEIAME.md). As consultas do mock voltam ao início antes e depois
// (POST /__reset).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT = process.env.OUT || path.join(os.tmpdir(), "prints-consulta-paciente");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TZ = "America/Sao_Paulo";
const diaSP = (n) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + n * 86400000));

const resultados = [];
function ok(passou, msg, detalhe = "") {
  resultados.push(passou);
  console.log(`  ${passou ? "OK   " : "FALHA"}  ${msg}`);
  if (!passou && detalhe) console.log(`         ${detalhe}`);
}
const erros = [];

/** Clica depois de o React hidratar o elemento: antes disso o clique não faz nada. */
async function clicar(loc) {
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.evaluate(
    (el) =>
      new Promise((resolve) => {
        const inicio = Date.now();
        (function esperar() {
          if (Object.keys(el).some((k) => k.startsWith("__reactProps$")) || Date.now() - inicio > 30000) return resolve();
          setTimeout(esperar, 100);
        })();
      })
  );
  await loc.click();
}

(async () => {
  const cen = await (await fetch(MOCK + "/__cenario")).json().catch(() => null);
  if (!cen || cen.cenario !== "padrao") {
    console.error(`O mock precisa subir sem CENARIO (veio: ${cen && cen.cenario}).`);
    process.exit(2);
  }
  await fetch(MOCK + "/__reset", { method: "POST" });

  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx0 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const p0 = await ctx0.newPage();
  for (let t = 1; ; t++) {
    await p0.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
    await p0.waitForTimeout(1200);
    await p0.fill('input[type="email"]', "maria.teste@exemplo.com");
    await p0.fill('input[type="password"]', "senha-de-mentira");
    await p0.click('button[type="submit"]');
    try {
      await p0.waitForURL("**/app", { timeout: 60000 });
      break;
    } catch (e) {
      if (t >= 3) throw e;
    }
  }
  const estado = await ctx0.storageState();
  await ctx0.close();

  const contexto = (w, h, mobile, escuro) =>
    browser.newContext({
      viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile,
      hasTouch: mobile, colorScheme: escuro ? "dark" : "light", locale: "pt-BR", storageState: estado,
    });
  const abrir = async (ctx, rota) => {
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && erros.push(`${rota}: ${m.text()}`));
    page.on("pageerror", (e) => erros.push(`${rota}: ${e.message}`));
    // Cancelar pede confirmação (window.confirm): aceita.
    page.on("dialog", (d) => d.accept());
    await page.goto(APP + rota, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator('section[aria-label="Consulta"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    return page;
  };
  const cartao = (page) => page.locator('section[aria-label="Consulta"]');
  const texto = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
  const esperarTexto = (page, t) =>
    page
      .waitForFunction((t) => document.querySelector('section[aria-label="Consulta"]')?.textContent?.includes(t), t, {
        timeout: 30000,
      })
      .catch(() => {});

  // Prints: Início e Meu plano, celular e computador, claro e escuro.
  console.log("\nPrints");
  for (const [nome, w, h, mobile] of [["mobile", 390, 844, true], ["desktop", 1440, 900, false]]) {
    for (const escuro of [false, true]) {
      const ctx = await contexto(w, h, mobile, escuro);
      if (escuro) await ctx.addInitScript(() => { try { localStorage.setItem("pf-theme", "dark"); } catch {} });
      for (const [tela, rota] of [["inicio", "/app"], ["meu-plano", "/app/nutricionista"]]) {
        const page = await abrir(ctx, rota);
        const doc = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(doc <= w, `sem transbordo: ${tela}/${nome}/${escuro ? "escuro" : "claro"} (${doc}px)`);
        await cartao(page).screenshot({ path: `${OUT}/consulta-${tela}-${nome}-${escuro ? "escuro" : "claro"}.png` });
        await page.close();
      }
      await ctx.close();
    }
  }

  console.log("\nO cartão");
  const cel = await contexto(390, 844, true, false);
  {
    const page = await abrir(cel, "/app");
    const t = await texto(cartao(page));
    ok(t.includes("Próxima consulta") && t.includes("às 14:00") && t.includes("online"),
      "Início: mostra a próxima consulta (daqui a 3 dias, 14:00, online)", t);
    // Pedir para remarcar: sem recado avisa; com recado, fica o aviso de enviado.
    await clicar(cartao(page).getByRole("button", { name: "Pedir para remarcar" }));
    await clicar(cartao(page).getByRole("button", { name: "Enviar pedido" }));
    await esperarTexto(page, "Diga qual horário");
    ok((await texto(cartao(page))).includes("Diga qual horário fica melhor."), "remarcação sem recado pede o recado");
    await cartao(page).locator("textarea").fill("Pode ser quinta de manhã?");
    await clicar(cartao(page).getByRole("button", { name: "Enviar pedido" }));
    await esperarTexto(page, "Pedido de remarcação enviado");
    ok((await texto(cartao(page))).includes("Pedido de remarcação enviado"), "depois de pedir, o cartão diz que o pedido de remarcação foi enviado");
    await page.close();
  }
  await fetch(MOCK + "/__reset", { method: "POST" });
  {
    const page = await abrir(cel, "/app");
    await clicar(cartao(page).getByRole("button", { name: "Cancelar", exact: true }));
    await esperarTexto(page, "Nenhuma consulta marcada");
    ok((await texto(cartao(page))).includes("Nenhuma consulta marcada"), "Cancelar (com confirmação) tira a consulta");

    // Pedir consulta: horário no passado é recusado; no futuro vira pedido.
    await clicar(cartao(page).getByRole("button", { name: "Pedir consulta" }));
    await cartao(page).locator('input[type="date"]').fill(diaSP(5));
    await cartao(page).locator('input[type="time"]').fill("09:30");
    await clicar(cartao(page).getByText("Online", { exact: true }));
    await cartao(page).locator("textarea").fill("Prefiro de manhã");
    await clicar(cartao(page).getByRole("button", { name: "Enviar pedido" }));
    await esperarTexto(page, "Pedido enviado para");
    const t = await texto(cartao(page));
    ok(t.includes("Pedido enviado para") && t.includes("às 09:30") && t.includes("online") && t.includes("Aguardando resposta"),
      "Pedir consulta: o cartão mostra o pedido aguardando o nutricionista", t);
    ok((await cartao(page).getByRole("button", { name: "Pedir consulta" }).count()) === 0, "com um pedido aberto, não dá para pedir outro");
    await clicar(cartao(page).getByRole("button", { name: "Cancelar pedido" }));
    await esperarTexto(page, "Nenhuma consulta marcada");
    ok((await texto(cartao(page))).includes("Nenhuma consulta marcada"), "Cancelar pedido volta ao 'Pedir consulta'");
    await page.close();
  }
  {
    const page = await abrir(cel, "/app/nutricionista");
    ok((await texto(cartao(page))).includes("Consulta"), '"Meu plano" também tem o cartão de consulta');
    await page.close();
  }
  await cel.close();
  await fetch(MOCK + "/__reset", { method: "POST" });

  // A medida da consulta (Task 9). No mock da Maria, a de 20 dias atrás é a que
  // o nutri tirou na consulta ap-m1: measured_by dele, ligada à consulta.
  console.log("\nMedidas: a medida da consulta");
  {
    const DIA_DA_CONSULTA = diaSP(-20).split("-").reverse().join("/");
    const MARCA = "Medida na consulta";
    const ctx = await contexto(390, 844, true, false);
    // O DELETE derrubado de propósito (abaixo) faz o navegador registrar o 500
    // como erro de console; só esse, e só nessa página.
    const abrirMedidas = async ({ tolera500 = false } = {}) => {
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        if (tolera500 && /status of 500/.test(m.text())) return;
        erros.push(`/app/medidas: ${m.text()}`);
      });
      page.on("pageerror", (e) => erros.push(`/app/medidas: ${e.message}`));
      page.on("dialog", (d) => d.accept()); // "Excluir este registro?"
      await page.goto(APP + "/app/medidas", { waitUntil: "networkidle", timeout: 120000 });
      await page.getByText("Peso atual", { exact: true }).waitFor({ timeout: 60000 });
      await page.locator("div.space-y-2 > div.card").first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(500);
      return page;
    };
    const linhas = (page) => page.locator("div.space-y-2 > div.card");
    const excluir = (page) => page.getByRole("button", { name: /^Excluir registro/ });
    const mockTem = async (id) =>
      (await (await fetch(`${MOCK}/rest/v1/body_measurements?id=eq.${id}`)).json()).length === 1;

    // a) a linha da consulta tem a marca e nenhum excluir; as dela têm
    {
      const page = await abrirMedidas();
      const total = await linhas(page).count();
      ok(total === 8, `a lista tem as 8 medidas (${total})`);
      ok((await page.getByText(MARCA, { exact: true }).count()) === 1, `só uma linha tem a marca "${MARCA}"`);
      const daConsulta = linhas(page).filter({ hasText: MARCA });
      const textoDaLinha = (await daConsulta.count()) === 1 ? await texto(daConsulta) : "(nenhuma linha com a marca)";
      ok(textoDaLinha.includes(DIA_DA_CONSULTA), `e é a do dia da consulta (${DIA_DA_CONSULTA})`, textoDaLinha);
      // A linha do dia, marcada ou não, é achada pela data: a 20 dias atrás.
      const doDia = linhas(page).filter({ hasText: DIA_DA_CONSULTA });
      ok((await doDia.count()) === 1 && (await doDia.getByRole("button").count()) === 0,
        "a linha da consulta não tem botão nenhum (nem excluir)");
      ok((await excluir(page).count()) === 7, `as outras 7 linhas têm o excluir (${await excluir(page).count()})`);
      ok((await linhas(page).filter({ hasNotText: MARCA }).getByRole("button", { name: /^Excluir registro/ }).count()) === 7,
        "e os 7 estão nas linhas sem a marca");
      const doc = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(doc <= 390, `Medidas sem transbordo no celular (${doc}px)`);
      await page.screenshot({ path: `${OUT}/medidas-mobile-claro.png`, fullPage: true });
      await page.close();
    }

    // b) excluir uma das dela continua funcionando
    {
      const page = await abrirMedidas();
      await clicar(excluir(page).first());
      await page.waitForFunction(() => document.querySelectorAll("div.space-y-2 > div.card").length === 7, null, { timeout: 30000 })
        .catch(() => {});
      ok((await linhas(page).count()) === 7, "excluir uma medida dela tira a linha da lista");
      ok((await page.getByText(MARCA, { exact: true }).count()) === 1, "e a da consulta continua lá, com a marca");
      ok(!(await texto(page.locator("body"))).includes("não pode ser apagado"), "sem aviso de erro");
      await page.close();
      await fetch(MOCK + "/__reset", { method: "POST" });
    }

    // c) lista velha: a página ainda tem a linha da consulta como dela (a marca
    // só chegou depois). O banco recusa SEM erro (zero linhas); a tela tem de
    // dizer isso e manter a linha, e não fingir que apagou.
    {
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && erros.push(`/app/medidas (lista velha): ${m.text()}`));
      page.on("pageerror", (e) => erros.push(`/app/medidas (lista velha): ${e.message}`));
      page.on("dialog", (d) => d.accept());
      await page.route("**/rest/v1/body_measurements*", async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const resp = await route.fetch();
        const dados = await resp.json();
        await route.fulfill({ response: resp, json: dados.map((l) => ({ ...l, measured_by: null, appointment_id: null })) });
      });
      await page.goto(APP + "/app/medidas", { waitUntil: "networkidle", timeout: 120000 });
      await linhas(page).first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(500);
      ok((await excluir(page).count()) === 8, "com a lista velha, as 8 linhas oferecem o excluir");
      await clicar(page.getByRole("button", { name: `Excluir registro de ${DIA_DA_CONSULTA}` }));
      const aviso = page.getByText("Este registro não pode ser apagado.", { exact: true });
      ok(await aviso.waitFor({ state: "visible", timeout: 30000 }).then(() => true, () => false),
        'o banco recusou sem erro: a tela diz "Este registro não pode ser apagado."');
      ok((await linhas(page).count()) === 8, "e a linha continua na lista");
      ok(await mockTem("m5"), "e a medida da consulta continua no banco");
      await page.screenshot({ path: `${OUT}/medidas-recusada-mobile-claro.png`, fullPage: true });
      await page.close();
    }

    // d) erro de verdade no DELETE (não é o silêncio): também aparece
    {
      const page = await abrirMedidas({ tolera500: true });
      await page.route("**/rest/v1/body_measurements*", (route) =>
        route.request().method() === "DELETE"
          ? route.fulfill({
              status: 500, headers: { "access-control-allow-origin": "*" },
              json: { code: "XX000", message: "falha sob encomenda", details: null, hint: null },
            })
          : route.continue());
      await clicar(excluir(page).first());
      const aviso = page.getByText("Não foi possível excluir o registro. Tente de novo.", { exact: true });
      ok(await aviso.waitFor({ state: "visible", timeout: 30000 }).then(() => true, () => false),
        "erro no DELETE: a tela avisa que não foi possível excluir");
      ok((await linhas(page).count()) === 8, "e a linha continua na lista");
      await page.close();
    }
    await ctx.close();
    await fetch(MOCK + "/__reset", { method: "POST" });
  }

  console.log("\nPerfil: o paciente não vê o CRN");
  {
    const ctx = await contexto(390, 844, true, false);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && erros.push(`/app/perfil: ${m.text()}`));
    page.on("pageerror", (e) => erros.push(`/app/perfil: ${e.message}`));
    await page.goto(APP + "/app/perfil", { waitUntil: "networkidle", timeout: 120000 });
    await page.getByText("Nome completo", { exact: true }).waitFor({ timeout: 60000 });
    ok((await page.getByText("CRN", { exact: false }).count()) === 0, "o Perfil do paciente não tem o campo CRN");
    ok((await page.getByText("prontuário", { exact: false }).count()) === 0, 'e nada sobre "prontuário"');
    await page.close();
    await ctx.close();
  }

  console.log("\nConsole");
  ok(erros.length === 0, `nenhum erro de console ou de página (${erros.length})`, [...new Set(erros)].slice(0, 6).join("\n         "));
  await browser.close();
  const falhas = resultados.filter((r) => !r).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
