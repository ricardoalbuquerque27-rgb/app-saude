// Verificações de tela da Início do paciente, como a Maria do cenário padrão,
// em 390 px. Começou como teste de fumaça de cinco defeitos que chegaram a
// produção (1 a 5) e cobre agora a Início reorganizada (spec do visual do app
// do paciente, "Início (paciente)"): a ordem das seções, a saudação, o "Para
// hoje" e a leitura que falha, os anéis, o Score que se explica, a sugestão de
// proteína, a água em um toque, o Progresso de 30 dias e os links. Acusa com
// código de saída 1.
//
// Precisa do mock SEM cenário (`node ferramentas/mock-supabase.cjs`) e do dev
// no ar (ver LEIAME.md). O mock volta ao início antes e depois (POST
// /__reset), e cada `/__falhar` tem o seu `/__reset` num `finally`: um
// timeout no meio não deixa o mock falhando para o roteiro seguinte.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT = process.env.OUT || path.join(os.tmpdir(), "conferir-inicio");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TZ = "America/Sao_Paulo";
const hojeSP = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// A saudação pela hora de São Paulo, escrita aqui de novo e à mão de
// propósito: se o app e o roteiro errassem juntos, seria a mesma conta.
const saudacaoEm = (ms) => {
  const h =
    Number(
      new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" })
        .formatToParts(new Date(ms))
        .find((p) => p.type === "hour").value
    ) % 24;
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
};

const resultados = [];
function ok(passou, msg, detalhe = "") {
  resultados.push(!!passou);
  console.log(`  ${passou ? "OK   " : "FALHA"}  ${msg}`);
  if (!passou && detalhe) console.log(`         ${detalhe}`);
}
/** Uma etapa que lança (elemento que não existe, timeout) vira FALHA, e o roteiro segue. */
async function etapa(nome, fn) {
  try {
    await fn();
  } catch (e) {
    ok(false, `${nome}: a etapa não terminou`, String(e && e.message ? e.message : e).split("\n")[0]);
  }
}

const reset = () => fetch(MOCK + "/__reset", { method: "POST" });
/** Largura e altura da caixa de um elemento (o alvo de toque), em px. */
const caixa = async (loc) => {
  const r = await loc.boundingBox();
  return r ? { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } : null;
};
const alvo44 = (c) => !!c && c.w >= 44 && c.h >= 44;
/** O token da Maria, para o que o roteiro grava no mock sem passar pela tela. */
const entrarComoMaria = async () =>
  (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "maria.teste@exemplo.com", password: "senha-de-mentira" }),
  })).json();
/** Roda `fn` com os GET de `tabela` dando 500, e SEMPRE volta o mock depois. */
// Com `{ escrita: true }`, só as escritas da tabela falham (as leituras seguem).
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

/** Roda `fn` e volta o mock ao início depois, mesmo se `fn` lançar. */
async function comEstado(fn) {
  try {
    return await fn();
  } finally {
    await reset();
  }
}

/** Espera o React hidratar o elemento: antes disso o clique não faz nada. */
async function hidratado(loc) {
  await loc.waitFor({ state: "visible", timeout: 30000 });
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
}
async function clicar(loc) {
  await hidratado(loc);
  await loc.click();
}

