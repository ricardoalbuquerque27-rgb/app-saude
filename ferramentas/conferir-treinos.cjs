// Verificações de tela de Treinos do paciente, como a Maria do cenário padrão,
// em 390 px: cada gravação que falha (a escrita da tabela derrubada pelo
// `/__falhar`) diz o que não deu e não perde o que a pessoa fez. Antes, todas
// ignoravam o erro:
//
// - o "Novo treino" fechava o formulário e limpava o que foi digitado;
// - editar uma rotina apagava os exercícios dela antes de gravar os novos, e a
//   rotina ficava vazia;
// - excluir um treino, uma rotina ou uma sessão do plano tirava da tela (ou
//   recarregava) sem dizer que não excluiu;
// - o "Adicionar" do plano fechava o formulário sem a sessão.
//
// E as leituras que falham (o GET da tabela derrubado): eram `data ?? []`, e a
// semana dizia "Nada planejado.", o check-in punha o "Fui" sólido em dia já
// respondido, as Rotinas diziam "Nenhuma rotina ainda" e o Histórico, "Nenhum
// treino registrado". Agora cada aba diz o que não carregou, com "Tentar de
// novo".
//
// O check-in e o treino ao vivo têm as conferências deles no
// `conferir-inicio.cjs`. Precisa do mock SEM cenário e do dev no ar (ver
// LEIAME.md). Acusa com código de saída 1.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const OUT = process.env.OUT || path.join(os.tmpdir(), "conferir-treinos");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";
const MOCK = process.env.MOCK || "http://localhost:54321";
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

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

const reset = () => fetch(MOCK + "/__reset", { method: "POST" });
/** Roda `fn` com as ESCRITAS de `tabela` dando 500, e SEMPRE volta o mock depois. */
async function comEscritaFalhando(tabela, fn) {
  await fetch(MOCK + "/__falhar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabela, escrita: true }),
  });
  try {
    return await fn();
  } finally {
    await reset();
  }
}
/** Roda `fn` com os GET de `tabela` dando 500, e SEMPRE volta o mock depois. */
async function comLeituraFalhando(tabela, fn) {
  await fetch(MOCK + "/__falhar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabela }),
  });
  try {
    return await fn();
  } finally {
    await reset();
  }
}
const entrarComoMaria = async () =>
  (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "maria.teste@exemplo.com", password: "senha-de-mentira" }),
  })).json();
