// Verificações de tela da Dieta do paciente, como a Maria do cenário padrão, em
// 390 px (e um trecho em 1280 px). Cobre a Dieta na linguagem nova (spec do
// visual do app do paciente, "Dieta (paciente)"): o rótulo do dia que abre o
// seletor de data, o cabeçalho sem subtítulo, os anéis com o papel das
// calorias, a barra de macros, a sugestão de proteína (só em hoje), o plano
// alimentar num cartão só, as refeições registradas e o "Nenhuma refeição neste
// dia.". Confere também o que NÃO pode acontecer: leitura que falha virando
// "não tem" (zeros, papel ou sugestão inventados), caixa alta, cor decorativa e
// rolagem lateral. Acusa com código de saída 1.
//
// Precisa do mock SEM cenário (`node ferramentas/mock-supabase.cjs`) e do dev
// no ar (ver LEIAME.md). O mock volta ao início antes e depois (POST
// /__reset), e cada `/__falhar` passa por `comFalha`, que o desfaz num
// `finally`: um timeout no meio não deixa o mock falhando para a etapa seguinte.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT = process.env.OUT || path.join(os.tmpdir(), "conferir-dieta");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TZ = "America/Sao_Paulo";
const hojeSP = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// A aritmética de data e o rótulo esperado, escritos aqui de novo e à mão de
// propósito (ao meio-dia UTC, sem fuso): se o app e o roteiro errassem juntos,
// seria a mesma conta.
const somaDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const DIAS_CURTOS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const rotuloEsperado = (iso, hoje) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${iso === hoje ? "Hoje, " : ""}${DIAS_CURTOS[new Date(iso + "T12:00:00Z").getUTCDay()]} ${d}/${m}`;
};

const resultados = [];
function ok(passou, msg, detalhe = "") {
  resultados.push(!!passou);
  console.log(`  ${passou ? "OK   " : "FALHA"}  ${msg}`);
  if (!passou && detalhe) console.log(`         ${detalhe}`);
}
// SO=regex roda só as etapas cujo nome casa: para repetir uma parte sem esperar
// o roteiro inteiro. Sem SO, vale tudo (é como o roteiro se confere por inteiro).
const SO = process.env.SO ? new RegExp(process.env.SO, "i") : null;
/** Uma etapa que lança (elemento que não existe, timeout) vira FALHA, e o roteiro segue. */
async function etapa(nome, fn) {
  if (SO && !SO.test(nome)) return;
  try {
    await fn();
  } catch (e) {
    ok(false, `${nome}: a etapa não terminou`, String(e && e.message ? e.message : e).split("\n")[0]);
  }
}

const reset = () => fetch(MOCK + "/__reset", { method: "POST" });
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
/** O token da Maria, para o que o roteiro grava no mock sem passar pela tela. */
const entrarComoMaria = async () =>
  (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "maria.teste@exemplo.com", password: "senha-de-mentira" }),
  })).json();
/** Grava no mock, como a Maria, uma linha de `tabela` (POST do PostgREST). */
async function gravarComoMaria(tabela, linha) {
  const sessao = await entrarComoMaria();
  return fetch(`${MOCK}/rest/v1/${tabela}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
    body: JSON.stringify({ ...linha, user_id: linha.user_id ?? sessao.user.id }),
  });
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

/** Largura e altura da CAIXA de um elemento, em px. */
const caixa = async (loc) => {
  const r = await loc.boundingBox();
  return r ? { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } : null;
};
/**
 * O que de fato responde ao toque, em px: anda do centro para fora com
 * `elementFromPoint` até sair do elemento. A caixa não basta, porque a área de
 * toque pode passar dela (o "Comi isso" tem 40 px visíveis e 44 de toque, por
 * um pseudo-elemento que a caixa não conta).
 */
async function alvoReal(loc) {
  // `instant`: a página tem scroll suave, e medir com a rolagem no meio erra
  // a posição do elemento.
  await loc.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
  await loc.page().waitForTimeout(150);
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const bate = (x, y) => {
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h));
    };
    const alcance = (dx, dy, max) => {
      let n = 0;
      while (n < max && bate(cx + dx * (n + 1), cy + dy * (n + 1))) n++;
      return n;
    };
    return { w: alcance(-1, 0, 80) + alcance(1, 0, 80) + 1, h: alcance(0, -1, 40) + alcance(0, 1, 40) + 1 };
  });
}
const alvo44 = (a) => !!a && a.w >= 44 && a.h >= 44;

/** A cor de uma variável --app-* já resolvida pelo navegador (rgb). */
const corDaVariavel = (p, v, prop = "backgroundColor") =>
  p.evaluate(([nome, propriedade]) => {
    const ref = document.createElement("span");
    ref.style[propriedade] = `var(${nome})`;
    document.body.appendChild(ref);
    const c = getComputedStyle(ref)[propriedade];
    ref.remove();
    return c;
  }, [v, prop]);