(async () => {
  const cen = await (await fetch(MOCK + "/__cenario")).json().catch(() => null);
  if (!cen || cen.cenario !== "padrao") {
    console.error(`O mock precisa subir sem CENARIO (veio: ${cen && cen.cenario}).`);
    process.exit(2);
  }
  await reset();

  const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const p = await ctx.newPage();
  for (let t = 1; ; t++) {
    await p.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.fill('input[type="email"]', "maria.teste@exemplo.com");
    await p.fill('input[type="password"]', "senha-de-mentira");
    await p.click('button[type="submit"]');
    try {
      await p.waitForURL("**/app", { timeout: 60000 });
      break;
    } catch (e) {
      if (t >= 3) throw e;
    }
  }
  const carregar = async () => {
    await p.goto(APP + "/app", { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("h1").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(600);
  };
  /** O painel da Gaia aberto: a que distância do fundo e da barra ele acaba, e se o balão saiu de cena. */
  const medirPainel = () =>
    p.evaluate(() => {
      const painel = document.querySelector('button[aria-label="Fechar"]')?.closest("div.fixed");
      const nav = document.querySelector("nav.fixed.inset-x-0.bottom-0");
      if (!painel || !nav) return null;
      const r = painel.getBoundingClientRect();
      return {
        top: Math.round(r.top), b: r.bottom, doFundo: Math.round((innerHeight - r.bottom) * 100) / 100,
        barra: nav.getBoundingClientRect().top, balao: !!document.querySelector('button[aria-label="Abrir a Gaia"]'),
      };
    });
  const antesMs = Date.now();
  await carregar();
  const depoisMs = Date.now();

  const txt = await p.locator("body").innerText();
  const conta = (re) => (txt.match(re) || []).length;

  // Localizadores das seções e dos anéis.
  const secao = (titulo) => p.locator("section", { has: p.getByRole("heading", { name: titulo, exact: true }) });
  const anel = (rotulo) => p.locator("figure", { has: p.locator("figcaption", { hasText: rotulo }) });
  const numeroDoAnel = async (rotulo) => {
    const t = await anel(rotulo).locator(".tabular").first().innerText({ timeout: 5000 });
    return Number(t.trim().replace(/\./g, "").replace(",", "."));
  };

  console.log("\nOs cinco de sempre");
  // A data é calculada, não fixa: o teste foi escrito num dia e roda em
  // outro. O que se verifica é a FORMA — só a primeira letra maiúscula,
  // no fuso do Brasil, que é o que o app usa.
  const esperada = new Date().toLocaleDateString("pt-BR", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  });
  const comMaiuscula = esperada.charAt(0).toUpperCase() + esperada.slice(1);
  const achada = (txt.match(/\S+-feira, \d+ de \S+|\S+, \d+ de \S+/) || ["?"])[0];
  ok(achada === comMaiuscula, `(2) data: esperado "${comMaiuscula}" — achado "${achada}"`);
  ok(conta(/Seu nutricionista vê essa confirmação/g) === 1, `(5) nota do check-in aparece ${conta(/Seu nutricionista vê essa confirmação/g)}× (esperado 1)`);
  // O nome do nutricionista vem como "de {primeiro nome}", nunca "do"/"da"
  // (o mock tem "Ricardo Albuquerque"), e o rótulo antigo em caixa alta saiu.
  {
    const titulo = await p.getByText("Recado de Ricardo", { exact: true }).count();
    ok(titulo >= 1 && !/Recado d[oa] /i.test(txt) && !/RECADO DO SEU NUTRICIONISTA/i.test(txt),
      `(4) o título do recado é "Recado de Ricardo" (${titulo}×), sem "do"/"da" nem "RECADO DO SEU NUTRICIONISTA"`);
  }
  const doses = conta(/aplicação|caneta/gi);
  ok(doses <= 2, `(1) menções à dose: ${doses} (antes eram 4: cartão + pendência, cada um com título e subtítulo)`);

  console.log("\nOrdem e saudação");
  await etapa("ordem", async () => {
    const alvos = [
      ["linha da consulta", p.locator('a[href="/app/nutricionista#consulta"]')],
      ["Para hoje", p.getByRole("heading", { name: "Para hoje", exact: true })],
      ["Registrar", p.getByRole("heading", { name: "Registrar", exact: true })],
      ["Seu dia", p.getByRole("heading", { name: "Seu dia", exact: true })],
      ["Progresso", p.getByRole("heading", { name: "Progresso", exact: true })],
      ["links", p.locator('a[href="/app/treinos"]', { hasText: "Treinos recentes" })],
    ];
    const ys = [];
    for (const [nome, loc] of alvos) {
      const n = await loc.count();
      ys.push([nome, n === 1 ? (await loc.boundingBox()).y : null]);
    }
    const emOrdem = ys.every(([, y]) => y != null) && ys.every(([, y], i) => i === 0 || y > ys[i - 1][1]);
    ok(emOrdem, "ordem: consulta, Para hoje, Registrar, Seu dia, Progresso, links",
      ys.map(([n, y]) => `${n}=${y == null ? "ausente" : Math.round(y)}`).join(" · "));
  });
  await etapa("saudação", async () => {
    const h1 = (await p.locator("h1").first().innerText()).trim();
    const aceitas = [...new Set([saudacaoEm(antesMs), saudacaoEm(depoisMs)])].map((s) => `${s}, Maria`);
    ok(aceitas.includes(h1), `saudação pela hora de São Paulo: esperado ${aceitas.map((a) => `"${a}"`).join(" ou ")} — achado "${h1}"`);
    const tam = await p.locator("h1").first().evaluate((e) => getComputedStyle(e).fontSize);
    ok(tam === "24px", `o h1 tem 24 px (${tam})`);
  });

  console.log("\nPara hoje");
  await etapa("Para hoje", async () => {
    await carregar();
    const s = secao("Para hoje");
    const cab = (await s.innerText()).split("\n").slice(0, 3).join(" ");
    const m = /(\d+) pendentes?/.exec(cab);
    const linhas = await s.locator("ul > li").count();
    // A linha do treino já confirmado aparece, mas não conta (spec): é a que
    // tem um botão apertado.
    const feitas = await s.locator("ul > li", { has: p.locator('[aria-pressed="true"]') }).count();
    ok(!!m && Number(m[1]) === linhas - feitas,
      `"N pendentes" igual às linhas pendentes: ${m ? m[0] : "(sem contagem)"} · ${linhas} linhas, ${feitas} feitas`);
    // A regra do check-in no treino do nutricionista ainda sem resposta: "Fui"
    // sólido (primária) e "Não fui" secundário, 44 px e letra de 14 px. Os três
    // estados, nas três telas, vêm na etapa "Check-in", abaixo.
    const linhaDoNutri = s.locator("ul > li", { hasText: "do seu nutricionista" }).first();
    const estilos = await linhaDoNutri.evaluate((li) => {
      const cor = (v) => {
        const ref = document.createElement("span");
        ref.style.backgroundColor = `var(${v})`;
        document.body.appendChild(ref);
        const c = getComputedStyle(ref).backgroundColor;
        ref.remove();
        return c;
      };
      const botao = (nome) => [...li.querySelectorAll("button")].find((b) => b.textContent.trim() === nome);
      const ler = (b) => b && { fundo: getComputedStyle(b).backgroundColor, h: b.getBoundingClientRect().height, letra: getComputedStyle(b).fontSize };
      return { fui: ler(botao("Fui")), naoFui: ler(botao("Não fui")), primaria: cor("--app-primaria"), cartao: cor("--app-cartao") };
    });
    ok(!!estilos.fui && estilos.fui.fundo === estilos.primaria && !!estilos.naoFui && estilos.naoFui.fundo === estilos.cartao,
      '"Fui" sólido em app-primaria e "Não fui" secundário (fundo de cartão)', JSON.stringify(estilos));
    ok(!!estilos.fui && !!estilos.naoFui && estilos.fui.h >= 44 && estilos.naoFui.h >= 44 && estilos.fui.letra === "14px" && estilos.naoFui.letra === "14px",
      `os dois com 44 px e letra de 14 px (${estilos.fui && estilos.fui.h}/${estilos.naoFui && estilos.naoFui.h} px, ${estilos.fui && estilos.fui.letra})`);
  });
  await etapa("Para hoje com leitura falhando", async () => {
    await comFalha("patient_notes", async () => {
      await carregar();
      const t = await secao("Para hoje").innerText().catch(() => "");
      ok(t.includes("Não deu para carregar tudo"), 'recados falhando: "Não deu para carregar tudo" aparece', t.slice(0, 160));
      ok(t !== "" && !/em dia/.test(t), 'e o cartão (que está na tela) não diz "em dia"');
      // A contagem seria só do que chegou: o cabeçalho fica só com o título.
      const cab = (await secao("Para hoje").locator(":scope > div").first().innerText().catch(() => "")).trim();
      ok(cab === "Para hoje", `e o cabeçalho não mostra "N pendentes" (a contagem é parcial): "${cab}"`);
      await p.screenshot({ path: `${OUT}/para-hoje-falhou.png`, fullPage: true });
    });
  });

  console.log("\nCheck-in: uma regra só (Início, leitura do treino e Treinos)");
  // A mesma regra nas três telas (components/PlanCheckIn.tsx,
  // BotoesDoCheckIn): sem resposta, "Fui" sólido e "Não fui" secundário;
  // feito, "Feito" com o check no fundo da principal (e não o mesmo sólido do
  // sem resposta); não fui, "Fui" secundário e "Não fui" em aviso. O treino
  // próprio só tem "Fiz". O mock guarda o check-in (plan_completions), e o
  // `comEstado` o apaga no fim.
  // Antes de ler: o ponteiro sai de cima (o secundário tem fundo de hover) e as
  // transições terminam. O botão que o React reaproveita (Início e leitura do
  // treino) passa 200 ms entre uma cor e outra (`.tappable`), e a leitura logo
  // depois do clique pegava a cor do meio do caminho. Só as animações finitas
  // da área: o giro do `Loader2` nunca termina.
  const lerBotoes = async (raiz) => {
    await p.mouse.move(1, 1);
    return raiz.evaluate(async (el) => {
      const finitas = el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity);
      await Promise.race([
        Promise.all(finitas.map((a) => a.finished.catch(() => {}))),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
      const cor = (v) => {
        const ref = document.createElement("span");
        ref.style.backgroundColor = `var(${v})`;
        document.body.appendChild(ref);
        const c = getComputedStyle(ref).backgroundColor;
        ref.remove();
        return c;
      };
      return {
        botoes: [...el.querySelectorAll("button[aria-pressed]")].map((b) => ({
          texto: b.textContent.trim(),
          fundo: getComputedStyle(b).backgroundColor,
          h: Math.round(b.getBoundingClientRect().height * 10) / 10,
          apertado: b.getAttribute("aria-pressed") === "true",
          icone: !!b.querySelector("svg"),
        })),
        primaria: cor("--app-primaria"),
        primariaFundo: cor("--app-primaria-fundo"),
        cartao: cor("--app-cartao"),
        atencaoFundo: cor("--app-atencao-fundo"),
      };
    });
  };
  const resumoDosBotoes = (r) => r.botoes.map((b) => `${b.texto}[${b.fundo}${b.apertado ? ", apertado" : ""}]`).join(" ");
  /** Os três estados de um treino prescrito, tocando nos botões; termina como começou. */
  async function tresEstados(tela, raiz, prefixo) {
    const btn = (nome) => raiz().getByRole("button", { name: nome, exact: true });
    await hidratado(btn("Fui"));
    const r1 = await lerBotoes(raiz());
    const [fui1, nao1] = r1.botoes;
    ok(r1.botoes.length === 2 && fui1.texto === "Fui" && fui1.fundo === r1.primaria && !fui1.apertado &&
        nao1.texto === "Não fui" && nao1.fundo === r1.cartao && !nao1.apertado,
      `${tela}, sem resposta: "Fui" sólido e "Não fui" secundário`, resumoDosBotoes(r1));
    ok(r1.botoes.every((b) => b.h >= 44), `${tela}: os botões com 44 px (${r1.botoes.map((b) => b.h).join(" / ")})`);
    await raiz().screenshot({ path: `${OUT}/${prefixo}-sem-resposta.png` });

    await clicar(btn("Fui"));
    await btn("Feito").waitFor({ timeout: 30000 });
    const r2 = await lerBotoes(raiz());
    const [feito, nao2] = r2.botoes;
    ok(r2.botoes.length === 2 && feito.texto === "Feito" && feito.apertado && feito.icone && feito.fundo === r2.primariaFundo &&
        nao2.fundo === r2.cartao && !nao2.apertado,
      `${tela}, feito: "Feito" com o check no fundo da principal e "Não fui" secundário`, resumoDosBotoes(r2));
    ok(feito.fundo !== fui1.fundo, `${tela}: o feito tem outro fundo que o sem resposta (${fui1.fundo} → ${feito.fundo})`);
    await raiz().screenshot({ path: `${OUT}/${prefixo}-feito.png` });

    await clicar(btn("Não fui"));
    await raiz().locator('button[aria-pressed="true"]', { hasText: "Não fui" }).waitFor({ timeout: 30000 });
    const r3 = await lerBotoes(raiz());
    const [fui3, nao3] = r3.botoes;
    ok(r3.botoes.length === 2 && fui3.texto === "Fui" && fui3.fundo === r3.cartao && !fui3.apertado &&
        nao3.texto === "Não fui" && nao3.apertado && nao3.fundo === r3.atencaoFundo,
      `${tela}, não fui: "Fui" secundário e "Não fui" em aviso`, resumoDosBotoes(r3));
    await raiz().screenshot({ path: `${OUT}/${prefixo}-nao-fui.png` });

    await clicar(btn("Não fui"));
    await raiz().locator('button[aria-pressed="true"]').waitFor({ state: "detached", timeout: 30000 });
    const r4 = await lerBotoes(raiz());
    ok(r4.botoes.length === 2 && r4.botoes[0].fundo === r4.primaria && !r4.botoes.some((b) => b.apertado),
      `${tela}: tocar de novo desfaz e volta ao "Fui" sólido`, resumoDosBotoes(r4));
  }
  /** O treino próprio: só "Fiz" (sem "Não fui"), sólido, e "Feito" depois de tocar. */
  async function soFiz(tela, raiz) {
    const btn = (nome) => raiz().getByRole("button", { name: nome, exact: true });
    await hidratado(btn("Fiz"));
    const r1 = await lerBotoes(raiz());
    ok(r1.botoes.length === 1 && r1.botoes[0].texto === "Fiz" && r1.botoes[0].fundo === r1.primaria && r1.botoes[0].h >= 44,
      `${tela}, treino próprio: só "Fiz", sólido, com 44 px`, resumoDosBotoes(r1));
    await clicar(btn("Fiz"));
    await btn("Feito").waitFor({ timeout: 30000 });
    const r2 = await lerBotoes(raiz());
    ok(r2.botoes.length === 1 && r2.botoes[0].apertado && r2.botoes[0].fundo === r2.primariaFundo,
      `${tela}, treino próprio feito: "Feito" no fundo da principal`, resumoDosBotoes(r2));
    await clicar(btn("Feito"));
    await btn("Fiz").waitFor({ timeout: 30000 });
  }
  await etapa("check-in na Início", () => comEstado(async () => {
    await carregar();
    const doNutri = () => secao("Para hoje").locator("ul > li", { hasText: "do seu nutricionista" }).first();
    const proprio = () => secao("Para hoje").locator("ul > li", { hasText: "seu treino" }).first();
    await tresEstados("Início", doNutri, "checkin-inicio");
    await soFiz("Início", proprio);
  }));
  await etapa("check-in na leitura do treino", () => comEstado(async () => {
    await carregar();
    const linkDe = async (texto) =>
      secao("Para hoje").locator("ul > li", { hasText: texto }).first().locator('a[href^="/app/treino/"]').getAttribute("href");
    const [doNutri, proprio] = [await linkDe("do seu nutricionista"), await linkDe("seu treino")];
    const cartaoDoCheckIn = () => p.locator(".card", { hasText: "Você treinou hoje?" });
    await p.goto(APP + doNutri, { waitUntil: "networkidle", timeout: 120000 });
    await tresEstados("treino/[id]", cartaoDoCheckIn, "checkin-treino");
    await p.goto(APP + proprio, { waitUntil: "networkidle", timeout: 120000 });
    await soFiz("treino/[id]", cartaoDoCheckIn);
  }));
  await etapa("check-in em Treinos", () => comEstado(async () => {
    await p.goto(APP + "/app/treinos", { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Treinos", exact: true }).waitFor({ timeout: 60000 });
    // O cartão de hoje; num dia sem treino prescrito (o mock tem de segunda,
    // terça, quinta, sexta e sábado), a primeira sessão do nutri da semana que
    // já tem check-in.
    const hoje = p.locator("div.card", { has: p.getByText("hoje", { exact: true }) });
    const comCheckIn = (loc) => loc.filter({ has: p.locator("button[aria-pressed]") });
    const doNutriHoje = comCheckIn(hoje.locator("li", { has: p.getByText("do nutri", { exact: true }) }));
    await hoje.first().waitFor({ timeout: 60000 });
    const doNutri = (await doNutriHoje.count())
      ? () => doNutriHoje.first()
      : () => comCheckIn(p.locator("li", { has: p.getByText("do nutri", { exact: true }) })).first();
    await tresEstados("Treinos", doNutri, "checkin-treinos");
    // "Iniciar treino" continua o primário da sessão, acima do check-in.
    const ordem = await doNutri().evaluate((li) => {
      const iniciar = [...li.querySelectorAll("button")].find((b) => b.textContent.trim() === "Iniciar treino");
      const fui = [...li.querySelectorAll("button")].find((b) => b.textContent.trim() === "Fui");
      return iniciar && fui ? iniciar.getBoundingClientRect().bottom <= fui.getBoundingClientRect().top : null;
    });
    if (ordem !== null) ok(ordem, '"Iniciar treino" vem acima do check-in');
    const proprio = () => comCheckIn(hoje.locator("li", { hasNot: p.getByText("do nutri", { exact: true }) })).first();
    await soFiz("Treinos", proprio);
  }));

  console.log("\nSeu dia: anéis");
  await etapa("anéis", async () => {
    await carregar();
    const calorias = await anel("Calorias").locator("figcaption").innerText();
    ok(calorias.trim() === "Calorias · limite", `"Calorias · limite" (meta de peso 62 kg, abaixo do peso atual) — achado "${calorias.trim()}"`);
    const centro = anel("Calorias").locator(".tabular").first();
    const fvn = await centro.evaluate((e) => getComputedStyle(e).fontVariantNumeric);
    ok(/tabular-nums/.test(fvn), `o centro do anel tem font-variant-numeric com tabular-nums (${fvn})`);
    // Prova que a fonte servida pelo next/font manteve o `tnum`: sem ele, o
    // "1" é mais estreito que o "0" e os números do anel dançam.
    const [w0, w1] = await centro.evaluate((e) => {
      const cs = getComputedStyle(e);
      const medir = (texto) => {
        const s = document.createElement("span");
        s.textContent = texto;
        for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariantNumeric", "fontFeatureSettings", "letterSpacing"])
          s.style[k] = cs[k];
        Object.assign(s.style, { position: "absolute", whiteSpace: "nowrap", visibility: "hidden" });
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      };
      return [medir("000"), medir("111")];
    });
    ok(Math.abs(w0 - w1) <= 0.5, `"000" e "111" medem o mesmo no estilo do centro (${w0.toFixed(2)} e ${w1.toFixed(2)} px)`);
  });
  await etapa("acima do limite", async () => {
    // Uma refeição de 2.400 kcal hoje passa da meta de 1.800: com o papel
    // "limite", o anel diz "acima do limite". A proteína (150 g, meta 110)
    // também passa e NÃO avisa: proteína nunca avisa acima.
    const sessao = await entrarComoMaria();
    try {
      const r = await fetch(`${MOCK}/rest/v1/meals`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
        body: JSON.stringify({ user_id: sessao.user.id, date: hojeSP(), meal_type: "Ceia", description: "Verificação do anel",
          calories: 2400, protein_g: 150, carbs_g: 200, fat_g: 90 }),
      });
      ok(r.status === 201, `preparo: refeição de 2.400 kcal gravada no mock (${r.status})`);
      await carregar();
      const aviso = anel("Calorias").getByText("acima do limite", { exact: true });
      ok((await aviso.count()) === 1, 'calorias acima da meta, com papel "limite": o anel diz "acima do limite"');
      if (await aviso.count()) {
        const [cor, atencao] = await aviso.evaluate((e) => {
          const ref = document.createElement("span");
          ref.style.color = "var(--app-atencao)";
          document.body.appendChild(ref);
          const c = getComputedStyle(ref).color;
          ref.remove();
          return [getComputedStyle(e).color, c];
        });
        ok(cor === atencao, `e em app-atencao (${cor})`);
      }
      ok((await anel("Proteína").count()) === 1 && (await anel("Proteína").getByText("acima do limite").count()) === 0,
        "a proteína passou da meta e não avisa");
      await anel("Calorias").screenshot({ path: `${OUT}/anel-acima.png` });
    } finally {
      await reset();
    }
  });

  console.log("\nSeu dia: Score e sugestão");
  await etapa("Score", async () => {
    await carregar();
    const resumo = p.locator("summary", { hasText: /^score \d+ · / });
    ok((await resumo.count()) === 1, `o Score é um <details> com "score N · rótulo" (${await resumo.count()})`);
    await clicar(resumo);
    await p.waitForTimeout(300);
    const aberto = resumo.locator("xpath=..");
    const t = await aberto.innerText();
    const pilares = ["Sono", "Movimento", "Nutrição", "Hidratação e bem-estar"];
    ok(pilares.every((n) => t.includes(n)), `aberto, mostra os quatro pilares (${pilares.filter((n) => t.includes(n)).join(", ")})`);
    ok(t.includes("O score é a média dos quatro"), 'e "O score é a média dos quatro…"');
    const alvo = await caixa(resumo);
    ok(alvo44(alvo), `o "score" tem 44 px de alvo (${JSON.stringify(alvo)})`);
    // A Maria não registrou refeição hoje: o pilar da Nutrição é o padrão.
    ok(/sem registro hoje · conta \d+/.test(t), 'o pilar sem registro diz "sem registro hoje · conta N"');
    await p.screenshot({ path: `${OUT}/score-aberto.png`, fullPage: true });
    await clicar(resumo);
  });
  await etapa("sugestão de proteína", async () => {
    await carregar();
    const link = p.locator('a[href="/app/dieta#plano"]', { hasText: /^Faltam \d+ g de proteína/ });
    const n = await link.count();
    ok(n === 1, `a sugestão de proteína aparece e leva a /app/dieta#plano (${n})`, n ? await link.innerText() : "");
    // A dica principal some quando a sugestão aparece e o pilar mais fraco é
    // a Nutrição (o da Maria hoje): as duas diriam a mesma coisa.
    const corpo = await p.locator("main").innerText();
    ok(n === 1 && !corpo.includes("Registre suas refeições de hoje."), "e a dica da Nutrição não aparece junto");
  });

  console.log('\nÁgua: "+250 ml"');
  // A água grava de verdade no mock: o `finally` volta o dia ao que era, para
  // a etapa seguinte (e o próximo roteiro) partir do mesmo número.
  await etapa("+250 ml", () => comEstado(async () => {
    await carregar();
    const botao = p.getByRole("button", { name: "+250 ml", exact: true });
    await hidratado(botao);
    const antes = await numeroDoAnel("Água");
    const regiao = p.locator('[aria-live="polite"]', { has: p.getByText("+250 ml registrado") });
    // Desabilitado enquanto grava: dois toques leriam o mesmo total.
    // Três microtarefas bastam para o React aplicar o `disabled` (o clique é
    // evento discreto) e são pouco para a gravação, que faz dois pedidos.
    const desabilitou = await botao.evaluate(async (el) => {
      el.click();
      for (let i = 0; i < 3; i++) await Promise.resolve();
      return el.disabled;
    });
    ok(desabilitou, "o botão fica desabilitado durante a gravação");
    await p.getByText("+250 ml registrado", { exact: false }).waitFor({ timeout: 15000 });
    await p.waitForFunction((a) => {
      const f = [...document.querySelectorAll("figure")].find((x) => x.querySelector("figcaption")?.textContent.trim() === "Água");
      const t = f?.querySelector(".tabular")?.textContent ?? "";
      return Math.abs(Number(t.replace(",", ".")) - (a + 0.25)) < 0.001;
    }, antes, { timeout: 15000 }).catch(() => {});
    const depois = await numeroDoAnel("Água");
    ok(Math.abs(depois - antes - 0.25) < 0.001, `o anel de água sobe 0,25 L (${antes} → ${depois})`);
    ok((await regiao.count()) === 1, 'a mensagem "+250 ml registrado · Desfazer" está numa região aria-live="polite"');
    const alvoDesfazer = await caixa(p.getByRole("button", { name: "Desfazer", exact: true }));
    ok(alvo44(alvoDesfazer), `"Desfazer" tem 44 px de alvo (${JSON.stringify(alvoDesfazer)})`);
    await anel("Água").locator("xpath=..").screenshot({ path: `${OUT}/agua-registrada.png` });
    await clicar(p.getByRole("button", { name: "Desfazer", exact: true }));
    await p.waitForFunction((a) => {
      const f = [...document.querySelectorAll("figure")].find((x) => x.querySelector("figcaption")?.textContent.trim() === "Água");
      const t = f?.querySelector(".tabular")?.textContent ?? "";
      return Math.abs(Number(t.replace(",", ".")) - a) < 0.001;
    }, antes, { timeout: 15000 }).catch(() => {});
    const desfeito = await numeroDoAnel("Água");
    ok(Math.abs(desfeito - antes) < 0.001, `"Desfazer" devolve o anel (${depois} → ${desfeito})`);
    // O "Desfazer" some com a mensagem: o foco volta ao "+250 ml" (e não cai
    // no <body>), e a região anuncia "Desfeito.".
    await p.waitForFunction(() => document.activeElement?.textContent?.trim() === "+250 ml", null, { timeout: 10000 }).catch(() => {});
    const focado = await p.evaluate(() => {
      const e = document.activeElement;
      return e ? `${e.tagName.toLowerCase()} "${(e.textContent || "").trim().slice(0, 30)}"` : "nada";
    });
    ok(focado === 'button "+250 ml"', `depois do "Desfazer", o foco está no "+250 ml" (${focado})`);
    const avisoDesfeito = p.locator('[aria-live="polite"]', { has: p.getByText("Desfeito.", { exact: true }) });
    ok((await avisoDesfeito.count()) === 1, 'e a região aria-live diz "Desfeito."');

    // Dois toques no mesmo instante: o segundo não pode ler o mesmo total e
    // apagar o primeiro. O que a tela mostra tem de ser o que ficou gravado.
    // Os dois leriam o mesmo 1,2 e gravariam o mesmo 1,45, então o número
    // sozinho não distingue: conta-se também quantas gravações saíram.
    let gravacoes = 0;
    const contar = (r) => {
      if (r.method() === "POST" && /\/rest\/v1\/daily_logs/.test(r.url())) gravacoes++;
    };
    p.on("request", contar);
    await botao.evaluate((el) => { el.click(); el.click(); });
    await p.getByText("+250 ml registrado", { exact: false }).waitFor({ timeout: 15000 });
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(1500);
    p.off("request", contar);
    ok(gravacoes === 1, `dois toques no mesmo instante: uma gravação só (${gravacoes})`);
    const naTela = await numeroDoAnel("Água");
    await carregar();
    const recarregado = await numeroDoAnel("Água");
    ok(Math.abs(naTela - recarregado) < 0.001, `dois toques rápidos e recarregar: a tela mostrava ${naTela} L e o banco tem ${recarregado} L`);
  }));
  // Só a ESCRITA de daily_logs falha: com a leitura falhando, o "Seu dia" nem
  // desenharia o anel (ele diz que não carregou, abaixo).
  await etapa("+250 ml com a gravação falhando", async () => {
    await carregar();
    const botao = p.getByRole("button", { name: "+250 ml", exact: true });
    await hidratado(botao);
    const antes = await numeroDoAnel("Água");
    await comFalha("daily_logs", async () => {
      await botao.click();
      const aviso = p.getByText("Não deu para registrar a água.", { exact: true });
      ok(await aviso.waitFor({ timeout: 15000 }).then(() => true, () => false), 'gravação falhando: aparece "Não deu para registrar a água."');
      await p.waitForTimeout(800);
      const depois = await numeroDoAnel("Água");
      ok(depois === antes, `e o anel não muda (${antes} → ${depois})`);
      await anel("Água").locator("xpath=..").screenshot({ path: `${OUT}/agua-falhou.png` });
    }, { escrita: true });
  });
  // A leitura do total, dentro de adicionarAgua, falhando depois de a página
  // carregar: também não grava, e a tela diz o mesmo.
  await etapa("+250 ml com a leitura do total falhando", async () => {
    await carregar();
    const botao = p.getByRole("button", { name: "+250 ml", exact: true });
    await hidratado(botao);
    const antes = await numeroDoAnel("Água");
    await comFalha("daily_logs", async () => {
      await botao.click();
      const aviso = p.getByText("Não deu para registrar a água.", { exact: true });
      ok(await aviso.waitFor({ timeout: 15000 }).then(() => true, () => false), 'leitura do total falhando: aparece "Não deu para registrar a água."');
      await p.waitForTimeout(800);
      ok((await numeroDoAnel("Água")) === antes, "e o anel não muda");
    });
  });

  console.log("\nSeu dia com leitura falhando");
  // Cada leitura que alimenta o "Seu dia" falhando: o bloco diz que não
  // carregou, em app-atencao, e nenhum anel aparece (nem "0", nem a meta padrão
  // de 2,5 L), nem o Score, nem a sugestão, nem o "Definir metas".
  for (const tabela of ["meals", "daily_logs", "profiles"]) {
    await etapa(`Seu dia com ${tabela} falhando`, async () => {
      await comFalha(tabela, async () => {
        await carregar();
        const s = secao("Seu dia");
        const t = await s.innerText().catch(() => "");
        const aviso = s.getByText("Não deu para carregar os números de hoje.", { exact: true });
        ok((await aviso.count()) === 1, `${tabela} falhando: "Não deu para carregar os números de hoje."`, t.slice(0, 160));
        if (await aviso.count()) {
          const [cor, atencao] = await aviso.evaluate((e) => {
            const ref = document.createElement("span");
            ref.style.color = "var(--app-atencao)";
            document.body.appendChild(ref);
            const c = getComputedStyle(ref).color;
            ref.remove();
            return [getComputedStyle(e).color, c];
          });
          ok(cor === atencao, `e em app-atencao (${cor})`);
        }
        const aneis = await s.locator("figure").count();
        const zeros = await s.locator(".tabular", { hasText: /^0$/ }).count();
        ok(t !== "" && aneis === 0 && zeros === 0, `e nenhum anel (${aneis}) nem "0" (${zeros}) no Seu dia`);
        ok(!/score \d+/.test(t) && !t.includes("Faltam") && !(await p.getByText("Definir metas").count()),
          "nem o Score, nem a sugestão, nem o \"Definir metas\"");
        if (tabela === "profiles") {
          ok(!(await p.locator("main").innerText()).includes("2,5 L"), "e sem a meta padrão de 2,5 L em lugar nenhum");
        }
        await p.screenshot({ path: `${OUT}/seu-dia-${tabela}-falhou.png`, fullPage: true });
      });
    });
  }

  console.log("\nProgresso e links");
  await etapa("Progresso", async () => {
    await carregar();
    const t = await secao("Progresso").innerText();
    ok(/kg em 30 dias/.test(t), '"… kg em 30 dias"', t.slice(0, 120));
    const linha = secao("Progresso").locator('svg[role="img"]');
    const rotulo = (await linha.count()) ? await linha.getAttribute("aria-label") : null;
    ok(!!rotulo && /^Peso dos últimos 30 dias, de \d+,\d para \d+,\d kg\.$/.test(rotulo),
      `a linha do peso tem role="img" e o aria-label com vírgula ("${rotulo}")`);
    const alvo = await caixa(p.locator('a[href="/app/medidas"]', { hasText: "Ver medidas" }));
    ok(alvo44(alvo), `"Ver medidas" tem 44 px de alvo (${JSON.stringify(alvo)})`);
  });
  // A Maria tem as metas: o "Definir metas" só aparece sem a de calorias. O
  // perfil é gravado no mock (o upsert da página Perfil tem estado) e volta no
  // `finally`.
  await etapa("Definir metas", () => comEstado(async () => {
    const sessao = await entrarComoMaria();
    const r = await fetch(`${MOCK}/rest/v1/profiles`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({ id: sessao.user.id, daily_calorie_goal: null }),
    });
    ok(r.status === 201, `preparo: a Maria sem meta de calorias no mock (${r.status})`);
    await carregar();
    const link = p.locator('a[href="/app/perfil"]', { hasText: "Definir metas" });
    ok((await link.count()) === 1, 'sem meta de calorias, o "Definir metas" aparece');
    const alvo = await caixa(link);
    ok(alvo44(alvo), `e tem 44 px de alvo (${JSON.stringify(alvo)})`);
  }));
  await etapa("Progresso com a leitura falhando", async () => {
    await comFalha("body_measurements", async () => {
      await carregar();
      const t = await secao("Progresso").innerText().catch(() => "");
      ok(t.includes("Não deu para carregar o peso."), 'peso falhando: "Não deu para carregar o peso."', t.slice(0, 160));
      ok(!t.includes("Registre seu peso algumas vezes"), "e não o estado vazio");
    });
  });
  await etapa("links", async () => {
    await carregar();
    ok((await p.locator('a[href="/app/treinos"]', { hasText: "Treinos recentes" }).count()) === 1, 'link "Treinos recentes"');
    ok((await p.locator('a[href="/app/relatorios"]', { hasText: "Relatório para levar à consulta" }).count()) === 1,
      'link "Relatório para levar à consulta"');
  });

  console.log("\nLinguagem");
  await etapa("linguagem", async () => {
    await carregar();
    const r = await p.evaluate(() => {
      const main = document.querySelector("main");
      const caixaAlta = [...main.querySelectorAll("*")].filter((e) => getComputedStyle(e).textTransform === "uppercase");
      const comImagem = [...document.querySelectorAll(".card, .btn-primary")].filter((e) => getComputedStyle(e).backgroundImage !== "none");
      return {
        caixaAlta: caixaAlta.slice(0, 4).map((e) => `${e.tagName.toLowerCase()} "${e.textContent.trim().slice(0, 30)}"`),
        nCaixaAlta: caixaAlta.length,
        comImagem: comImagem.slice(0, 4).map((e) => e.className.split(" ").slice(0, 3).join(".")),
        nComImagem: comImagem.length,
        doc: document.documentElement.scrollWidth,
        janela: innerWidth,
        fontes: [document.body, document.querySelector("h1"), document.querySelector("h2")].map((e) => (e ? getComputedStyle(e).fontFamily : "")),
      };
    });
    ok(r.nCaixaAlta === 0, `nenhum text-transform: uppercase no main (${r.nCaixaAlta})`, r.caixaAlta.join(" | "));
    ok(r.nComImagem === 0, `nenhum background-image em .card nem .btn-primary (${r.nComImagem})`, r.comImagem.join(" | "));
    ok(r.doc <= r.janela, `sem rolagem horizontal (${r.doc}px ≤ ${r.janela}px)`);
    ok(r.fontes.every((f) => /Instrument[ _]Sans/i.test(f)), "Instrument Sans no corpo, no h1 e no h2", r.fontes.join(" | "));
  });

  await p.screenshot({ path: `${OUT}/inicio-390.png`, fullPage: true });
  await p.screenshot({ path: `${OUT}/v-topo.png` });

  console.log("\nGaia na barra de baixo");
  // O balão da Gaia (44 px) fica na borda de cima da barra de baixo, à direita,
  // e não flutua mais sobre o conteúdo: em 390 px ele cortava o "Registrar" da
  // aplicação ("Regis") e cobria o "ver em Meu plano" da Dieta. A barra tem
  // altura fixa (`--barra-h`), e o balão entra só na folga de cima dela, para
  // não cobrir o ícone nem o rótulo do "Mais", que fica logo abaixo. Tudo
  // medido com o dedo: `elementFromPoint`, não só com caixas.
  await etapa("Gaia na barra de baixo", async () => {
    await carregar();
    // O `goto` para a mesma rota recarrega com a rolagem de volta, e rolada a
    // página esconde o balão (o dedo não o acharia): volta ao topo (`instant`:
    // o html tem scroll-behavior: smooth) e espera o balão voltar.
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await p.waitForTimeout(500);
    const g = await p.evaluate(() => {
      const caixa = (e) => {
        const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
      };
      const cruza = (a, c) => a.x < c.r && a.r > c.x && a.y < c.b && a.b > c.y;
      const fab = document.querySelector('button[aria-label="Abrir a Gaia"]');
      const nav = document.querySelector("nav.fixed.inset-x-0.bottom-0");
      const mais = [...nav.querySelectorAll("button")].find((b) => b.textContent.trim() === "Mais");
      const habitos = [...nav.querySelectorAll("a")].find((a) => a.textContent.trim() === "Hábitos");
      const registrar = [...document.querySelectorAll("li")]
        .filter((li) => /Aplicação (de hoje|atrasada)/.test(li.textContent))
        .map((li) => [...li.querySelectorAll("a")].find((a) => a.textContent.trim() === "Registrar"))
        .find(Boolean);
      const rotulo = [...mais.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim() === "Mais");
      const faixa = document.createRange();
      faixa.selectNodeContents(rotulo);
      const icone = mais.querySelector("svg");
      const ponto = mais.querySelector("span > span");
      const centro = (c) => [c.x + c.w / 2, c.y + c.h / 2];
      const acerta = (el, [x, y]) => {
        const h = document.elementFromPoint(x, y);
        return !!h && el.contains(h);
      };
      // Grade (de 4 em 4 px) sobre os 44 px de baixo da célula inteira.
      const livre = (el) => {
        const c = caixa(el);
        const erros = [];
        let n = 0;
        for (let x = c.x + 2; x < c.r; x += 4) {
          for (let y = c.b - 44 + 2; y < c.b; y += 4) {
            n++;
            if (!acerta(el, [x, y])) erros.push(`${Math.round(x)},${Math.round(y)}`);
          }
        }
        return { larg: c.w, n, erros: erros.slice(0, 5), nErros: erros.length };
      };
      const cf = caixa(fab);
      // O balão é redondo e o ponto de novidade fica no canto do ícone: o que
      // vale é o círculo, não a caixa do balão (cujo canto vazio o dedo não toca).
      const cruzaCirculo = (c) => {
        const cx = cf.x + cf.w / 2, cy = cf.y + cf.h / 2;
        const px = Math.min(Math.max(cx, c.x), c.r), py = Math.min(Math.max(cy, c.y), c.b);
        return Math.hypot(cx - px, cy - py) < cf.w / 2;
      };
      const cm = caixa(mais);
      const cI = caixa(icone);
      const cR = (() => { const b = faixa.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })();
      const cP = ponto ? caixa(ponto) : null;
      const cN = caixa(nav);
      const cReg = registrar ? caixa(registrar) : null;
      const regErros = [];
      if (cReg) {
        // De 3 em 3 px e SEMPRE com a última linha e a última coluna: o topo
        // do balão chegou a entrar 1,5 px no pé do botão, e uma grade que
        // para antes da borda não via. "Tapado" é o dedo achar o balão ou a
        // barra ali; o canto arredondado do botão, que devolve a linha da
        // lista, não é tapado por ninguém.
        const pontos = (de, ate) => {
          const v = [];
          for (let t = de + 0.5; t < ate - 0.5; t += 3) v.push(t);
          v.push(ate - 0.5);
          return v;
        };
        for (const x of pontos(cReg.x, cReg.r)) {
          for (const y of pontos(cReg.y, cReg.b)) {
            const h = document.elementFromPoint(x, y);
            if (h && (fab.contains(h) || nav.contains(h))) regErros.push(`${Math.round(x)},${Math.round(y)}`);
          }
        }
      }
      return {
        fab: cf, nav: cN, mais: cm, icone: cI, rotulo: cR, ponto: cP,
        raio: getComputedStyle(fab).borderTopLeftRadius,
        z: [Number(getComputedStyle(fab).zIndex), Number(getComputedStyle(nav).zIndex)],
        cruzaIcone: cruza(cf, cI), cruzaRotulo: cruza(cf, cR), cruzaPonto: cP ? cruzaCirculo(cP) : false, temPonto: !!cP,
        noIcone: acerta(mais, centro(cI)), noRotulo: acerta(mais, centro(cR)),
        noFab: (() => { const h = document.elementFromPoint(...centro(cf)); return !!h && fab.contains(h); })(),
        livreMais: livre(mais), livreHabitos: livre(habitos),
        janela: innerWidth, registrar: cReg, regErros: regErros.slice(0, 5), nRegErros: regErros.length, altJanela: innerHeight,
      };
    });
    const f = g.fab;
    ok(Math.abs(f.w - 44) < 0.5 && Math.abs(f.h - 44) < 0.5, `o balão da Gaia tem 44×44 px (${f.w}×${f.h})`);
    ok(parseFloat(g.raio) >= 22, `e é redondo (raio ${g.raio})`);
    // "Na borda de cima": a linha de cima da barra atravessa o balão, e só os
    // últimos 10 px dele entram na barra (a folga acima do ícone do Mais é de
    // 11 px: 1 de borda e 10 de respiro; 10 deixa o topo do balão abaixo do
    // pé do "Registrar", que acaba em 748 px, e 1 px antes do ícone).
    const entra = f.b - g.nav.y;
    ok(entra >= 1 && entra <= 10.5 && f.y < g.nav.y,
      `o balão está na borda de cima da barra (entra ${Math.round(entra * 10) / 10} px; esperado de 1 a 10)`,
      `balão y=${Math.round(f.y)}..${Math.round(f.b)} · barra y=${Math.round(g.nav.y)}`);
    ok(Math.abs(g.janela - 16 - f.r) < 0.5, `à direita, na margem de 16 px da página (${Math.round((g.janela - f.r) * 10) / 10} px)`);
    ok(g.z[0] > g.z[1] && g.noFab, `acima da barra no empilhamento (z ${g.z[0]} > ${g.z[1]}) e é o que o dedo acha no centro dele`);
    ok(!g.cruzaIcone && !g.cruzaRotulo && !g.cruzaPonto,
      `a caixa do balão não cruza o ícone nem o rótulo do Mais${g.temPonto ? ", e o círculo não toca o ponto de novidade" : ""}`,
      `balão ${Math.round(f.y)}..${Math.round(f.b)} · ícone ${Math.round(g.icone.y)}..${Math.round(g.icone.b)} · rótulo ${Math.round(g.rotulo.y)}..${Math.round(g.rotulo.b)}`);
    ok(g.noIcone, 'elementFromPoint no centro do ícone devolve o "Mais"');
    ok(g.noRotulo, 'elementFromPoint no centro do rótulo devolve o "Mais"');
    ok(g.livreMais.larg >= 44 && g.livreMais.nErros === 0,
      `o "Mais" mantém 44×44 livres (${Math.round(g.livreMais.larg)} px de largura; ${g.livreMais.n - g.livreMais.nErros}/${g.livreMais.n} pontos da faixa de baixo)`,
      g.livreMais.erros.join(" "));
    ok(g.livreHabitos.larg >= 44 && g.livreHabitos.nErros === 0,
      `o "Hábitos", vizinho dele, também (${Math.round(g.livreHabitos.larg)} px; ${g.livreHabitos.n - g.livreHabitos.nErros}/${g.livreHabitos.n} pontos)`,
      g.livreHabitos.erros.join(" "));
    ok(Math.abs(g.nav.h - 61.5) < 0.1, `a barra tem altura fixa de 61,5 px (${g.nav.h}), o que o balão usa para achar a borda dela`);
    ok(!!g.registrar && g.registrar.b <= g.nav.y && g.nRegErros === 0,
      `o "Registrar" da aplicação está inteiro na primeira tela e o dedo o acha em toda a caixa (${g.registrar ? Math.round(g.registrar.w) + "×" + Math.round(g.registrar.h) : "ausente"}, ${g.nRegErros} pontos tapados)`,
      g.regErros.join(" "));
    await p.screenshot({ path: `${OUT}/gaia-na-barra.png` });

    // Aberto, o painel segue 80 px acima do fundo (61,5 da barra e 18,5 de
    // vão, como era com o `bottom-20`), acima da barra, e o balão sai de cena:
    // um não fica por cima do outro.
    await clicar(p.locator('button[aria-label="Abrir a Gaia"]'));
    await p.locator('button[aria-label="Fechar"]').waitFor({ timeout: 10000 });
    const painel = await medirPainel();
    ok(painel && Math.abs(painel.doFundo - 80) < 0.1 && painel.top === 64 && painel.b <= painel.barra - 18 && !painel.balao,
      `aberto, o painel acaba 80 px acima do fundo e 18,5 acima da barra, sem o balão por cima (${painel ? painel.doFundo : "?"} px do fundo, topo ${painel ? painel.top : "?"}, balão ${painel && painel.balao ? "ainda na tela" : "fora"})`);
    await p.locator('button[aria-label="Fechar"]').click();
    await p.locator('button[aria-label="Abrir a Gaia"]').waitFor({ timeout: 10000 });
  });

  // Com recorte do aparelho (a barra de início do iPhone), a barra engorda por
  // baixo e o balão acompanha a borda dela: a posição vem da mesma conta
  // (`--barra-h` + `env(safe-area-inset-bottom)`), não de um número que só vale
  // sem o recorte. O Chromium emula o recorte pelo CDP.
  await etapa("Gaia na barra de baixo com safe area", async () => {
    const cdp = await ctx.newCDPSession(p);
    try {
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
      await p.waitForTimeout(400);
      const m = await p.evaluate(() => {
        const sonda = document.createElement("div");
        sonda.style.cssText = "position:fixed;left:0;top:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
        document.body.appendChild(sonda);
        const env = parseFloat(getComputedStyle(sonda).paddingBottom);
        sonda.remove();
        const nav = document.querySelector("nav.fixed.inset-x-0.bottom-0").getBoundingClientRect();
        const fab = document.querySelector('button[aria-label="Abrir a Gaia"]').getBoundingClientRect();
        const mais = [...document.querySelectorAll("nav.fixed button")].find((b) => b.textContent.trim() === "Mais");
        const icone = mais.querySelector("svg").getBoundingClientRect();
        const h = document.elementFromPoint(icone.left + icone.width / 2, icone.top + icone.height / 2);
        return { env, navH: nav.height, entra: fab.bottom - nav.top, folga: icone.top - fab.bottom, noIcone: !!h && mais.contains(h), fabH: fab.height };
      });
      ok(m.env === 34, `preparo: o Chromium emulou 34 px de safe area (${m.env})`);
      ok(Math.abs(m.navH - 95.5) < 0.1, `a barra engordou por baixo: 61,5 + 34 = 95,5 px (${m.navH})`);
      ok(Math.abs(m.entra - 10) < 0.1 && m.fabH === 44, `o balão acompanhou a borda: segue 10 px dentro da barra (${m.entra}) e com 44 px`);
      ok(m.folga >= 0.5 && m.noIcone, `e não encosta no ícone do Mais (${m.folga} px livres; o dedo no centro do ícone acha o Mais: ${m.noIcone})`);
      await clicar(p.locator('button[aria-label="Abrir a Gaia"]'));
      await p.locator('button[aria-label="Fechar"]').waitFor({ timeout: 10000 });
      const painel = await medirPainel();
      ok(painel && Math.abs(painel.doFundo - 114) < 0.1 && painel.b <= painel.barra - 18,
        `o painel aberto sobe com a barra: 80 + 34 = 114 px do fundo (${painel ? painel.doFundo : "?"}) e 18,5 acima dela`);
      await p.locator('button[aria-label="Fechar"]').click();
    } finally {
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 0, left: 0, right: 0 } }).catch(() => {});
      await cdp.detach().catch(() => {});
      await carregar();
    }
  });

  console.log("\nGaia");
  // (3) o balão da Gaia some ao descer
  await etapa("(3) Gaia", async () => {
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
  });
  console.log("altura da Início:", await p.evaluate(() => document.documentElement.scrollHeight), "px");
  await ctx.close();

  // A Início do nutricionista (NutriHome) também na letra única.
  console.log("\nNutriHome");
  await etapa("NutriHome", async () => {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
    const q = await c2.newPage();
    for (let t = 1; ; t++) {
      await q.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
      await q.waitForTimeout(1200);
      await q.fill('input[type="email"]', "nutri.teste@exemplo.com");
      await q.fill('input[type="password"]', "senha-de-mentira");
      await q.click('button[type="submit"]');
      try {
        await q.waitForURL("**/app", { timeout: 60000 });
        break;
      } catch (e) {
        if (t >= 3) throw e;
      }
    }
    await q.locator("h1").first().waitFor({ timeout: 60000 });
    const fontes = await q.evaluate(() =>
      [document.body, document.querySelector("h1")].map((e) => (e ? getComputedStyle(e).fontFamily : "")));
    ok(fontes.every((f) => /Instrument[ _]Sans/i.test(f)), "NutriHome: Instrument Sans no corpo e no h1", fontes.join(" | "));
    await c2.close();
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
