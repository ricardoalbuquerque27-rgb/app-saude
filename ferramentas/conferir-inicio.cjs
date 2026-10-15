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
/** Roda `fn` com os GET de `tabela` dando 500, e SEMPRE volta o mock depois. */
async function comFalha(tabela, fn) {
  await fetch(MOCK + "/__falhar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabela }),
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
  });
  await etapa("Para hoje com leitura falhando", async () => {
    await comFalha("patient_notes", async () => {
      await carregar();
      const t = await secao("Para hoje").innerText().catch(() => "");
      ok(t.includes("Não deu para carregar tudo"), 'recados falhando: "Não deu para carregar tudo" aparece', t.slice(0, 160));
      ok(t !== "" && !/em dia/.test(t), 'e o cartão (que está na tela) não diz "em dia"');
      await p.screenshot({ path: `${OUT}/para-hoje-falhou.png`, fullPage: true });
    });
  });

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
    const sessao = await (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "maria.teste@exemplo.com", password: "senha-de-mentira" }),
    })).json();
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
    await anel("Água").locator("xpath=..").screenshot({ path: `${OUT}/agua-registrada.png` });
    await clicar(p.getByRole("button", { name: "Desfazer", exact: true }));
    await p.waitForFunction((a) => {
      const f = [...document.querySelectorAll("figure")].find((x) => x.querySelector("figcaption")?.textContent.trim() === "Água");
      const t = f?.querySelector(".tabular")?.textContent ?? "";
      return Math.abs(Number(t.replace(",", ".")) - a) < 0.001;
    }, antes, { timeout: 15000 }).catch(() => {});
    const desfeito = await numeroDoAnel("Água");
    ok(Math.abs(desfeito - antes) < 0.001, `"Desfazer" devolve o anel (${depois} → ${desfeito})`);

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
  await etapa("+250 ml com a gravação falhando", async () => {
    await carregar();
    const botao = p.getByRole("button", { name: "+250 ml", exact: true });
    await hidratado(botao);
    const antes = await numeroDoAnel("Água");
    await comFalha("daily_logs", async () => {
      await botao.click();
      const aviso = p.getByText("Não deu para registrar a água", { exact: true });
      ok(await aviso.waitFor({ timeout: 15000 }).then(() => true, () => false), 'falhando: aparece "Não deu para registrar a água"');
      await p.waitForTimeout(800);
      const depois = await numeroDoAnel("Água");
      ok(depois === antes, `e o anel não muda (${antes} → ${depois})`);
      await anel("Água").locator("xpath=..").screenshot({ path: `${OUT}/agua-falhou.png` });
    });
  });

  console.log("\nProgresso e links");
  await etapa("Progresso", async () => {
    await carregar();
    const t = await secao("Progresso").innerText();
    ok(/kg em 30 dias/.test(t), '"… kg em 30 dias"', t.slice(0, 120));
    const linha = secao("Progresso").locator('svg[role="img"]');
    const rotulo = (await linha.count()) ? await linha.getAttribute("aria-label") : null;
    ok(!!rotulo && /^Peso dos últimos 30 dias, de \d+,\d para \d+,\d kg\.$/.test(rotulo),
      `a linha do peso tem role="img" e o aria-label com vírgula ("${rotulo}")`);
  });
  await etapa("Progresso com a leitura falhando", async () => {
    await comFalha("body_measurements", async () => {
      await carregar();
      const t = await secao("Progresso").innerText().catch(() => "");
      ok(t.includes("Não deu para carregar o peso"), 'peso falhando: "Não deu para carregar o peso"', t.slice(0, 160));
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