async function entrar(ctx, email = "maria.teste@exemplo.com") {
  const p = await ctx.newPage();
  // O login espera a compilação da Início no dev (lenta na primeira vez); o
  // resto do roteiro usa um prazo curto, para o que não existe falhar logo.
  p.setDefaultTimeout(90000);
  for (let t = 1; ; t++) {
    await p.goto(APP + "/login", { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.fill('input[type="email"]', email);
    await p.fill('input[type="password"]', "senha-de-mentira");
    await p.click('button[type="submit"]');
    try {
      await p.waitForURL("**/app", { timeout: 60000 });
      break;
    } catch (e) {
      if (t >= 3) throw e;
    }
  }
  p.setDefaultTimeout(6000);
  return p;
}

(async () => {
  const cen = await (await fetch(MOCK + "/__cenario")).json().catch(() => null);
  if (!cen || cen.cenario !== "padrao") {
    console.error(`O mock precisa subir sem CENARIO (veio: ${cen && cen.cenario}).`);
    process.exit(2);
  }
  await reset();

  const hoje = hojeSP();
  const ontem = somaDias(hoje, -1);

  const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
  // Conta as chamadas de showPicker(): o rótulo do dia tem de abrir o seletor.
  await ctx.addInitScript(() => {
    window.__showPicker = 0;
    const original = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function () {
      window.__showPicker++;
      return original ? original.call(this) : undefined;
    };
    // Conta o click() programático em input de arquivo: o ?foto=1 da Início
    // manda abrir a câmera, mas o Chromium não abre o seletor sem gesto do
    // usuário (e a navegação zera o gesto), então o que dá para conferir é o
    // clique.
    window.__cliquesNoArquivo = 0;
    const clique = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type === "file") window.__cliquesNoArquivo++;
      return clique.call(this);
    };
  });
  const p = await entrar(ctx);

  // Erros do console, menos o "Failed to load resource" (os 500 que o
  // `/__falhar` provoca de propósito aparecem assim).
  const errosDoConsole = [];
  p.on("pageerror", (e) => errosDoConsole.push(String(e && e.message ? e.message : e)));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errosDoConsole.push(m.text());
  });

  const carregar = async (rota = "/app/dieta") => {
    await p.goto(APP + rota, { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(700);
  };

  const principal = p.locator("main");
  const topo = p.locator("main header");
  const resumo = p.locator("section", { has: p.getByRole("heading", { name: "Resumo do dia", exact: true }) });
  const registradas = p.locator("section", { has: p.getByRole("heading", { name: "Refeições registradas", exact: true }) });
  const plano = p.locator("#plano");
  const anel = (rotulo) => resumo.locator("figure", { has: p.locator("figcaption", { hasText: rotulo }) });
  const numeroDoAnel = async (rotulo) => {
    const t = await anel(rotulo).locator(".tabular").first().innerText({ timeout: 5000 });
    return Number(t.trim().replace(/\./g, "").replace(",", "."));
  };
  // O nome acessível é o texto visível mais ", escolher outra data" (a etapa
  // "datas: nome e foco" confere o sufixo).
  const rotuloDoDia = topo.getByRole("button", { name: /^(Hoje, )?\S+\. \d{1,2}\/\d{1,2}(, escolher outra data)?$/ });
  const botaoDeData = p.locator('main input[type="date"]');
  const diaAnterior = topo.getByRole("button", { name: "Dia anterior", exact: true });
  const proximoDia = topo.getByRole("button", { name: "Próximo dia", exact: true });
  const chipHoje = topo.getByRole("button", { name: "Hoje", exact: true });
  const comiIsso = plano.getByRole("button", { name: "Comi isso", exact: true });
  // O <p> inteiro: a frase e a descrição da opção são dois blocos dentro dele.
  const sugestao = resumo.locator("p", { hasText: /^Faltam \d+ g de proteína para a meta de hoje\./ });
  const textoDoRotulo = async () => (await rotuloDoDia.innerText({ timeout: 5000 })).trim();
  /** Vai a um dia pelo próprio input de data (o que o seletor nativo faz). */
  const irParaODia = async (iso) => {
    await botaoDeData.fill(iso);
    await p.waitForTimeout(900);
  };

  // =========================================================================
  console.log("\nCabeçalho e rótulo do dia");
  await etapa("cabeçalho", async () => {
    await carregar();
    const h1 = principal.locator("h1").first();
    ok((await h1.innerText()).trim() === "Dieta", 'o título é "Dieta"');
    ok((await h1.evaluate((e) => getComputedStyle(e).fontSize)) === "24px", "o h1 tem 24 px");
    const texto = await principal.innerText();
    ok(!texto.includes("Acompanhe suas refeições e macros."), 'sem o subtítulo "Acompanhe suas refeições e macros."');

    const botao = topo.getByRole("button", { name: "Registrar refeição", exact: true });
    ok((await botao.count()) === 1, 'o botão "Registrar refeição" está no cabeçalho');
    const cab = await botao.boundingBox();
    const largura = await p.evaluate(() => {
      const m = document.querySelector("main");
      const cs = getComputedStyle(m);
      return m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });
    ok(!!cab && Math.abs(cab.width - largura) <= 1, `"Registrar refeição" ocupa a largura do conteúdo (${cab && Math.round(cab.width)} de ${Math.round(largura)} px)`);
    ok(!!cab && cab.height >= 44, `e tem ao menos 44 px de altura (${cab && Math.round(cab.height)} px)`);
    const fundo = await botao.evaluate((e) => getComputedStyle(e).backgroundColor);
    ok(fundo === (await corDaVariavel(p, "--app-primaria")), "e é o botão primário (fundo app-primaria)");
  });

  await etapa("rótulo do dia", async () => {
    await carregar();
    const t = await textoDoRotulo();
    ok(/^Hoje, \S+\. \d{1,2}\/\d{1,2}$/.test(t), `o rótulo começa com "Hoje, " e o dia da semana curto ("${t}")`);
    ok(t === rotuloEsperado(hoje, hoje), `e é o de hoje em São Paulo: esperado "${rotuloEsperado(hoje, hoje)}", achado "${t}"`);
    ok((await botaoDeData.count()) === 1, 'o input type="date" continua no DOM');
    ok((await botaoDeData.getAttribute("max")) === hoje, `e tem max = hoje em São Paulo (${await botaoDeData.getAttribute("max")})`);
    ok((await botaoDeData.inputValue()) === hoje, "e mostra a data de hoje");
    // Escondido da vista, mas dá para focar (teclado e leitor de tela).
    const cx = await botaoDeData.evaluate((e) => {
      e.focus();
      const r = e.getBoundingClientRect();
      return { focado: document.activeElement === e, w: r.width, h: r.height, op: getComputedStyle(e).opacity };
    });
    ok(cx.focado, "o input de data aceita foco");
    ok(cx.w <= 2 && cx.h <= 2 || cx.op === "0", `e não aparece como campo (${Math.round(cx.w)}×${Math.round(cx.h)} px, opacidade ${cx.op})`);
    ok(!!(await botaoDeData.getAttribute("aria-label")), "e tem nome para o leitor de tela (aria-label)");
  });

  await etapa("o rótulo abre o seletor", async () => {
    await carregar();
    await hidratado(rotuloDoDia);
    const antes = await p.evaluate(() => window.__showPicker);
    await rotuloDoDia.click();
    await p.waitForTimeout(400);
    const depois = await p.evaluate(() => window.__showPicker);
    ok(depois === antes + 1, `tocar no rótulo chama showPicker() do input de data (${antes} → ${depois})`);
    // O foco fica no botão, e o contorno que segue o input escondido
    // (peer-focus-visible) não acende com o mouse: o seletor nativo não leva o
    // foco para o input, nem ao escolher nem ao descartar (conferido à mão no
    // Chromium com janela, pelo seletor de verdade).
    const apos = await p.evaluate(() => ({
      ativo: document.activeElement?.tagName.toLowerCase() === "button",
      input: document.querySelector('main input[type="date"]').matches(":focus"),
    }));
    const contorno = await rotuloDoDia.evaluate((e) => getComputedStyle(e).outlineStyle);
    ok(apos.ativo && !apos.input && contorno === "none", `e o foco segue no botão, sem contorno de teclado (botão ativo ${apos.ativo}, input focado ${apos.input}, contorno ${contorno})`);
    await p.keyboard.press("Escape");
  });

  await etapa("datas: nome e foco", async () => {
    await carregar();
    await hidratado(rotuloDoDia);
    const rotulo = await textoDoRotulo();
    const nome = await rotuloDoDia.getAttribute("aria-label");
    ok(nome === `${rotulo}, escolher outra data`, `o botão do dia diz que abre a escolha da data: aria-label "${nome}"`);
    ok(nome != null && nome.startsWith(rotulo), "e o nome acessível começa pelo texto visível (rótulo no nome)");
    // O input de data fica fora da ordem de tab: o botão do dia cobre o teclado
    // (Enter abre o seletor por showPicker). Um segundo ponto de parada, num
    // campo que ninguém vê, seria digitar às cegas.
    ok((await botaoDeData.getAttribute("tabindex")) === "-1", "o input de data escondido fica fora da ordem de tab (tabindex -1)");
    const primaria = await corDaVariavel(p, "--app-primaria", "outlineColor");
    await diaAnterior.evaluate((e) => e.focus());
    await p.keyboard.press("Tab");
    const noBotao = await rotuloDoDia.evaluate((e) => {
      const c = getComputedStyle(e);
      return { ativo: document.activeElement === e, estilo: c.outlineStyle, largura: c.outlineWidth, cor: c.outlineColor, folga: c.outlineOffset };
    });
    ok(noBotao.ativo, "de Tab em Tab, o foco do teclado para no botão do dia (e não no input escondido)");
    ok(noBotao.estilo !== "none" && noBotao.largura === "2px" && noBotao.folga === "2px" && noBotao.cor === primaria,
      `e o botão mostra o contorno de foco (2 px app-primaria, folga de 2): ${JSON.stringify(noBotao)}`);
    // O recurso quando showPicker não existe ou lança: o foco vai para o input
    // escondido, e o contorno tem de aparecer no botão (o input não se vê).
    await botaoDeData.evaluate((e) => e.focus());
    const viaInput = await rotuloDoDia.evaluate((e) => {
      const c = getComputedStyle(e);
      return { ativo: document.activeElement === e, estilo: c.outlineStyle, largura: c.outlineWidth };
    });
    ok(!viaInput.ativo && viaInput.estilo !== "none" && viaInput.largura === "2px",
      `com o foco no input escondido, o botão do dia mostra o contorno: ${JSON.stringify(viaInput)}`);
  });

  await etapa("trocar de dia pelo input de data", async () => {
    await carregar();
    await hidratado(rotuloDoDia);
    await irParaODia(ontem);
    const t = await textoDoRotulo();
    ok(t === rotuloEsperado(ontem, hoje), `preencher ontem troca o rótulo: esperado "${rotuloEsperado(ontem, hoje)}", achado "${t}"`);
    ok(!t.startsWith("Hoje"), 'e o rótulo de outro dia não diz "Hoje"');
    ok((await chipHoje.count()) === 1, 'e o chip "Hoje" aparece');
    ok((await proximoDia.isEnabled()), "e o próximo dia deixa de estar desligado");
    await clicar(chipHoje);
    await p.waitForTimeout(700);
    ok((await textoDoRotulo()) === rotuloEsperado(hoje, hoje), 'o chip "Hoje" volta para hoje');
    ok((await chipHoje.count()) === 0, 'e o chip some em hoje');
    ok(!(await proximoDia.isEnabled()), "e o próximo dia fica desligado em hoje");
    // Uma data futura digitada (o max do input não impede digitar) não pode
    // virar o dia da tela: refeição lançada para o futuro entra na conta de hoje.
    await irParaODia(somaDias(hoje, 3));
    ok((await textoDoRotulo()) === rotuloEsperado(hoje, hoje), "uma data futura digitada volta para hoje");
    // Limpar o campo (o botão Limpar do seletor) manda "" no onChange.
    await botaoDeData.evaluate((e) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(e, "");
      e.dispatchEvent(new Event("input", { bubbles: true }));
      e.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await p.waitForTimeout(500);
    ok((await textoDoRotulo()) === rotuloEsperado(hoje, hoje), "e o campo limpo não derruba a tela (continua em hoje)");
  });

  await etapa("setas", async () => {
    await carregar();
    await hidratado(diaAnterior);
    await clicar(diaAnterior);
    await p.waitForTimeout(800);
    ok((await textoDoRotulo()) === rotuloEsperado(ontem, hoje), `a seta anda um dia para trás: "${await textoDoRotulo()}"`);
    await clicar(proximoDia);
    await p.waitForTimeout(800);
    ok((await textoDoRotulo()) === rotuloEsperado(hoje, hoje), "e a outra anda de volta");
  });

  console.log("\nAlvos de toque (a área que responde, não só a caixa)");
  await etapa("alvos do cabeçalho", async () => {
    await carregar();
    await hidratado(diaAnterior);
    ok(alvo44(await alvoReal(diaAnterior)), `"Dia anterior": ${JSON.stringify(await alvoReal(diaAnterior))}`);
    ok(alvo44(await alvoReal(rotuloDoDia)), `o rótulo do dia: ${JSON.stringify(await alvoReal(rotuloDoDia))}`);
    ok(alvo44(await alvoReal(topo.getByRole("button", { name: "Registrar refeição", exact: true }))), '"Registrar refeição" do cabeçalho');
    await clicar(diaAnterior);
    await p.waitForTimeout(800);
    ok(alvo44(await alvoReal(proximoDia)), `"Próximo dia" (ligado): ${JSON.stringify(await alvoReal(proximoDia))}`);
    ok(alvo44(await alvoReal(chipHoje)), `o chip "Hoje": ${JSON.stringify(await alvoReal(chipHoje))}`);
  });

  // =========================================================================
  console.log("\nResumo do dia: anéis, macros e sugestão");
  await etapa("anéis", async () => {
    await carregar();
    const h2 = resumo.getByRole("heading", { name: "Resumo do dia", exact: true });
    const tam = await h2.evaluate((e) => { const c = getComputedStyle(e); return `${c.fontSize}/${c.fontWeight}`; });
    ok(tam === "17px/600", `"Resumo do dia" é o título de seção (17 px semibold): ${tam}`);
    const cal = (await anel("Calorias").locator("figcaption").innerText()).trim();
    ok(cal === "Calorias · limite", `"Calorias · limite" (meta de peso 62 kg, abaixo do peso atual) — achado "${cal}"`);
    const prot = (await anel("Proteína").locator("figcaption").innerText()).trim();
    ok(prot === "Proteína", `o anel de proteína não leva o papel ("${prot}")`);
    ok((await resumo.locator("figure").count()) === 2, "são dois anéis (calorias e proteína)");
    const fvn = await anel("Calorias").locator(".tabular").first().evaluate((e) => getComputedStyle(e).fontVariantNumeric);
    ok(/tabular-nums/.test(fvn), "o centro do anel usa tabular-nums");
    ok(!(await principal.innerText()).includes("Definir metas"), 'a Maria tem as metas: sem "Definir metas"');
  });

  await etapa("barra de macros", async () => {
    await carregar();
    const legenda = resumo.locator("li");
    ok((await legenda.count()) === 3, `a legenda tem três itens (${await legenda.count()})`);
    const textos = (await legenda.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    ok(/^Proteína 0 g$/.test(textos[0] || "") && /^Carbo 0 g$/.test(textos[1] || "") && /^Gordura 0 g$/.test(textos[2] || ""),
      "sem refeição, a legenda dá nome e gramas: Proteína 0 g, Carbo 0 g, Gordura 0 g", textos.join(" | "));
    const tabulares = await legenda.locator(".tabular").count();
    ok(tabulares === 3, `e os gramas levam .tabular (${tabulares})`);
    const barra = await resumo.evaluate((sec) => {
      const el = [...sec.querySelectorAll("div,span")].find(
        (e) => e.children.length === 3 && !e.textContent.trim() && e.getBoundingClientRect().height >= 6 && e.getBoundingClientRect().height <= 16
      );
      if (!el) return null;
      return {
        gap: getComputedStyle(el).columnGap,
        h: el.getBoundingClientRect().height,
        cores: [...el.children].map((k) => getComputedStyle(k).backgroundColor),
      };
    });
    ok(!!barra, "a barra de macros existe, com três segmentos");
    if (barra) {
      const esperadas = [await corDaVariavel(p, "--app-macro-proteina"), await corDaVariavel(p, "--app-macro-carbo"), await corDaVariavel(p, "--app-macro-gordura")];
      ok(JSON.stringify(barra.cores) === JSON.stringify(esperadas), "nas cores macro-proteina, macro-carbo e macro-gordura", `${barra.cores.join(" ")} ≠ ${esperadas.join(" ")}`);
      ok(barra.gap === "2px", `com 2 px entre os segmentos (${barra.gap})`);
    }
  });

  await etapa("sugestão de proteína", async () => {
    await carregar();
    const n = await sugestao.count();
    ok(n === 1, `com a data em hoje, a sugestão aparece (${n})`);
    if (n) {
      const t = (await sugestao.innerText()).replace(/\s+/g, " ");
      ok(/^Faltam 110 g de proteína para a meta de hoje\. Próxima refeição do seu plano: café da manhã, 20 g \(2 ovos mexidos/.test(t),
        "e é a frase do plano: falta a meta toda, a refeição é a primeira do plano e a opção a de mais proteína", t);
      ok(await sugestao.evaluate((e) => !e.closest("a")), "sem link (o plano está logo abaixo)");
      const ys = await Promise.all([
        resumo.evaluate((sec) => [...sec.querySelectorAll("li")][0].getBoundingClientRect().bottom),
        sugestao.evaluate((e) => e.getBoundingClientRect().top),
        plano.evaluate((e) => e.getBoundingClientRect().top),
      ]);
      ok(ys[1] > ys[0] && ys[1] < ys[2], `abaixo da barra e acima do plano (legenda ${Math.round(ys[0])} < sugestão ${Math.round(ys[1])} < plano ${Math.round(ys[2])})`);
    }
    await irParaODia(ontem);
    ok((await sugestao.count()) === 0, "em outro dia (ontem) a sugestão some");
    ok((await principal.innerText()).includes("Calorias · limite"), 'e o anel segue com o papel ("Calorias · limite")');
    await irParaODia(hoje);
    ok((await sugestao.count()) === 1, "de volta a hoje, ela volta");
  });

  // A spec diz que a descrição da opção corta em duas linhas. O texto inteiro
  // segue no DOM (o leitor de tela lê tudo): o corte é só de desenho.
  const LONGA = "Prato caprichado: " + "120 g de frango grelhado + 4 colheres de arroz integral + 3 colheres de feijão + salada de folhas à vontade + legumes refogados, ".repeat(3).trim();
  const blocoCortado = (el) =>
    el.evaluate((raiz) => {
      const e = [...raiz.querySelectorAll("*")].find((x) => getComputedStyle(x).webkitLineClamp === "2");
      if (!e) return null;
      const c = getComputedStyle(e);
      return { alturaLinha: parseFloat(c.lineHeight), altura: e.clientHeight, cortado: e.scrollHeight > e.clientHeight + 1, texto: e.textContent, oculto: !!e.closest("[aria-hidden='true']") };
    });
  await etapa("sugestão: a descrição corta em duas linhas (Dieta)", async () => {
    await p.route("**/rest/v1/meal_plan_items*", async (rota) => {
      const resposta = await rota.fetch();
      const itens = await resposta.json();
      for (const i of itens) if (i.meal_type === "Café da manhã" && i.position === 0) i.description = LONGA;
      await rota.fulfill({ response: resposta, json: itens });
    });
    try {
      await carregar();
      ok((await sugestao.count()) === 1, "preparo: a sugestão do café com a descrição longa aparece");
      const b = await blocoCortado(sugestao);
      ok(!!b, "a descrição é um bloco com -webkit-line-clamp: 2");
      if (b) {
        ok(b.altura <= b.alturaLinha * 2 + 1, `em 390 px a descrição ocupa até duas linhas (${b.altura} px, linha de ${b.alturaLinha} px)`);
        ok(b.cortado, "e uma descrição longa de verdade é cortada (scrollHeight > clientHeight)");
        ok(b.texto.includes(LONGA) && !b.oculto, "o texto inteiro segue no DOM, fora de aria-hidden (o leitor de tela lê tudo)");
      }
      const frase = (await sugestao.innerText()).replace(/\s+/g, " ");
      ok(/^Faltam 110 g de proteína para a meta de hoje\. Próxima refeição do seu plano: café da manhã, 20 g \(Prato caprichado/.test(frase), "a frase continua a mesma, com a descrição entre parênteses", frase.slice(0, 160));
      await sugestao.screenshot({ path: `${OUT}/sugestao-longa-dieta.png` });
    } finally {
      await p.unroute("**/rest/v1/meal_plan_items*");
    }
  });
  await etapa("sugestão: a descrição corta em duas linhas (Início)", async () => {
    await carregar("/app");
    const link = p.locator('a[href="/app/dieta#plano"]', { hasText: /^Faltam \d+ g de proteína/ });
    ok((await link.count()) === 1, "preparo: a sugestão da Início aparece");
    const b = await blocoCortado(link);
    ok(!!b, "a descrição é um bloco com -webkit-line-clamp: 2, como na Dieta");
    if (b) {
      // A leitura da Início é do servidor e o mock tem descrições curtas: o
      // texto longo entra pelo DOM, no mesmo bloco, só para medir o corte.
      const medida = await link.evaluate((raiz, longa) => {
        const e = [...raiz.querySelectorAll("*")].find((x) => getComputedStyle(x).webkitLineClamp === "2");
        e.textContent = longa;
        const c = getComputedStyle(e);
        return { alturaLinha: parseFloat(c.lineHeight), altura: e.clientHeight, cortado: e.scrollHeight > e.clientHeight + 1 };
      }, LONGA);
      ok(medida.altura <= medida.alturaLinha * 2 + 1 && medida.cortado, `com uma descrição longa, ocupa até duas linhas e corta (${medida.altura} px, linha de ${medida.alturaLinha} px)`);
    }
    await carregar("/app");
    ok(((await link.innerText()).replace(/\s+/g, " ")).match(/^Faltam \d+ g de proteína para a meta de hoje\. Próxima refeição do seu plano: .*, \d+ g \(.+\)\.$/) != null, "e a frase da Início segue completa e igual (sem a descrição de teste)");
  });

  await etapa("acima do limite", () => comEstado(async () => {
    const r = await gravarComoMaria("meals", { date: hoje, meal_type: "Ceia", description: "Verificação do anel", calories: 2400, protein_g: 150, carbs_g: 200, fat_g: 90 });
    ok(r.status === 201, `preparo: refeição de 2.400 kcal gravada no mock (${r.status})`);
    await carregar();
    const aviso = anel("Calorias").getByText("acima do limite", { exact: true });
    ok((await aviso.count()) === 1, 'calorias acima da meta, com papel "limite": o anel diz "acima do limite"');
    if (await aviso.count()) {
      const [cor, atencao] = await Promise.all([aviso.evaluate((e) => getComputedStyle(e).color), corDaVariavel(p, "--app-atencao", "color")]);
      ok(cor === atencao, "e em app-atencao");
    }
    ok((await anel("Proteína").getByText("acima do limite").count()) === 0, "a proteína passou da meta e não avisa");
    ok((await sugestao.count()) === 0, "e com a proteína batida não há sugestão");
    await resumo.screenshot({ path: `${OUT}/resumo-acima.png` });
  }));

  await etapa("papel das calorias", () => comEstado(async () => {
    // Meta de peso acima do peso atual: a meta de calorias vira piso ("meta"),
    // e passar dela não avisa. Sem meta de peso, não há papel.
    await gravarComoMaria("meals", { date: hoje, meal_type: "Ceia", description: "Verificação do papel", calories: 2400, protein_g: 150, carbs_g: 200, fat_g: 90 });
    const sessao = await entrarComoMaria();
    const perfil = (extra) => fetch(`${MOCK}/rest/v1/profiles`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({ id: sessao.user.id, ...extra }),
    });
    ok((await perfil({ weight_goal_kg: 80 })).status === 201, "preparo: meta de peso de 80 kg no mock");
    await carregar();
    const meta = (await anel("Calorias").locator("figcaption").innerText()).trim();
    ok(meta === "Calorias · meta", `peso abaixo da meta de peso: "Calorias · meta" (achado "${meta}")`);
    ok((await anel("Calorias").getByText("acima do limite").count()) === 0, 'e com o papel "meta" passar das calorias não avisa');
    ok((await perfil({ weight_goal_kg: null })).status === 201, "preparo: sem meta de peso no mock");
    await carregar();
    const sem = (await anel("Calorias").locator("figcaption").innerText()).trim();
    ok(sem === "Calorias", `sem meta de peso, só "Calorias" (achado "${sem}")`);
  }));

  await etapa("Definir metas", () => comEstado(async () => {
    const sessao = await entrarComoMaria();
    const r = await fetch(`${MOCK}/rest/v1/profiles`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({ id: sessao.user.id, daily_calorie_goal: null }),
    });
    ok(r.status === 201, `preparo: a Maria sem meta de calorias no mock (${r.status})`);
    await carregar();
    const link = resumo.locator('a[href="/app/perfil"]', { hasText: "Definir metas" });
    ok((await link.count()) === 1, 'sem meta de calorias, o "Definir metas" fica');
    ok(alvo44(await alvoReal(link)), `e tem 44 px de alvo (${JSON.stringify(await alvoReal(link))})`);
  }));

  // O assistente grava o peso e as metas por conta própria e avisa a tela por
  // "pf-data-changed" (lib/aiActions.ts): o peso sai com a área "medidas", e a
  // ferramenta de metas com ["dieta", "medidas", "habitos"]. O "perfil" só sai
  // de atualizar_perfil (sexo, altura, nascimento), que a Dieta não lê. Sem
  // ouvir "medidas", a Dieta mostrava o papel das calorias de antes da conversa
  // até alguém recarregar.
  await etapa("a Gaia muda a meta ou o peso, sem recarregar", () => comEstado(async () => {
    const avisar = (...areas) => p.evaluate((a) => window.dispatchEvent(new CustomEvent("pf-data-changed", { detail: { areas: a } })), areas);
    const rotuloDasCalorias = () => anel("Calorias").locator("figcaption").innerText().then((t) => t.trim());
    const esperar = (esperado) =>
      p.waitForFunction((e) => {
        const f = [...document.querySelectorAll("figure")].find((x) => x.querySelector("figcaption")?.textContent.trim().startsWith("Calorias"));
        return f?.querySelector("figcaption")?.textContent.trim() === e;
      }, esperado, { timeout: 5000 }).then(() => true, () => false);
    await carregar();
    ok((await rotuloDasCalorias()) === "Calorias · limite", "antes: Calorias · limite (meta de peso 62 kg)");
    const sessao = await entrarComoMaria();
    const autorizacao = { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` };
    await fetch(`${MOCK}/rest/v1/profiles`, { method: "POST", headers: autorizacao, body: JSON.stringify({ id: sessao.user.id, weight_goal_kg: 80 }) });
    await avisar("dieta", "medidas", "habitos");
    ok(await esperar("Calorias · meta"), 'a meta de peso muda pela Gaia (a ferramenta de metas avisa "dieta", "medidas" e "habitos"): o anel passa a "Calorias · meta" sem recarregar');
    await fetch(`${MOCK}/rest/v1/profiles`, { method: "POST", headers: autorizacao, body: JSON.stringify({ id: sessao.user.id, weight_goal_kg: 62 }) });
    await avisar("dieta");
    ok(await esperar("Calorias · limite"), 'e volta ao limite quando a meta volta, só com "dieta" (é o ouvinte que cobre as metas)');
    // O peso: a pesagem mais recente da Maria passa a 50 kg, abaixo da meta.
    const linhas = await (await fetch(`${MOCK}/rest/v1/body_measurements?weight_kg=not.is.null&measured_by=is.null&order=date.desc&limit=1`, { headers: autorizacao })).json();
    const r = await fetch(`${MOCK}/rest/v1/body_measurements?id=eq.${linhas[0].id}`, { method: "PATCH", headers: autorizacao, body: JSON.stringify({ weight_kg: 50 }) });
    ok(r.status === 204 || r.status === 200, `preparo: a última pesagem passa a 50 kg no mock (${r.status})`);
    await avisar("medidas");
    ok(await esperar("Calorias · meta"), 'o peso muda pela Gaia ("medidas"): o anel passa a "Calorias · meta" sem recarregar');
    // Cada evento também faz o AppShell dar router.refresh(): sair da página com
    // um deles em voo aborta o pedido, e o Next registra "Failed to fetch RSC
    // payload" no console (que o roteiro conta como erro).
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(1000);
  }));

  // =========================================================================
  console.log("\nPlano alimentar");
  await etapa("plano alimentar", async () => {
    await carregar();
    ok((await plano.count()) === 1, 'o plano tem id="plano" (o link da Início aponta para #plano)');
    const classe = await plano.evaluate((e) => e.className);
    ok(/\bcard\b/.test(classe), `é um .card só (${classe.split(" ").slice(0, 4).join(" ")})`);
    ok((await plano.locator(".card").count()) === 0, "e não tem outro cartão dentro dele");
    const t = (await plano.innerText()).replace(/\s+/g, " ");
    ok(/Plano alimentar — fase 1/.test(t), "com o título do plano");
    ok(t.includes("de Ricardo, seu nutricionista"), '"de Ricardo, seu nutricionista"');
    ok(!/\bdo (Ricardo|seu nutricionista)/.test(t) && !/Prescrito pelo seu/.test(t), 'nunca "do Ricardo" (e sem o "Prescrito pelo seu…" de antes)');
    const ver = plano.locator('a[href="/app/nutricionista?aba=cardapio"]', { hasText: "ver em Meu plano" });
    ok((await ver.count()) === 1, 'e o link "ver em Meu plano" leva a Meu plano (aba cardápio)');
    ok(/seu nutricionista · ver em Meu plano/.test(t), 'na ordem "… seu nutricionista · ver em Meu plano"');
    const iTitulo = t.indexOf("Plano alimentar — fase 1");
    const iObs = t.indexOf("Beba água entre as refeições");
    const iCafe = t.indexOf("Café da manhã");
    ok(iTitulo >= 0 && iObs > iTitulo && iCafe > iObs, "a observação do plano vem depois do título e antes das refeições");
    const alvoVer = await alvoReal(ver);
    ok(alvoVer.h >= 44, `o link "ver em Meu plano" tem 44 px de altura de toque (${JSON.stringify(alvoVer)})`);

    ok((await plano.getByText(/Não deu para carregar as refeições do dia/).count()) === 0, "com as refeições carregadas, o plano não traz o aviso de leitura");
    const subtitulos = (await plano.locator("h3").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim());
    ok(JSON.stringify(subtitulos) === JSON.stringify(["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"]),
      "cada refeição é um subtítulo, sem “feito” (nada registrado hoje)", subtitulos.join(" | "));
    ok((await comiIsso.count()) === 5, `cinco botões "Comi isso", um por opção (${await comiIsso.count()})`);
    const linhas = plano.locator("ul > li");
    ok((await linhas.count()) === 5, "as opções são linhas de lista");
    const primeira = (await linhas.nth(0).innerText()).replace(/\s+/g, " ");
    const terceira = (await linhas.nth(2).innerText()).replace(/\s+/g, " ");
    ok(primeira.includes("opção 1") && primeira.includes("2 ovos mexidos + 1 fatia de pão integral + 1 banana") && primeira.includes("380 kcal · 20 g prot"),
      'a refeição com duas opções numera ("opção 1") e dá "380 kcal · 20 g prot"', primeira);
    ok((await linhas.nth(1).innerText()).includes("opção 2"), 'e a segunda é a "opção 2"');
    ok(!/opção/.test(terceira) && terceira.includes("620 kcal · 45 g prot"), "a refeição de uma opção só não numera", terceira);
    ok((await linhas.nth(0).locator(".tabular").count()) >= 1, "os números da opção levam .tabular");
    const divisoes = await plano.locator("ul").first().evaluate((ul) => getComputedStyle(ul.children[1]).borderTopWidth);
    ok(divisoes === "1px", `as opções são separadas por traço (divide-y): ${divisoes}`);
    const tams = await linhas.nth(0).evaluate((li) => {
      return { desc: getComputedStyle(li.firstElementChild.firstElementChild).fontSize, meta: getComputedStyle(li.querySelector(".tabular")).fontSize };
    });
    ok(tams.desc === "15px" && tams.meta === "13px", `descrição em 15 px e "kcal · prot" em 13 px (${tams.desc}, ${tams.meta})`);
    await plano.screenshot({ path: `${OUT}/plano.png` });
  });

  await etapa("Comi isso", () => comEstado(async () => {
    await carregar();
    const primeiro = comiIsso.first();
    await hidratado(primeiro);
    const visual = await caixa(primeiro);
    ok(!!visual && visual.h >= 40 && visual.h <= 44.5, `"Comi isso" é o secundário de 40 px (${visual && visual.h} px)`);
    const alvo = await alvoReal(primeiro);
    ok(alvo44(alvo), `e a área de toque chega a 44 px (${JSON.stringify(alvo)})`);
    const estilo = await primeiro.evaluate((e) => { const c = getComputedStyle(e); return { fundo: c.backgroundColor, borda: c.borderTopColor, letra: c.fontSize }; });
    ok(estilo.fundo === (await corDaVariavel(p, "--app-cartao")) && estilo.borda === (await corDaVariavel(p, "--app-campo", "borderTopColor")),
      "com fundo de cartão e borda campo (.btn-ghost)", JSON.stringify(estilo));
    await primeiro.click();
    await p.getByText("Café da manhã · feito", { exact: false }).first().waitFor({ timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(600);
    const h3 = (await plano.locator("h3").first().innerText()).replace(/\s+/g, " ").trim();
    ok(h3 === "Café da manhã · feito", `registrada, o subtítulo diz "Café da manhã · feito" (achado "${h3}")`);
    const feito = plano.locator("h3 span", { hasText: "feito" });
    if (await feito.count()) {
      const cor = await feito.first().evaluate((e) => getComputedStyle(e).color);
      ok(cor === (await corDaVariavel(p, "--app-primaria", "color")), "e o “· feito” é app-primaria");
    }
    const comi = plano.locator("ul > li").nth(0).locator("span", { hasText: /^comi$/ });
    ok((await comi.count()) === 1, 'a opção que foi registrada passa a dizer "comi"');
    ok((await plano.locator("ul > li").nth(0).getByRole("button", { name: "Comi isso" }).count()) === 0, 'e deixa de ter o botão "Comi isso"');
    if (await comi.count()) {
      const cor = await comi.evaluate((e) => getComputedStyle(e).color);
      ok(cor === (await corDaVariavel(p, "--app-primaria", "color")), 'e o "comi" é texto em app-primaria');
    }
    ok((await plano.locator("ul > li").nth(1).getByRole("button", { name: "Comi isso" }).count()) === 1, 'a outra opção do café segue com "Comi isso"');
    ok((await comiIsso.count()) === 4, `restam quatro botões (${await comiIsso.count()})`);

    // O que registrar mudou no resumo e na lista.
    ok((await numeroDoAnel("Calorias")) === 380, "o anel de calorias subiu para 380");
    ok((await numeroDoAnel("Proteína")) === 20, "o de proteína, para 20");
    const textos = (await resumo.locator("li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    ok(textos.join(" | ") === "Proteína 20 g | Carbo 42 g | Gordura 12 g", `a legenda: ${textos.join(" | ")}`);
    const barra = await resumo.evaluate((sec) => {
      const el = [...sec.querySelectorAll("div,span")].find((e) => e.children.length === 3 && !e.textContent.trim() && e.getBoundingClientRect().height >= 6 && e.getBoundingClientRect().height <= 16);
      return el ? [...el.children].map((k) => k.getBoundingClientRect().width) : null;
    });
    if (barra) {
      const total = barra.reduce((a, c) => a + c, 0);
      const cal = [20 * 4, 42 * 4, 12 * 9];
      const soma = cal.reduce((a, c) => a + c, 0);
      const dif = barra.map((w, i) => Math.abs(w / total - cal[i] / soma));
      ok(dif.every((d) => d < 0.012), `os segmentos seguem as calorias de cada macro (${barra.map((w) => Math.round((w / total) * 100)).join("/")} %)`);
    } else ok(false, "a barra de macros existe");
    const prox = (await sugestao.innerText()).replace(/\s+/g, " ");
    ok(/^Faltam 90 g .*Próxima refeição do seu plano: almoço, 45 g \(/.test(prox), "a sugestão passa para a próxima refeição do plano", prox);
    await resumo.screenshot({ path: `${OUT}/resumo-com-refeicao.png` });

    // A lista de refeições registradas.
    const lista = registradas.locator("ul > li");
    ok((await lista.count()) === 1, "a lista tem uma linha para a refeição");
    const linha = (await lista.first().innerText()).replace(/\s+/g, " ");
    ok(linha.includes("Café da manhã") && linha.includes("2 ovos mexidos + 1 fatia de pão integral + 1 banana") && linha.includes("380 kcal") && linha.includes("20 g prot") && linha.includes("42 g carbo") && linha.includes("12 g gord"),
      "com o tipo, os itens, as kcal e os macros", linha);
    ok((await lista.first().locator(".tabular").count()) >= 1, "os números levam .tabular");
    ok(/\bcard\b/.test(await registradas.locator("ul").evaluate((e) => e.className)) && (await registradas.locator(".card .card").count()) === 0, "num .card só, sem cartão dentro de cartão");
    ok((await registradas.getByText("Nenhuma refeição neste dia.").count()) === 0, 'e sem o "Nenhuma refeição neste dia."');

    const excluir = registradas.getByRole("button", { name: /^Excluir / });
    ok((await excluir.count()) === 1, 'cada linha tem o excluir com nome ("Excluir Café da manhã")', await excluir.evaluateAll((l) => l.map((e) => e.getAttribute("aria-label")).join("|")));
    ok(alvo44(await alvoReal(excluir.first())), `o excluir tem 44 px de toque (${JSON.stringify(await alvoReal(excluir.first()))})`);
    await registradas.screenshot({ path: `${OUT}/registradas.png` });
    await clicar(excluir.first());
    await registradas.getByText("Nenhuma refeição neste dia.").waitFor({ timeout: 10000 }).catch(() => {});
    ok((await registradas.getByText("Nenhuma refeição neste dia.").count()) === 1, "excluir apaga a refeição (e a lista volta a dizer que não há nenhuma)");
    ok((await plano.locator("h3").first().innerText()).trim() === "Café da manhã", "o plano deixa de dizer “feito”");
    ok((await comiIsso.count()) === 5, "e o botão volta nas cinco opções");
  }));

  await etapa("Comi isso com a gravação falhando", async () => {
    await carregar();
    const primeiro = comiIsso.first();
    await hidratado(primeiro);
    await comFalha("meals", async () => {
      await primeiro.click();
      const aviso = plano.getByText("Não foi possível registrar. Tente de novo.", { exact: true });
      ok(await aviso.waitFor({ timeout: 10000 }).then(() => true, () => false), 'gravação falhando: aparece "Não foi possível registrar. Tente de novo."');
      if (await aviso.count()) {
        const [cor, perigo] = await Promise.all([aviso.evaluate((e) => getComputedStyle(e).color), corDaVariavel(p, "--app-perigo", "color")]);
        ok(cor === perigo, "e em app-perigo");
      }
      ok((await plano.locator("h3").first().innerText()).trim() === "Café da manhã", 'e a refeição não ficou “feita”');
      ok((await comiIsso.count()) === 5, 'e o botão continua lá para tentar de novo');
    }, { escrita: true });
  });

  console.log("\nRefeições registradas");
  await etapa("dia sem refeição", async () => {
    await carregar();
    const vazio = registradas.getByText("Nenhuma refeição neste dia.");
    ok((await vazio.count()) === 1, '"Nenhuma refeição neste dia."');
    ok((await registradas.getByText("Adicione o que você comeu").count()) === 0 && (await registradas.locator("svg.h-10").count()) === 0,
      "sem o EmptyState de antes (ícone grande e frase de ajuda)");
    const link = registradas.getByRole("button", { name: "Registrar refeição", exact: true });
    ok((await link.count()) === 1, 'e um botão com cara de link, "Registrar refeição"');
    if (await link.count()) {
      const est = await link.evaluate((e) => { const c = getComputedStyle(e); return { cor: c.color, fundo: c.backgroundColor, borda: c.borderTopWidth }; });
      ok(est.cor === (await corDaVariavel(p, "--app-primaria", "color")) && est.fundo === "rgba(0, 0, 0, 0)" && est.borda === "0px", "em app-primaria, sem fundo nem borda (cara de link)", JSON.stringify(est));
      ok(alvo44(await alvoReal(link)), `com 44 px de toque (${JSON.stringify(await alvoReal(link))})`);
      await clicar(link);
      const dialogo = p.getByRole("heading", { name: "Nova refeição", exact: true });
      ok(await dialogo.waitFor({ timeout: 6000 }).then(() => true, () => false), "e abre o formulário de nova refeição");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
    }
  });

  await etapa("um dia com refeições (ontem)", async () => {
    await carregar();
    await irParaODia(ontem);
    const lista = registradas.locator("ul > li");
    ok((await lista.count()) === 3, `ontem a lista tem as três refeições da Maria (${await lista.count()})`);
    ok((await registradas.getByText("Nenhuma refeição neste dia.").count()) === 0, 'e sem o "Nenhuma refeição neste dia."');
    const dv = await registradas.locator("ul").evaluate((ul) => getComputedStyle(ul.children[1]).borderTopWidth);
    ok(dv === "1px", `separadas por traço (divide-y): ${dv}`);
    ok((await numeroDoAnel("Calorias")) === 1330, "o anel de ontem soma 1.330 kcal");
    const subs = (await plano.locator("h3").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim());
    ok(JSON.stringify(subs) === JSON.stringify(["Café da manhã · feito", "Almoço · feito", "Lanche da tarde", "Jantar · feito"]),
      "e o plano marca “feito” nas refeições de ontem, pelo tipo", subs.join(" | "));
    ok((await plano.locator("ul > li span", { hasText: /^comi$/ }).count()) === 0, 'sem “comi” em opção: a descrição registrada é outra');
    ok((await comiIsso.count()) === 5, 'e os botões seguem, para quem quiser registrar o plano nesse dia');
    await p.screenshot({ path: `${OUT}/ontem-390.png`, fullPage: true });
  });

  await etapa("registrar pelo formulário", () => comEstado(async () => {
    await carregar();
    await clicar(topo.getByRole("button", { name: "Registrar refeição", exact: true }));
    const dialogo = p.locator(".pf-modal");
    await dialogo.waitFor({ timeout: 6000 });
    ok((await dialogo.getByRole("heading", { name: "Nova refeição", exact: true }).count()) === 1, "o formulário abre");
    // Só a linguagem muda no modal: nenhuma cor da paleta antiga no formulário.
    // A busca de alimentos (FoodSearch) fica de fora: é a mesma do editor de
    // cardápio do nutricionista, e mexer nela mudaria o lado clínico.
    const antigas = await dialogo.locator("form").evaluate((f) => {
      const busca = f.querySelector('input[placeholder^="Buscar alimento"]')?.parentElement?.parentElement;
      return [...f.querySelectorAll("*")].filter((e) => !(busca && busca.contains(e))).map((e) => String(e.getAttribute("class") || "")).filter((c) => /(^|\s)(dark:)?(text|bg|border|ring|from|to|via|divide|placeholder)-(slate|brand|rose|violet|blue|amber|emerald|pink|sky|indigo)-/.test(c)).slice(0, 3);
    });
    ok(antigas.length === 0, "o formulário não usa a paleta antiga (slate/brand/rose…), fora a busca de alimentos", antigas.join(" | "));
    const caixaAlta = await dialogo.evaluate((d) => [...d.querySelectorAll("*")].filter((e) => getComputedStyle(e).textTransform === "uppercase").length);
    ok(caixaAlta === 0, `e sem caixa alta (${caixaAlta})`);
    await dialogo.screenshot({ path: `${OUT}/modal-390.png` });
    await dialogo.locator("textarea").fill("Teste da verificação");
    await dialogo.locator('input[placeholder="350"]').fill("300");
    await dialogo.locator('input[placeholder="25"]').fill("12");
    await dialogo.getByRole("button", { name: "Salvar refeição", exact: true }).click();
    await dialogo.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(700);
    ok((await registradas.locator("ul > li", { hasText: "Teste da verificação" }).count()) === 1, "salvar fecha o formulário e a refeição entra na lista");
    ok((await numeroDoAnel("Calorias")) === 300, "e o anel de calorias sobe para 300");
  }));

  await etapa("atalhos da Início (?novo=1 e ?foto=1)", async () => {
    await carregar("/app/dieta?novo=1");
    ok(await p.locator(".pf-modal").waitFor({ timeout: 8000 }).then(() => true, () => false), "?novo=1 abre o formulário");
    await carregar("/app/dieta?foto=1");
    ok(await p.locator(".pf-modal").waitFor({ timeout: 8000 }).then(() => true, () => false), "?foto=1 abre o formulário");
    await p.waitForTimeout(800);
    ok((await p.locator('.pf-modal input[type="file"][capture]').count()) === 1, "com o input da câmera (capture) no formulário");
    const cliques = await p.evaluate(() => window.__cliquesNoArquivo);
    ok(cliques >= 1, `e manda abrir a câmera (click() no input de arquivo: ${cliques}×)`);
  });

  // =========================================================================
  console.log("\nLeitura que falha não é “não tem”");
  const SEM_ZEROS = async () => {
    const aneis = await resumo.locator("figure").count();
    const zeros = await resumo.locator(".tabular", { hasText: /^0( g)?$/ }).count();
    return { aneis, zeros };
  };
  await etapa("refeições do dia falhando", () => comFalha("meals", async () => {
    await carregar();
    const aviso = resumo.getByText(/^Não deu para carregar/);
    ok((await aviso.count()) === 1, `meals falhando: o resumo diz "${(await aviso.count()) ? (await aviso.innerText()).trim() : "(sem aviso)"}"`);
    if (await aviso.count()) {
      const [cor, atencao] = await Promise.all([aviso.evaluate((e) => getComputedStyle(e).color), corDaVariavel(p, "--app-atencao", "color")]);
      ok(cor === atencao, "em app-atencao");
    }
    const { aneis, zeros } = await SEM_ZEROS();
    ok(aneis === 0 && zeros === 0, `e nenhum anel (${aneis}) nem "0" (${zeros}) no resumo`);
    ok((await resumo.locator("li").count()) === 0, "nem a legenda dos macros");
    ok((await sugestao.count()) === 0, "nem a sugestão");
    ok((await registradas.getByText("Nenhuma refeição neste dia.").count()) === 0, 'e a lista não diz "Nenhuma refeição neste dia."');
    ok((await registradas.getByText(/^Não deu para carregar/).count()) === 1, "a lista diz que não carregou");
    ok((await principal.innerText()).includes("Café da manhã"), "o plano, que é outra leitura, segue na tela");
    // Sem saber o que foi registrado, o plano não pode dizer "nada registrado":
    // sem "· feito", sem "comi" e, principalmente, sem "Comi isso" (quem já
    // registrou seria convidado a registrar de novo, e o dia e a adesão
    // contariam em dobro).
    const textoPlano = (await plano.innerText()).replace(/\s+/g, " ");
    ok((await comiIsso.count()) === 0, `meals falhando: o plano não oferece "Comi isso" (${await comiIsso.count()})`);
    ok(!/feito/.test(textoPlano) && (await plano.locator("ul > li span", { hasText: /^comi$/ }).count()) === 0, 'e não marca "· feito" nem "comi"');
    const avisoPlano = plano.getByText("Não deu para carregar as refeições do dia, então o plano não mostra o que já foi registrado.", { exact: true });
    ok((await avisoPlano.count()) === 1, "e uma linha dentro do cartão do plano diz que não carregou as refeições do dia");
    if (await avisoPlano.count()) {
      const [cor, atencao] = await Promise.all([avisoPlano.evaluate((e) => getComputedStyle(e).color), corDaVariavel(p, "--app-atencao", "color")]);
      ok(cor === atencao, "em app-atencao");
    }
    ok((await plano.locator("ul > li").count()) === 5 && ["2 ovos mexidos", "120 g de frango", "1 scoop de whey", "Omelete de 3 ovos"].every((t) => textoPlano.includes(t)),
      "e o plano segue legível: as cinco opções com a descrição");
    ok(textoPlano.includes("380 kcal · 20 g prot"), "com as kcal e a proteína de cada opção");
    await plano.screenshot({ path: `${OUT}/falha-meals-plano.png` });
    await p.screenshot({ path: `${OUT}/falha-meals-390.png`, fullPage: true });
  }));
  await etapa("perfil falhando", () => comFalha("profiles", async () => {
    await carregar();
    ok((await resumo.getByText(/^Não deu para carregar/).count()) === 1, "profiles falhando: o resumo diz que não carregou");
    const { aneis, zeros } = await SEM_ZEROS();
    ok(aneis === 0 && zeros === 0, `nenhum anel (${aneis}) nem "0" (${zeros})`);
    const t = await principal.innerText();
    ok(!t.includes("Definir metas"), 'e sem o "Definir metas" (a meta existe, só não carregou)');
    ok(!/Calorias · (limite|meta)/.test(t), "nem papel das calorias inventado");
    ok((await sugestao.count()) === 0, "nem sugestão");
    ok(!t.includes("de Ricardo"), 'e sem o nome do nutricionista (a leitura dele também falhou): nada de "de Ricardo"');
    ok(t.includes("seu nutricionista"), 'o plano segue dizendo "seu nutricionista"');
    await p.screenshot({ path: `${OUT}/falha-perfil-390.png`, fullPage: true });
  }));
  await etapa("peso falhando", () => comEstado(async () => {
    // Com o peso carregando, 2.400 kcal dariam "acima do limite": é o que a
    // falha não pode inventar.
    await gravarComoMaria("meals", { date: hoje, meal_type: "Ceia", description: "Verificação do peso", calories: 2400, protein_g: 20, carbs_g: 200, fat_g: 90 });
    await comFalha("body_measurements", async () => {
      await carregar();
      const rot = (await anel("Calorias").locator("figcaption").innerText()).trim();
      ok(rot === "Calorias", `body_measurements falhando: o anel não inventa o papel (achado "${rot}")`);
      ok((await anel("Calorias").getByText("acima do limite").count()) === 0, 'e não avisa "acima do limite"');
      ok((await resumo.locator("figure").count()) === 2, "os anéis seguem na tela, com os números do dia");
      ok((await numeroDoAnel("Calorias")) === 2400, "(2.400 kcal)");
      await resumo.screenshot({ path: `${OUT}/falha-peso-resumo.png` });
    });
  }));
  await etapa("vínculo falhando", () => comFalha("patient_links", async () => {
    await carregar();
    ok((await sugestao.count()) === 0, "patient_links falhando: sem sugestão (sem saber do vínculo, o app não sugere comida)");
    ok((await anel("Calorias").locator("figcaption").innerText()).trim() === "Calorias · limite", "o papel das calorias não depende do vínculo");
    const t = await plano.innerText();
    ok(!t.includes("de Ricardo") && t.includes("seu nutricionista"), 'e o plano não inventa o nome ("seu nutricionista", sem "de Ricardo")');
  }));
  for (const tabela of ["meal_plans", "meal_plan_items"]) {
    await etapa(`${tabela} falhando`, () => comFalha(tabela, async () => {
      await carregar();
      const aviso = p.getByText("Não deu para carregar o plano alimentar.", { exact: true });
      ok((await aviso.count()) === 1, `${tabela} falhando: "Não deu para carregar o plano alimentar." no lugar do plano`);
      if (await aviso.count()) {
        const [cor, atencao] = await Promise.all([aviso.evaluate((e) => getComputedStyle(e).color), corDaVariavel(p, "--app-atencao", "color")]);
        ok(cor === atencao, "em app-atencao");
      }
      ok((await sugestao.count()) === 0, "e sem sugestão");
      ok((await resumo.locator("figure").count()) === 2, "o resumo segue na tela");
    }));
  }

  // =========================================================================
  console.log("\n#plano (o link da Início)");
  await etapa("#plano rola até o plano", async () => {
    // De outra página: do contrário o goto só troca o hash da página que já
    // está aberta, sem recarregar, e a leitura de antes continua na tela.
    await carregar("/app/habitos");
    await carregar("/app/dieta#plano");
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ y: window.scrollY, topo: document.getElementById("plano")?.getBoundingClientRect().top ?? null }));
    ok(r.y > 0 && r.topo != null && r.topo >= 0 && r.topo <= 130, `abrir /app/dieta#plano rola até o plano (scrollY ${Math.round(r.y)}, topo do plano ${r.topo == null ? "—" : Math.round(r.topo)} px)`);
  });
  await etapa("o link da sugestão, na Início", async () => {
    await carregar("/app");
    const link = p.locator('a[href="/app/dieta#plano"]', { hasText: /^Faltam \d+ g de proteína/ });
    await hidratado(link);
    await link.click();
    await p.waitForURL("**/app/dieta#plano", { timeout: 30000 });
    await plano.waitFor({ timeout: 15000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ y: window.scrollY, topo: document.getElementById("plano")?.getBoundingClientRect().top ?? null }));
    ok(r.y > 0 && r.topo != null && r.topo >= 0 && r.topo <= 130, `tocar na sugestão da Início chega no plano (scrollY ${Math.round(r.y)}, topo do plano ${r.topo == null ? "—" : Math.round(r.topo)} px)`);
  });

  // =========================================================================
  console.log("\nMeu plano (usa o mesmo MealPlanView)");
  await etapa("Meu plano", async () => {
    await carregar("/app/nutricionista?aba=cardapio");
    const cartao = p.locator("#plano");
    ok((await cartao.count()) === 1, "o cardápio de Meu plano é o mesmo cartão");
    const t = (await cartao.innerText()).replace(/\s+/g, " ");
    ok(!t.includes("ver em Meu plano"), 'sem o link "ver em Meu plano" (já está em Meu plano)');
    ok(t.includes("Plano alimentar — fase 1") && t.includes("seu nutricionista"), "com o título e “seu nutricionista”");
    ok((await cartao.getByRole("button", { name: "Comi isso", exact: true }).count()) === 5, 'e os cinco "Comi isso"');
    const r = await p.evaluate(() => ({
      caixaAlta: [...document.querySelectorAll("main *")].filter((e) => getComputedStyle(e).textTransform === "uppercase").length,
      doc: document.documentElement.scrollWidth, janela: innerWidth,
    }));
    ok(r.caixaAlta === 0, `sem caixa alta na aba do cardápio (${r.caixaAlta})`);
    ok(r.doc <= r.janela, `e sem rolagem horizontal (${r.doc} ≤ ${r.janela})`);
    await p.screenshot({ path: `${OUT}/meu-plano-cardapio-390.png`, fullPage: true });
  });

  // =========================================================================
  console.log("\nLinguagem");
  await etapa("linguagem", async () => {
    await carregar();
    const r = await p.evaluate(() => {
      const main = document.querySelector("main");
      const caixaAlta = [...main.querySelectorAll("*")].filter((e) => getComputedStyle(e).textTransform === "uppercase");
      const comImagem = [...main.querySelectorAll(".card, .btn-primary")].filter((e) => getComputedStyle(e).backgroundImage !== "none");
      const antigas = [...main.querySelectorAll("[class]")]
        .map((e) => String(e.getAttribute("class")))
        .filter((c) => /(^|\s)(dark:)?(text|bg|border|ring|stroke|fill|from|to|via|divide|placeholder)-(slate|brand|rose|violet|blue|amber|emerald|pink|sky|indigo)-/.test(c) || /(^|\s)dark:/.test(c) || /bg-gradient|uppercase|tracking-wide/.test(c));
      return {
        nCaixaAlta: caixaAlta.length,
        nComImagem: comImagem.length,
        antigas: antigas.slice(0, 3),
        doc: document.documentElement.scrollWidth,
        janela: innerWidth,
        fontes: [document.body, document.querySelector("h1"), document.querySelector("h2")].map((e) => (e ? getComputedStyle(e).fontFamily : "")),
      };
    });
    ok(r.nCaixaAlta === 0, `nenhum text-transform: uppercase no main (${r.nCaixaAlta})`);
    ok(r.nComImagem === 0, `nenhum background-image em .card nem .btn-primary (${r.nComImagem})`);
    ok(r.antigas.length === 0, "nenhuma classe da paleta antiga, dark: nem degradê no main", r.antigas.join(" | "));
    ok(r.doc <= r.janela, `sem rolagem horizontal (${r.doc}px ≤ ${r.janela}px)`);
    ok(r.fontes.every((f) => /Instrument[ _]Sans/i.test(f)), "Instrument Sans no corpo, no h1 e no h2", r.fontes.join(" | "));
    await p.screenshot({ path: `${OUT}/dieta-390.png`, fullPage: true });
  });

  ok(errosDoConsole.length === 0, `nenhum erro no console durante o roteiro (${errosDoConsole.length})`, errosDoConsole.slice(0, 3).join(" | ").slice(0, 300));
  await ctx.close();

  // =========================================================================
  // Computador (1280 px): o mesmo cabeçalho, sem botão esticado nem transbordo.
  console.log("\nComputador (1280 px)");
  await etapa("1280 px", async () => {
    for (const [tema, escuro] of [["claro", false], ["escuro", true]]) {
      const c = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: escuro ? "dark" : "light", locale: "pt-BR" });
      const q = await entrar(c);
      await q.goto(APP + "/app/dieta", { waitUntil: "networkidle", timeout: 120000 });
      await q.locator("main h1").first().waitFor({ timeout: 60000 });
      await q.waitForTimeout(800);
      if (!escuro) {
        const r = await q.evaluate(() => {
          const cab = document.querySelector("main header");
          const reg = [...cab.querySelectorAll("button")].find((x) => x.textContent.trim() === "Registrar refeição")?.getBoundingClientRect();
          const rot = [...cab.querySelectorAll("button")].find((x) => /^(Hoje, )?\S+\. \d/.test(x.textContent.trim()))?.getBoundingClientRect();
          return { doc: document.documentElement.scrollWidth, janela: innerWidth, regLarg: reg && reg.width, regTopo: reg && reg.top, rotTopo: rot && rot.top, cabLarg: cab.getBoundingClientRect().width };
        });
        ok(r.doc <= r.janela, `sem rolagem horizontal (${r.doc} ≤ ${r.janela})`);
        ok(r.regLarg != null && r.regLarg < r.cabLarg / 2, `"Registrar refeição" não estica no computador (${Math.round(r.regLarg)} de ${Math.round(r.cabLarg)} px)`);
        ok(r.regTopo != null && r.rotTopo != null && Math.abs(r.regTopo - r.rotTopo) < 20, "e fica na linha da navegação do dia");
      }
      await q.screenshot({ path: `${OUT}/dieta-1280-${tema}.png`, fullPage: true });
      await c.close();
    }
  });

  // O celular no escuro, para a conferência visual.
  await etapa("390 px escuro", async () => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "pt-BR" });
    const q = await entrar(c);
    await q.goto(APP + "/app/dieta", { waitUntil: "networkidle", timeout: 120000 });
    await q.locator("main h1").first().waitFor({ timeout: 60000 });
    await q.waitForTimeout(800);
    await q.screenshot({ path: `${OUT}/dieta-390-escuro.png`, fullPage: true });
    await c.close();
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
