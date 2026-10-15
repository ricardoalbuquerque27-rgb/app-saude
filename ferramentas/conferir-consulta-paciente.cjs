// A consulta do lado do paciente, com a Maria do cenário padrão.
//
// Na Início ela é uma LINHA no topo (components/LinhaDaConsulta.tsx), que leva
// a "Meu plano" (/app/nutricionista#consulta); o cartão inteiro, com as ações,
// mora lá. Este roteiro confere a linha em cada situação (agendada, remarcação
// pedida, pedido, agendada com pedido, cancelada pelo nutri, nenhuma e leitura
// que falhou) e o link; dirige as ações em "Meu plano" (ver a próxima, pedir
// remarcação, cancelar, pedir consulta e cancelar o pedido); e confere a
// medida que o nutri tirou na consulta, que a página Medidas marca e não deixa
// excluir (nem o banco deixa), e o Perfil, que não mostra o CRN. Acusa com
// código de saída 1.
//
// Precisa do mock SEM cenário (`node ferramentas/mock-supabase.cjs`) e do dev
// no ar (ver LEIAME.md). As consultas do mock voltam ao início antes e depois
// (POST /__reset). O que o paciente não faz pela tela (o nutri cancelar ou
// marcar uma consulta) sai das funções do próprio mock, com o token do nutri.
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

