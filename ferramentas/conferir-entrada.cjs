// Verificações de tela da página de entrada (`/`), que passou a falar com a
// nutricionista (26/10): a antiga falava com o consumidor, com fotos externas,
// fundo preto e degradês que o app já não tem. Confere o título, a
// demonstração da fila, o botão da vaga (com e sem o número do WhatsApp), a
// largura no celular, as regras do visual (só cores `app-*`, sem caixa alta,
// degradê nem imagem), também com o `.dark` que o app deixa no <html> ao sair,
// e o redirecionamento do `/recursos`.
//
// O nome e o slogan saem de lib/marca.ts, para o script não quebrar quando o
// nome mudar. Precisa do dev no ar (ver LEIAME.md); a página não lê o banco e
// não pede login. Com o número no `.env.local`
// (NEXT_PUBLIC_WHATSAPP_VAGAS), passe os dígitos esperados em VAGAS (ex.:
// VAGAS=5511912345678); sem o número, rode sem VAGAS. Acusa com código de
// saída 1; com o dev fora do ar, sai com 2.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT = process.env.OUT || path.join(os.tmpdir(), "conferir-entrada");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VAGAS = process.env.VAGAS || "";

const marca = fs.readFileSync(path.join(__dirname, "..", "lib", "marca.ts"), "utf8");
const NOME = marca.match(/export const NOME = "([^"]+)"/)[1];
const SLOGAN = marca.match(/export const SLOGAN = "([^"]+)"/)[1];

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
  console.log(`\n${nome}`);
  try {
    await fn();
  } catch (e) {
    ok(false, `${nome}: a etapa não terminou`, String(e && e.message ? e.message : e).split("\n")[0]);
  }
}

const DEMONSTRACAO = [
  ["Ana R.", "1 mudança na sua prescrição"],
  ["Bruno M.", "5 dias sem registrar"],
  ["Carla S.", "Faltou a 2 treinos (7d)"],
  ["Diego T.", "1 exame fora da referência"],
];
const EM_BREVE = "As vagas de implantação abrem em breve.";

// Cor fora da paleta do app (slate, branco, brand…), caixa alta, degradê: o
// que a página antiga tinha e a linguagem do app tirou.
const COR_PROIBIDA =
  /(^|\s)([a-z0-9-]+:)*(bg|text|border|from|via|to|fill|stroke)-(slate|gray|zinc|neutral|stone|brand|emerald|green|white|black)(-|\s|$)/;

/** As classes e elementos que a página não pode ter. */
function proibidos(page) {
  return page.evaluate((fonte) => {
    const cor = new RegExp(fonte);
    const achados = [];
    for (const el of document.querySelectorAll("[class]")) {
      const c = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
      if (cor.test(c) || /(^|\s)(uppercase|tracking-wide|bg-gradient[^\s]*)(\s|$)/.test(c))
        achados.push(`${el.tagName.toLowerCase()}.${c.trim().split(/\s+/).join(".")}`);
    }
    for (const img of document.querySelectorAll("img")) achados.push(`img ${img.getAttribute("src")}`);
    return achados;
  }, COR_PROIBIDA.source);
}

const semRolagemLateral = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

