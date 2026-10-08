const { chromium } = require("playwright");
const OUT = process.env.OUT;
const QUEM = process.env.QUEM || "maria.teste@exemplo.com";
const TELAS = JSON.parse(process.env.TELAS);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.fill('input[type="email"]', QUEM);
  await p.fill('input[type="password"]', "senha-de-mentira");
  await p.click('button[type="submit"]'); await p.waitForURL("**/app", { timeout: 25000 });
  await p.waitForTimeout(1000);
  for (const [nome, rota] of TELAS) {
    await p.goto("http://localhost:3000" + rota, { waitUntil: "networkidle" }).catch(()=>{});
    await p.waitForTimeout(1100);
    const m = await p.evaluate(() => ({
      alt: document.documentElement.scrollHeight,
      doc: document.documentElement.scrollWidth, larg: window.innerWidth,
      h1: document.querySelector("h1")?.textContent?.trim()?.slice(0,40) || "(sem h1)",
      erro: /Application error|server-side exception/i.test(document.body.innerText),
    }));
    console.log(`${nome.padEnd(14)} ${String(m.alt).padStart(5)}px  h1="${m.h1}"${m.doc>m.larg?"  ⚠TRANSBORDA":""}${m.erro?"  ⚠ERRO":""}`);
    await p.screenshot({ path: `${OUT}/x-${nome}.png`, fullPage: true });
  }
  await b.close();
})();