// O rótulo que a linha e o cartão mostram para uma consulta `n` dias à frente, escrito
// aqui de novo e à mão de propósito: se o app e o roteiro errarem juntos, é a mesma conta.
const DIA_CURTO = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const rotuloEm = (n, hhmm) => {
  const dia = diaSP(n);
  return `${DIA_CURTO[new Date(dia + "T12:00:00Z").getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hhmm}`;
};
// O instante de uma hora de São Paulo `n` dias à frente, com o deslocamento
// DAQUELE dia tirado do Intl, como o diaSP: um "-03:00" fixo erraria em uma
// hora se o horário de verão voltar (CLAUDE.md: hora de consulta nunca com
// deslocamento fixo). A mesma conta do instanteEmSaoPaulo de lib/consultas.ts,
// escrita aqui de novo: o palpite em UTC, o deslocamento dele e, perto da
// troca de horário, o do resultado.
const partesSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const deslocamentoSP = (ms) => {
  const p = Object.fromEntries(partesSP.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
};
const instante = (n, hhmm) => {
  const [a, m, d] = diaSP(n).split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const ingenuo = Date.UTC(a, m - 1, d, h, mi);
  let ms = ingenuo - deslocamentoSP(ingenuo);
  if (deslocamentoSP(ms) !== deslocamentoSP(ingenuo)) ms = ingenuo - deslocamentoSP(ms);
  return new Date(ms).toISOString();
};

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
  // "Meu plano": onde o cartão de consulta, com as ações, mora.
  const abrir = async (ctx, rota = "/app/nutricionista") => {
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
  // A Início: a linha da consulta, quando há, é o único link para #consulta.
  const abrirInicio = async (ctx) => {
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && erros.push(`/app: ${m.text()}`));
    page.on("pageerror", (e) => erros.push(`/app: ${e.message}`));
    await page.goto(APP + "/app", { waitUntil: "networkidle", timeout: 120000 });
    await page.locator("h1").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    return page;
  };
  const cartao = (page) => page.locator('section[aria-label="Consulta"]');
  const linha = (page) => page.locator('a[href="/app/nutricionista#consulta"]');
  const texto = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
  const esperarTexto = (page, t) =>
    page
      .waitForFunction((t) => document.querySelector('section[aria-label="Consulta"]')?.textContent?.includes(t), t, {
        timeout: 30000,
      })
      .catch(() => {});

  // O que o paciente não faz pela tela (o nutri cancelar ou marcar uma consulta)
  // sai das funções do mock, com o token de cada um.
  const entrar = async (email) =>
    (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "senha-de-mentira" }),
    })).json();
  const chamar = async (sessao, nome, args, para) => {
    const r = await (await fetch(`${MOCK}/rest/v1/rpc/${nome}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify(args),
    })).json();
    ok(r.ok === true, `preparo: ${para}`, JSON.stringify(r));
    return r;
  };
  const maria = await entrar("maria.teste@exemplo.com");
  const nutri = await entrar("nutri@exemplo.com");

  /**
   * Confere a linha da Início numa situação: o texto inteiro (título e
   * subtítulo, na ordem), que ela é o link para Meu plano, que o cartão
   * inteiro NÃO está na Início e que a linha vem antes de tudo que é cartão.
   */
  async function conferirLinha(ctx, rotulo, esperado, foto) {
    const page = await abrirInicio(ctx);
    const n = await linha(page).count();
    const t = n === 1 ? await texto(linha(page)) : `(${n} links para #consulta)`;
    ok(n === 1 && t === esperado, `Início, ${rotulo}: a linha diz "${esperado}"`, t);
    if (n === 1) {
      const caixas = await page.evaluate(() => {
        const a = document.querySelector('a[href="/app/nutricionista#consulta"]').getBoundingClientRect();
        const primeiro = document.querySelector("main section, section.card");
        return { linhaTopo: a.top, altura: a.height, secaoTopo: primeiro ? primeiro.getBoundingClientRect().top : null };
      });
      ok(caixas.altura >= 44, `Início, ${rotulo}: a linha tem ao menos 44 px de alvo de toque (${Math.round(caixas.altura)}px)`);
      ok(caixas.secaoTopo === null || caixas.linhaTopo < caixas.secaoTopo,
        `Início, ${rotulo}: a linha vem antes do primeiro cartão (${Math.round(caixas.linhaTopo)}px < ${Math.round(caixas.secaoTopo)}px)`);
    }
    ok((await cartao(page).count()) === 0, `Início, ${rotulo}: o cartão de consulta, com as ações, não está mais aqui`);
    if (foto) await page.screenshot({ path: `${OUT}/linha-${foto}.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
    await page.close();
  }

  // Prints: Início e Meu plano, celular e computador, claro e escuro.
  console.log("\nPrints");
  for (const [nome, w, h, mobile] of [["mobile", 390, 844, true], ["desktop", 1280, 800, false]]) {
    for (const escuro of [false, true]) {
      const ctx = await contexto(w, h, mobile, escuro);
      if (escuro) await ctx.addInitScript(() => { try { localStorage.setItem("pf-theme", "dark"); } catch {} });
      const quando = `${nome}/${escuro ? "escuro" : "claro"}`;
      {
        const page = await abrirInicio(ctx);
        const doc = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(doc <= w, `sem transbordo: inicio/${quando} (${doc}px)`);
        await page.screenshot({ path: `${OUT}/inicio-${nome}-${escuro ? "escuro" : "claro"}.png` });
        await page.close();
      }
      {
        const page = await abrir(ctx);
        const doc = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(doc <= w, `sem transbordo: meu-plano/${quando} (${doc}px)`);
        await cartao(page).screenshot({ path: `${OUT}/consulta-meu-plano-${nome}-${escuro ? "escuro" : "claro"}.png` });
        await page.close();
      }
      await ctx.close();
    }
  }

  const cel = await contexto(390, 844, true, false);

  console.log("\nA linha na Início");
  // Agendada: o cenário padrão tem a próxima daqui a 3 dias, 14:00, online.
  await conferirLinha(cel, "agendada", `Próxima consulta ${rotuloEm(3, "14:00")} · online`, "agendada");

  // O link leva ao cartão em Meu plano, já rolado até ele.
  {
    const page = await abrirInicio(cel);
    await clicar(linha(page));
    await page.waitForURL("**/app/nutricionista#consulta", { timeout: 60000 }).catch(() => {});
    ok(new URL(page.url()).pathname === "/app/nutricionista" && new URL(page.url()).hash === "#consulta",
      "o link leva a /app/nutricionista#consulta", page.url());
    await cartao(page).waitFor({ state: "visible", timeout: 60000 });
    await page.waitForTimeout(800);
    const ondeFica = await page.evaluate(() => {
      const r = document.getElementById("consulta")?.getBoundingClientRect();
      return r ? { topo: Math.round(r.top), base: Math.round(r.bottom), janela: innerHeight } : null;
    });
    ok(!!ondeFica && ondeFica.topo >= 56 && ondeFica.topo < ondeFica.janela / 2,
      "e a página chega rolada até o cartão, abaixo da barra de cima (scroll-mt)", JSON.stringify(ondeFica));
    await page.close();
  }

  console.log("\nO cartão, em Meu plano");
  {
    const page = await abrir(cel);
    const t = await texto(cartao(page));
    ok(t.includes("Próxima consulta") && t.includes("às 14:00") && t.includes("online"),
      "Meu plano: mostra a próxima consulta (daqui a 3 dias, 14:00, online)", t);
    ok((await page.locator("#consulta section[aria-label='Consulta']").count()) === 1,
      "e o cartão está dentro de #consulta, o destino da linha");
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
  console.log("\nA linha na Início, depois");
  await conferirLinha(cel, "remarcação pedida", `Próxima consulta ${rotuloEm(3, "14:00")} · online · remarcação pedida`, "remarcacao-pedida");
  await fetch(MOCK + "/__reset", { method: "POST" });
  {
    const page = await abrir(cel);
    await clicar(cartao(page).getByRole("button", { name: "Cancelar", exact: true }));
    await esperarTexto(page, "Nenhuma consulta marcada");
    ok((await texto(cartao(page))).includes("Nenhuma consulta marcada"), "Cancelar (com confirmação) tira a consulta");
    await page.close();
  }
  // Cancelada pela própria paciente não é aviso: sem consulta, a linha some.
  {
    const page = await abrirInicio(cel);
    const t = await texto(page.locator("body"));
    ok((await linha(page).count()) === 0, "Início, nenhuma consulta: sem a linha (e sem link para #consulta)");
    ok(!t.includes("Não deu para carregar a consulta") && !t.includes("Próxima consulta") && !t.includes("Consulta pedida") && !/Consulta de .* cancelada/.test(t),
      "e sem nenhum texto de consulta no lugar (cancelada por ela mesma não conta)");
    await page.screenshot({ path: `${OUT}/inicio-sem-consulta.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
    await page.close();
  }
  {
    const page = await abrir(cel);
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
    await page.close();
  }
  await conferirLinha(cel, "pedido", `Consulta pedida ${rotuloEm(5, "09:30")} · aguardando Ricardo`, "pedido");
  {
    const page = await abrir(cel);
    await clicar(cartao(page).getByRole("button", { name: "Cancelar pedido" }));
    await esperarTexto(page, "Nenhuma consulta marcada");
    ok((await texto(cartao(page))).includes("Nenhuma consulta marcada"), "Cancelar pedido volta ao 'Pedir consulta'");
    await page.close();
  }

  // Agendada e, ao mesmo tempo, um pedido aberto: o nutri marcou sem responder.
  console.log("\nA linha na Início, por funções do mock");
  await fetch(MOCK + "/__reset", { method: "POST" });
  await chamar(maria, "cancelar_consulta", { p_id: "ap-m2" }, "a Maria cancela a consulta marcada");
  await chamar(maria, "pedir_consulta", { p_inicio: instante(5, "09:30"), p_modo: "online", p_mensagem: null }, "a Maria pede outra");
  await chamar(nutri, "marcar_consulta", {
    p_patient: maria.user.id, p_inicio: instante(7, "10:00"), p_duracao: 45, p_tipo: "retorno", p_modo: "presencial",
  }, "o nutri marca uma consulta sem responder ao pedido");
  await conferirLinha(cel, "agendada com um pedido aberto",
    `Próxima consulta ${rotuloEm(7, "10:00")} · presencial · e um pedido aguardando`, "agendada-e-pedido");

  // Cancelada pelo nutri nos últimos 7 dias, sem outra marcada. A do cenário é
  // daqui a 3 dias: a cancelada que ainda ia acontecer também conta.
  await fetch(MOCK + "/__reset", { method: "POST" });
  await chamar(nutri, "fechar_consulta", { p_id: "ap-m2", p_desfecho: "cancelada" }, "o nutri cancela a consulta marcada");
  await conferirLinha(cel, "cancelada pelo nutri",
    `Consulta de ${rotuloEm(3, "14:00").split(" às ")[0]} cancelada por Ricardo`, "cancelada-pelo-nutri");
  {
    // A mesma regra no cartão de Meu plano: a linha e o cartão não discordam.
    const page = await abrir(cel);
    const t = await texto(cartao(page));
    ok(t.includes("Ricardo cancelou a consulta de " + rotuloEm(3, "14:00")) && t.includes("Pedir consulta"),
      "Meu plano: o cartão diz a mesma coisa (Ricardo cancelou a consulta) e oferece pedir outra", t);
    await page.close();
  }

  // Leitura que falhou: nunca o silêncio do "nenhuma". O /__reset vai num
  // `finally`: um timeout no meio não deixa o mock falhando para o resto.
  await fetch(MOCK + "/__reset", { method: "POST" });
  await fetch(MOCK + "/__falhar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabela: "appointments" }),
  });
  try {
    const page = await abrirInicio(cel);
    const aviso = page.getByText("Não deu para carregar a consulta", { exact: true });
    ok((await aviso.count()) === 1, 'Início, leitura falhou: a linha diz "Não deu para carregar a consulta"');
    ok((await linha(page).count()) === 0, "e não oferece link para uma consulta que não leu");
    ok(!(await texto(page.locator("body"))).includes("Próxima consulta"), 'e não diz "Próxima consulta"');
    await page.screenshot({ path: `${OUT}/linha-falhou.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
    await page.close();
  } finally {
    await fetch(MOCK + "/__reset", { method: "POST" });
  }
  {
    // Passada a falha, a linha volta com a consulta (o /__reset desliga o /__falhar).
    const page = await abrirInicio(cel);
    ok((await linha(page).count()) === 1, "depois do /__reset, a linha volta");
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