(async () => {
  try {
    const r = await fetch(APP + "/", { redirect: "manual" });
    if (r.status >= 500) throw new Error(`status ${r.status}`);
  } catch (e) {
    console.error(`O dev não respondeu em ${APP} (${e.message}). Suba-o como o LEIAME manda.`);
    process.exit(2);
  }

  const b = await chromium.launch({ executablePath: CHROME });

  for (const [largura, altura] of [[390, 844], [1280, 800]]) {
    for (const escuro of [false, true]) {
      const tema = escuro ? "escuro" : "claro";
      await etapa(`Entrada em ${largura} px, ${tema}`, async () => {
        const ctx = await b.newContext({ viewport: { width: largura, height: altura } });
        const p = await ctx.newPage();
        await p.goto(APP + "/", { waitUntil: "networkidle", timeout: 120000 });
        // O escuro chega aqui herdado: quem sai do app com ele ligado navega
        // pelo cliente até o /login e o /, e o `.dark` fica no <html>.
        if (escuro) await p.evaluate(() => document.documentElement.classList.add("dark"));

        const h1 = (await p.locator("h1").allInnerTexts()).map((t) => t.trim());
        ok(h1.length === 1 && h1[0] === SLOGAN, `o h1 é o slogan (${JSON.stringify(h1)})`);

        const rotulo = p.getByText("Demonstração, com pacientes fictícios", { exact: true });
        ok(await rotulo.isVisible(), 'o rótulo "Demonstração, com pacientes fictícios" aparece');
        const texto = await p.locator("body").innerText();
        let ultimo = -1;
        let emOrdem = true;
        for (const [nome, frase] of DEMONSTRACAO) {
          const li = p.locator("li", { hasText: nome });
          const temOsDois = (await li.count()) === 1 && (await li.innerText()).includes(frase);
          ok(temOsDois, `a linha de ${nome} diz "${frase}"`);
          const i = texto.indexOf(nome);
          if (i <= ultimo) emOrdem = false;
          ultimo = i;
        }
        ok(emOrdem, "as quatro linhas vêm na ordem da fila");
        ok(texto.includes("30 dias grátis, sem cartão."), 'diz "30 dias grátis, sem cartão."');

        const links = p.locator('a[href^="https://wa.me/"]');
        const emBreve = texto.split(EM_BREVE).length - 1;
        if (VAGAS) {
          ok((await links.count()) === 2, `dois botões para o WhatsApp (${await links.count()})`);
          for (const a of await links.all()) {
            const href = await a.getAttribute("href");
            ok(href.startsWith(`https://wa.me/${VAGAS}?text=`), `o link vai a wa.me/${VAGAS} (${href.slice(0, 40)}…)`);
            ok((await a.getAttribute("target")) === "_blank", "abre em nova aba");
            ok(/\bnoopener\b/.test((await a.getAttribute("rel")) || ""), "com rel noopener");
            const msg = new URL(href).searchParams.get("text") || "";
            ok(msg.includes(`do ${NOME}.`) && msg.includes("CRN:"), "a mensagem traz o nome do app e o CRN");
          }
          ok(emBreve === 0, `não diz "${EM_BREVE}"`);
        } else {
          ok((await links.count()) === 0, "sem o número, nenhum link para o WhatsApp");
          ok(emBreve === 2, `diz "${EM_BREVE}" no lugar dos dois botões (${emBreve})`);
        }

        ok((await p.locator('a[href="/login"]', { hasText: "Entrar" }).count()) >= 1, '"Entrar" leva ao /login');
        ok(
          (await p.locator('a[href="/login"]', { hasText: "Recebi um convite do meu nutricionista" }).count()) === 1,
          "o rodapé leva o paciente convidado ao /login"
        );

        ok(await semRolagemLateral(p), "sem rolagem lateral");
        const ruins = await proibidos(p);
        ok(ruins.length === 0, "só cores app-*, sem caixa alta, degradê nem imagem", ruins.slice(0, 5).join(" | "));

        await p.screenshot({ path: path.join(OUT, `entrada-${largura}-${tema}.png`), fullPage: true });
        await ctx.close();
      });
    }
  }

  await etapa("Entrada em 320 px", async () => {
    const ctx = await b.newContext({ viewport: { width: 320, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(APP + "/", { waitUntil: "networkidle", timeout: 120000 });
    ok(await semRolagemLateral(p), "sem rolagem lateral em 320 px");
    await p.screenshot({ path: path.join(OUT, "entrada-320-claro.png"), fullPage: true });
    await ctx.close();
  });

  await etapa("/recursos", async () => {
    const r = await fetch(APP + "/recursos", { redirect: "manual" });
    const destino = r.headers.get("location");
    ok(r.status === 308, `responde 308 (${r.status})`);
    ok(destino && new URL(destino, APP).pathname === "/", `e manda para / (${destino})`);
  });

  await b.close();
  const falhas = resultados.filter((r) => !r).length;
  console.log(`\nPrints em ${OUT}.`);
  console.log(`${resultados.length - falhas}/${resultados.length} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