/** As linhas de `tabela` no mock, lidas direto (sem passar pela tela). */
async function noMock(tabela, consulta = "select=*") {
  const maria = await entrarComoMaria();
  const r = await fetch(`${MOCK}/rest/v1/${tabela}?${consulta}`, {
    headers: { authorization: `Bearer ${maria.access_token}` },
  });
  return r.json();
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
const aparece = (loc, ms = 20000) => loc.waitFor({ timeout: ms }).then(() => true, () => false);

async function entrar(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
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
  p.setDefaultTimeout(8000);
  // Os excluir pedem confirmação (`confirm`): o Playwright recusa por padrão.
  p.on("dialog", (d) => d.accept());
  return p;
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
  const p = await entrar(ctx);

  const abrir = async (aba) => {
    await p.goto(APP + "/app/treinos", { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Treinos", exact: true }).waitFor({ timeout: 60000 });
    await clicar(p.getByRole("button", { name: aba, exact: true }));
  };
  const modal = () => p.locator("div.pf-modal");
  const aviso = (texto) => p.getByRole("alert").filter({ hasText: texto });

  await etapa("Novo treino que não grava", () => comEscritaFalhando("workouts", async () => {
    await abrir("Histórico");
    await clicar(p.getByRole("button", { name: "Novo treino" }));
    const nome = modal().locator('input[placeholder="Treino A — Peito e tríceps"]');
    await hidratado(nome);
    await nome.fill("Treino de conferência");
    await clicar(modal().getByRole("button", { name: "Salvar treino" }));
    const viu = await aparece(aviso("Não deu para salvar o treino. Tente de novo."));
    ok(viu, 'diz "Não deu para salvar o treino. Tente de novo."');
    ok(await modal().isVisible(), "o formulário fica aberto");
    ok((await nome.inputValue()) === "Treino de conferência", "com o que foi digitado");
    await p.screenshot({ path: `${OUT}/novo-treino-falhou.png` });
  }));

  await etapa("Novo treino que grava", async () => {
    try {
      await abrir("Histórico");
      await clicar(p.getByRole("button", { name: "Novo treino" }));
      const nome = modal().locator('input[placeholder="Treino A — Peito e tríceps"]');
      await hidratado(nome);
      await nome.fill("Treino de conferência");
      await clicar(modal().getByRole("button", { name: "Salvar treino" }));
      await modal().waitFor({ state: "detached", timeout: 20000 });
      const viu = await aparece(p.getByText("Treino de conferência", { exact: true }).first());
      ok(viu, "o formulário fecha e o treino aparece no Histórico");
    } finally {
      await reset();
    }
  });

  await etapa("Excluir treino que não exclui", () => comEscritaFalhando("workouts", async () => {
    await abrir("Histórico");
    const excluir = p.getByRole("button", { name: /^Excluir treino / }).first();
    const rotulo = await (await excluir.elementHandle()).getAttribute("aria-label");
    const antes = await p.getByRole("button", { name: rotulo, exact: true }).count();
    await clicar(excluir);
    const viu = await aparece(aviso("Não deu para excluir o treino. Tente de novo."));
    ok(viu, 'diz "Não deu para excluir o treino. Tente de novo."');
    ok((await p.getByRole("button", { name: rotulo, exact: true }).count()) === antes, "e o treino segue na lista");
  }));

  await etapa("Editar rotina que não grava", () => comEscritaFalhando("routine_exercises", async () => {
    const antes = await noMock("routine_exercises", "select=id,routine_id,name");
    await abrir("Rotinas");
    await clicar(p.getByRole("button", { name: "Editar rotina" }).first());
    const nome = modal().locator('input[placeholder="Ex.: Treino A — Peito e tríceps"]');
    await hidratado(nome);
    const original = await nome.inputValue();
    await nome.fill(original + " (editada)");
    await clicar(modal().getByRole("button", { name: "Salvar alterações" }));
    const viu = await aparece(aviso("Não deu para salvar a rotina. Tente de novo."));
    ok(viu, 'diz "Não deu para salvar a rotina. Tente de novo."');
    ok(await modal().isVisible(), "o formulário fica aberto, com o que foi digitado");
    const depois = await noMock("routine_exercises", "select=id,routine_id,name");
    ok(JSON.stringify(depois) === JSON.stringify(antes),
      `os exercícios da rotina ficam como estavam (${antes.length} → ${depois.length})`);
    const rotina = (await noMock("routines", "select=id,name")).find((r) => r.name === original);
    ok(!!rotina, `e o nome também ("${original}")`);
  }));

  await etapa("Excluir rotina que não exclui", () => comEscritaFalhando("routines", async () => {
    await abrir("Rotinas");
    const antes = await p.getByRole("button", { name: "Excluir rotina" }).count();
    await clicar(p.getByRole("button", { name: "Excluir rotina" }).first());
    const viu = await aparece(aviso("Não deu para excluir a rotina. Tente de novo."));
    ok(viu, 'diz "Não deu para excluir a rotina. Tente de novo."');
    ok((await p.getByRole("button", { name: "Excluir rotina" }).count()) === antes, "e a rotina segue na lista");
  }));

  await etapa("Remover sessão do plano que não remove", () => comEscritaFalhando("workout_plan", async () => {
    await abrir("Semana");
    const antes = await p.getByRole("button", { name: "Remover", exact: true }).count();
    await clicar(p.getByRole("button", { name: "Remover", exact: true }).first());
    const viu = await aparece(aviso("Não deu para remover a sessão. Tente de novo."));
    ok(viu, 'diz "Não deu para remover a sessão. Tente de novo."');
    ok((await p.getByRole("button", { name: "Remover", exact: true }).count()) === antes, "e a sessão segue no plano");
  }));

  await etapa("Adicionar ao plano que não grava", () => comEscritaFalhando("workout_plan", async () => {
    await abrir("Semana");
    await clicar(p.getByRole("button", { name: "Adicionar", exact: true }).first());
    await modal().waitFor({ timeout: 20000 });
    await clicar(modal().getByRole("button", { name: "Adicionar", exact: true }));
    const viu = await aparece(aviso("Não deu para adicionar a sessão. Tente de novo."));
    ok(viu, 'diz "Não deu para adicionar a sessão. Tente de novo."');
    ok(await modal().isVisible(), "o formulário fica aberto");
    await p.screenshot({ path: `${OUT}/adicionar-falhou.png` });
  }));

  // Cada aba carrega pelo `load()` do navegador: a falha vale a partir do
  // `goto`. "Tentar de novo" lê outra vez, já sem a falha.
  const semAvisoVazio = async (vazio) => (await p.getByText(vazio, { exact: true }).count()) === 0;
  const tentarDeNovo = async (depois) => {
    await reset();
    await clicar(p.getByRole("button", { name: "Tentar de novo" }).first());
    return aparece(depois);
  };

  await etapa("Semana com o plano sem carregar", () => comLeituraFalhando("workout_plan", async () => {
    await abrir("Semana");
    const viu = await aparece(p.getByText("Não deu para carregar o plano da semana.", { exact: true }));
    ok(viu, 'diz "Não deu para carregar o plano da semana."');
    ok(await semAvisoVazio("Nada planejado."), 'e nenhum dia diz "Nada planejado."');
    ok((await p.getByText("Dias com treino", { exact: true }).count()) === 0, "nem os números da semana, que seriam zero");
    await p.screenshot({ path: `${OUT}/semana-falhou.png` });
    ok(await tentarDeNovo(p.getByRole("heading", { name: "Segunda", exact: true })), '"Tentar de novo" carrega a semana');
  }));

  await etapa("Semana com as respostas sem carregar", () => comLeituraFalhando("plan_completions", async () => {
    await abrir("Semana");
    const viu = await aparece(p.getByText("Não deu para carregar as respostas da semana.", { exact: true }));
    ok(viu, 'diz "Não deu para carregar as respostas da semana."');
    ok((await p.locator("button[aria-pressed]").count()) === 0,
      'e não mostra os botões do check-in (sem as respostas, o "Fui" sólido mentiria sobre dia já respondido)');
    ok((await p.getByText("Confirmados na semana", { exact: true }).count()) === 0, 'nem o "Confirmados na semana", que seria zero');
    ok(await p.getByRole("heading", { name: "Segunda", exact: true }).isVisible(), "e o plano da semana continua lá");
    ok(await tentarDeNovo(p.locator("button[aria-pressed]").first()), '"Tentar de novo" traz o check-in de volta');
  }));

  for (const tabela of ["routines", "routine_exercises"]) {
    await etapa(`Rotinas sem carregar (${tabela})`, () => comLeituraFalhando(tabela, async () => {
      await abrir("Rotinas");
      const viu = await aparece(p.getByText("Não deu para carregar as rotinas.", { exact: true }));
      ok(viu, 'diz "Não deu para carregar as rotinas."');
      ok(await semAvisoVazio("Nenhuma rotina ainda"), 'e não "Nenhuma rotina ainda"');
      ok(await tentarDeNovo(p.getByRole("button", { name: "Editar rotina" }).first()), '"Tentar de novo" carrega as rotinas');
    }));
  }

  await etapa("Semana com as rotinas sem carregar", () => comLeituraFalhando("routines", async () => {
    // Sem as rotinas, o "Iniciar treino" sumia calado das sessões com rotina.
    await abrir("Semana");
    const viu = await aparece(p.getByText("Não deu para carregar as rotinas.", { exact: true }));
    ok(viu, 'a Semana também diz "Não deu para carregar as rotinas." (o "Iniciar treino" depende delas)');
  }));

  for (const tabela of ["workouts", "exercises"]) {
    await etapa(`Histórico sem carregar (${tabela})`, () => comLeituraFalhando(tabela, async () => {
      await abrir("Histórico");
      const viu = await aparece(p.getByText("Não deu para carregar o histórico.", { exact: true }));
      ok(viu, 'diz "Não deu para carregar o histórico."');
      ok(await semAvisoVazio("Nenhum treino registrado"), 'e não "Nenhum treino registrado"');
      ok((await p.getByRole("button", { name: /Repetir último/ }).count()) === 0, 'nem oferece "Repetir último"');
      await clicar(p.getByRole("button", { name: "Progressão", exact: true }));
      const viuProgressao = await aparece(p.getByText("Não deu para carregar o histórico.", { exact: true }));
      ok(viuProgressao, "a Progressão diz o mesmo");
      ok(await semAvisoVazio("Sem dados de progressão ainda"), 'e não "Sem dados de progressão ainda"');
      await clicar(p.getByRole("button", { name: "Histórico", exact: true }));
      ok(await tentarDeNovo(p.getByRole("button", { name: /^Excluir treino / }).first()), '"Tentar de novo" carrega o histórico');
    }));
  }

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
