// Requer: npm i -D playwright  (ver ferramentas/LEIAME.md)
// Abre o app no Chromium do container, faz login contra o Supabase de
// mentira e tira print de cada tela, em claro/escuro e celular/desktop.
const { chromium } = require("playwright");
const OUT = process.env.OUT || ".";

const TELAS = [
  ["inicio", "/app"],
  ["meu-plano", "/app/nutricionista"],
  ["dieta", "/app/dieta"],
  ["treinos", "/app/treinos"],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });

  for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
    for (const [disp, w, h, mobile] of [["mobile", 390, 844, true], ["desktop", 1280, 900, false]]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 2,
        isMobile: mobile,
        hasTouch: mobile,
        colorScheme: escuro ? "dark" : "light",
        locale: "pt-BR",
      });
      const page = await ctx.newPage();

      // Login real contra o mock: o app guarda os próprios cookies.
      await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
      // Sem esperar a hidratação, o clique cai antes do onSubmit do React
      // existir e o formulário faz submit nativo — fica na própria tela.
      await page.waitForTimeout(800);
      await page.fill('input[type="email"]', "maria.teste@exemplo.com");
      await page.fill('input[type="password"]', "qualquer-coisa");
      await page.click('button[type="submit"]');
      await page.waitForURL("**/app", { timeout: 20000 });

      for (const [nome, rota] of TELAS) {
        await page.goto("http://localhost:3000" + rota, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(700);
        const m = await page.evaluate(() => ({
          larg: window.innerWidth,
          doc: document.documentElement.scrollWidth,
          vaza: [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 4)
            .map((e) => e.tagName.toLowerCase() + "." + String(e.className).split(" ").slice(0, 2).join(".")),
        }));
        if (m.doc > m.larg) console.log(`  ⚠ ${nome}/${disp}/${tema}: documento ${m.doc}px > viewport ${m.larg}px  ${m.vaza.join(" | ")}`);
        await page.screenshot({ path: `${OUT}/${nome}-${disp}-${tema}.png`, fullPage: true });
      }
      console.log(`ok ${disp} ${tema}`);
      await ctx.close();
    }
  }
  await browser.close();
})();
