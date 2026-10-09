// Teste de fumaça da Início: cinco defeitos que já chegaram a produção.
// Precisa do mock e do dev no ar — ver LEIAME.md.
const { chromium } = require("playwright");
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.fill('input[type="email"]', "maria.teste@exemplo.com");
  await p.fill('input[type="password"]', "senha-de-mentira");
  await p.click('button[type="submit"]'); await p.waitForURL("**/app", { timeout: 25000 });
  await p.waitForTimeout(1200);

  const txt = await p.locator("body").innerText();
  const conta = (re) => (txt.match(re) || []).length;
  const ok = (b, m) => console.log(`${b ? "  OK  " : "  FALHA"}  ${m}`);

  // A data é calculada, não fixa: o teste foi escrito num dia e roda em
  // outro. O que se verifica é a FORMA — só a primeira letra maiúscula,
  // no fuso do Brasil, que é o que o app usa.
  const esperada = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long",
  });
  const comMaiuscula = esperada.charAt(0).toUpperCase() + esperada.slice(1);
  const achada = (txt.match(/\S+-feira, \d+ de \S+|\S+, \d+ de \S+/) || ["?"])[0];
  ok(achada === comMaiuscula, `(2) data: esperado "${comMaiuscula}" — achado "${achada}"`);
  ok(conta(/Seu nutricionista vê essa confirmação/g) === 1, `(5) nota do check-in aparece ${conta(/Seu nutricionista vê essa confirmação/g)}× (esperado 1)`);
  // innerText devolve o texto JÁ com o text-transform aplicado, então
  // "Recado" chega como "RECADO" — comparar sem distinguir maiúsculas.
  ok(!/RECADO DO SEU NUTRICIONISTA/i.test(txt) && /(^|\n)\s*recado\s*($|\n)/i.test(txt),
     "(4) rótulo interno é só 'Recado', sem repetir 'do seu nutricionista'");
  const doses = conta(/aplicação|caneta/gi);
  ok(doses <= 2, `(1) menções à dose: ${doses} (antes eram 4: cartão + pendência, cada um com título e subtítulo)`);

  await p.screenshot({ path: `${OUT}/v-topo.png` });

  // (3) o balão da Gaia some ao descer
  const fab = p.locator('button[aria-label="Abrir a Gaia"]');
  const antes = await fab.evaluate((e) => getComputedStyle(e).opacity);
  await p.evaluate(() => window.scrollBy(0, 600));
  await p.waitForTimeout(500);
  const depois = await fab.evaluate((e) => getComputedStyle(e).opacity);
  await p.screenshot({ path: `${OUT}/v-rolado.png` });
  await p.evaluate(() => window.scrollBy(0, -200));
  await p.waitForTimeout(500);
  const voltou = await fab.evaluate((e) => getComputedStyle(e).opacity);
  ok(antes === "1" && depois === "0" && voltou === "1",
     `(3) balão: topo=${antes} descendo=${depois} subindo=${voltou} (esperado 1 / 0 / 1)`);

  console.log("altura da Início:", await p.evaluate(() => document.documentElement.scrollHeight), "px");
  await b.close();
})();
