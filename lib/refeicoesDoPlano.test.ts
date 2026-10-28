import { describe, it, expect } from "vitest";
import { bancoEmMemoria, type Chamada } from "./bancoEmMemoria";
import {
  ERRO_AO_MARCAR,
  ERRO_DATA_FORA,
  ERRO_REFEICAO_FORA,
  dataDaDieta,
  estadoDaRefeicao,
  lerPedido,
  marcarRefeicao,
  podeMarcar,
} from "./refeicoesDoPlano";

const HOJE = "2026-10-28";
const U = "u";

// O cardápio do paciente: Almoço com uma opção, Café da manhã com duas. Um
// plano antigo, também ativo, não pode valer.
function tabelas(extra: { meal_checks?: any[]; meals?: any[] } = {}) {
  return {
    meal_plans: [
      { id: "antigo", patient_id: U, active: true, created_at: "2026-09-01T00:00:00Z" },
      { id: "plano", patient_id: U, active: true, created_at: "2026-10-01T00:00:00Z" },
    ],
    meal_plan_items: [
      { id: "velho", meal_plan_id: "antigo", meal_type: "Almoço", position: 1, description: "Sopa",
        calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1 },
      { id: "i1", meal_plan_id: "plano", meal_type: "Almoço", position: 1, description: "Arroz e feijão",
        calories: 620, protein_g: 45, carbs_g: 70, fat_g: 12 },
      { id: "i3", meal_plan_id: "plano", meal_type: "Café da manhã", position: 2, description: "Iogurte",
        calories: 340, protein_g: 18, carbs_g: 45, fat_g: 8 },
      { id: "i2", meal_plan_id: "plano", meal_type: "Café da manhã", position: 1, description: "Ovos",
        calories: 380, protein_g: 20, carbs_g: 42, fat_g: 12 },
    ],
    meal_checks: extra.meal_checks ?? [],
    meals: extra.meals ?? [],
  } as Record<string, any[]>;
}

const escritas = (chamadas: Chamada[]) => chamadas.filter((c) => c.op !== "select");

describe("marcarRefeicao", () => {
  it("comi com uma opção grava a refeição da opção e a resposta ligada", async () => {
    const t = tabelas();
    const banco = bancoEmMemoria(t);
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(t.meals).toHaveLength(1);
    expect(t.meals[0]).toMatchObject({
      user_id: U, date: HOJE, meal_type: "Almoço", description: "Arroz e feijão",
      calories: 620, protein_g: 45, carbs_g: 70, fat_g: 12,
    });
    expect(t.meal_checks).toHaveLength(1);
    expect(t.meal_checks[0]).toMatchObject({
      user_id: U, date: HOJE, meal_type: "Almoço", status: "done", meal_id: t.meals[0].id,
    });
  });

  it("comi com várias opções grava só a resposta", async () => {
    const t = tabelas();
    const r = await marcarRefeicao(bancoEmMemoria(t), U, { data: HOJE, refeicao: "Café da manhã", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(t.meals).toHaveLength(0);
    expect(t.meal_checks[0]).toMatchObject({ meal_type: "Café da manhã", status: "done", meal_id: null });
  });

  it("comi sem opção com refeição do tipo já registrada não duplica", async () => {
    const t = tabelas({ meals: [{ id: "mao", user_id: U, date: HOJE, meal_type: "Almoço", description: "Marmita" }] });
    const r = await marcarRefeicao(bancoEmMemoria(t), U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(t.meals).toHaveLength(1);
    expect(t.meal_checks[0]).toMatchObject({ status: "done", meal_id: null });
  });

  it("comi de novo com resposta done não escreve nada", async () => {
    const t = tabelas({
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "done", meal_id: null }],
    });
    const banco = bancoEmMemoria(t);
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(escritas(banco.chamadas)).toEqual([]);
  });

  it("a refeição que falha não deixa resposta", async () => {
    const t = tabelas();
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "meals" && c.op === "insert" });
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
    expect(t.meal_checks).toHaveLength(0);
  });

  it("a resposta que falha apaga a refeição que acabou de criar", async () => {
    const t = tabelas();
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "meal_checks" && c.op === "upsert" });
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
    expect(t.meals).toHaveLength(0);
    expect(t.meal_checks).toHaveLength(0);
  });

  it("não comi depois de comi apaga só a refeição ligada", async () => {
    const t = tabelas({
      meals: [
        { id: "ligada", user_id: U, date: HOJE, meal_type: "Almoço", description: "Arroz e feijão" },
        { id: "outra", user_id: U, date: HOJE, meal_type: "Jantar", description: "Sopa" },
      ],
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "done", meal_id: "ligada" }],
    });
    const r = await marcarRefeicao(bancoEmMemoria(t), U, { data: HOJE, refeicao: "Almoço", resposta: "nao_comi" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(t.meals.map((m) => m.id)).toEqual(["outra"]);
    expect(t.meal_checks).toHaveLength(1);
    expect(t.meal_checks[0]).toMatchObject({ status: "skipped", meal_id: null });
  });

  it("apagar a refeição antiga que falha deixa a resposta como estava", async () => {
    const t = tabelas({
      meals: [{ id: "ligada", user_id: U, date: HOJE, meal_type: "Almoço", description: "Arroz e feijão" }],
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "done", meal_id: "ligada" }],
    });
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "meals" && c.op === "delete" });
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "nao_comi" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
    expect(t.meal_checks[0]).toMatchObject({ status: "done", meal_id: "ligada" });
    expect(t.meals).toHaveLength(1);
  });

  it("desfazer apaga a resposta e a refeição ligada", async () => {
    const t = tabelas({
      meals: [
        { id: "ligada", user_id: U, date: HOJE, meal_type: "Almoço", description: "Arroz e feijão" },
        { id: "outra", user_id: U, date: HOJE, meal_type: "Jantar", description: "Sopa" },
      ],
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "done", meal_id: "ligada" }],
    });
    const r = await marcarRefeicao(bancoEmMemoria(t), U, { data: HOJE, refeicao: "Almoço", resposta: "desfazer" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(t.meal_checks).toHaveLength(0);
    expect(t.meals.map((m) => m.id)).toEqual(["outra"]);
  });

  it("desfazer sem resposta não escreve", async () => {
    const banco = bancoEmMemoria(tabelas());
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "desfazer" }, HOJE);
    expect(r).toEqual({ ok: true });
    expect(escritas(banco.chamadas)).toEqual([]);
  });

  it("foi esta grava a opção escolhida e liga à resposta sem opção", async () => {
    const t = tabelas({
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Café da manhã", status: "done", meal_id: null }],
    });
    const r = await marcarRefeicao(
      bancoEmMemoria(t), U, { data: HOJE, refeicao: "Café da manhã", resposta: "comi", itemId: "i3" }, HOJE
    );
    expect(r).toEqual({ ok: true });
    expect(t.meals).toHaveLength(1);
    expect(t.meals[0]).toMatchObject({ description: "Iogurte", calories: 340, meal_type: "Café da manhã" });
    expect(t.meal_checks).toHaveLength(1);
    expect(t.meal_checks[0]).toMatchObject({ status: "done", meal_id: t.meals[0].id });
  });

  it("comi isso (com a opção) numa refeição sem resposta grava a opção e a resposta", async () => {
    const t = tabelas();
    const r = await marcarRefeicao(
      bancoEmMemoria(t), U, { data: HOJE, refeicao: "Café da manhã", resposta: "comi", itemId: "i2" }, HOJE
    );
    expect(r).toEqual({ ok: true });
    expect(t.meals[0]).toMatchObject({ description: "Ovos" });
    expect(t.meal_checks[0]).toMatchObject({ status: "done", meal_id: t.meals[0].id });
  });

  it("itemId de outra refeição é recusado", async () => {
    const banco = bancoEmMemoria(tabelas());
    const r = await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi", itemId: "i2" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_REFEICAO_FORA, invalido: true });
    expect(escritas(banco.chamadas)).toEqual([]);
  });

  it("a janela de 7 dias, contando hoje", async () => {
    expect(await marcarRefeicao(bancoEmMemoria(tabelas()), U, { data: "2026-10-22", refeicao: "Almoço", resposta: "nao_comi" }, HOJE))
      .toEqual({ ok: true });
    for (const data of ["2026-10-21", "2026-10-29"]) {
      const banco = bancoEmMemoria(tabelas());
      const r = await marcarRefeicao(banco, U, { data, refeicao: "Almoço", resposta: "comi" }, HOJE);
      expect(r).toEqual({ ok: false, erro: ERRO_DATA_FORA, invalido: true });
      expect(banco.chamadas).toEqual([]);
    }
  });

  it("sem cardápio, ou refeição fora dele, é recusado", async () => {
    const semPlano = { ...tabelas(), meal_plans: [] };
    expect(await marcarRefeicao(bancoEmMemoria(semPlano), U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE))
      .toEqual({ ok: false, erro: ERRO_REFEICAO_FORA, invalido: true });
    // O Jantar só existe no plano antigo... e nem lá: o plano que vale é o mais novo.
    expect(await marcarRefeicao(bancoEmMemoria(tabelas()), U, { data: HOJE, refeicao: "Jantar", resposta: "comi" }, HOJE))
      .toEqual({ ok: false, erro: ERRO_REFEICAO_FORA, invalido: true });
  });

  it("a leitura do cardápio que falha é falha, não recusa", async () => {
    const banco = bancoEmMemoria(tabelas(), { falhar: (c) => c.tabela === "meal_plans" });
    expect(await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE))
      .toEqual({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
  });

  it("a leitura da resposta atual que falha não escreve", async () => {
    const banco = bancoEmMemoria(tabelas(), { falhar: (c) => c.tabela === "meal_checks" && c.op === "select" });
    expect(await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "nao_comi" }, HOJE))
      .toEqual({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
    expect(escritas(banco.chamadas)).toEqual([]);
  });

  it("não comi depois de não comi não escreve", async () => {
    const banco = bancoEmMemoria(tabelas({
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "skipped", meal_id: null }],
    }));
    expect(await marcarRefeicao(banco, U, { data: HOJE, refeicao: "Almoço", resposta: "nao_comi" }, HOJE)).toEqual({ ok: true });
    expect(escritas(banco.chamadas)).toEqual([]);
  });

  it("comi depois de não comi, com uma opção, grava a refeição", async () => {
    const t = tabelas({
      meal_checks: [{ id: "c", user_id: U, date: HOJE, meal_type: "Almoço", status: "skipped", meal_id: null }],
    });
    expect(await marcarRefeicao(bancoEmMemoria(t), U, { data: HOJE, refeicao: "Almoço", resposta: "comi" }, HOJE)).toEqual({ ok: true });
    expect(t.meals).toHaveLength(1);
    expect(t.meal_checks).toHaveLength(1);
    expect(t.meal_checks[0]).toMatchObject({ status: "done", meal_id: t.meals[0].id });
  });
});

describe("estadoDaRefeicao", () => {
  const opcoes = [
    { id: "i2", description: "Ovos" },
    { id: "i3", description: "Iogurte" },
  ];

  it("sem resposta e sem registro", () => {
    expect(estadoDaRefeicao({ opcoes, resposta: null, registradas: [] })).toEqual({ tipo: "sem_resposta" });
  });
  it("registrada sem resposta: a opção de mesma descrição, ou nenhuma", () => {
    expect(estadoDaRefeicao({ opcoes, resposta: null, registradas: [{ id: "m", description: " Iogurte " }] }))
      .toEqual({ tipo: "registrada", opcaoId: "i3" });
    expect(estadoDaRefeicao({ opcoes, resposta: null, registradas: [{ id: "m", description: "Pão" }] }))
      .toEqual({ tipo: "registrada", opcaoId: null });
  });
  it("comi com a refeição ligada: a opção vem da descrição dela", () => {
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "done", meal_id: "m" },
      registradas: [{ id: "x", description: "Ovos" }, { id: "m", description: "Iogurte" }],
    })).toEqual({ tipo: "comi", opcaoId: "i3" });
  });
  it("comi com a refeição ligada que não bate com opção nenhuma (o nutri editou)", () => {
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "done", meal_id: "m" },
      registradas: [{ id: "m", description: "Ovos mexidos" }],
    })).toEqual({ tipo: "comi", opcaoId: null });
  });
  it("comi sem refeição ligada, mas com registro à mão", () => {
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "done", meal_id: null },
      registradas: [{ id: "m", description: "Ovos" }],
    })).toEqual({ tipo: "comi", opcaoId: "i2" });
  });
  it("comi sem refeição: qual opção?", () => {
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "done", meal_id: null },
      registradas: [],
    })).toEqual({ tipo: "qual_opcao" });
    // A ligada que já foi apagada também.
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "done", meal_id: "sumiu" },
      registradas: [],
    })).toEqual({ tipo: "qual_opcao" });
  });
  it("não comi", () => {
    expect(estadoDaRefeicao({
      opcoes,
      resposta: { meal_type: "Café da manhã", status: "skipped", meal_id: null },
      registradas: [{ id: "m", description: "Ovos" }],
    })).toEqual({ tipo: "nao_comi" });
  });
});

describe("as entradas", () => {
  it("podeMarcar: hoje e os 6 dias antes", () => {
    expect(podeMarcar(HOJE, HOJE)).toBe(true);
    expect(podeMarcar("2026-10-22", HOJE)).toBe(true);
    expect(podeMarcar("2026-10-21", HOJE)).toBe(false);
    expect(podeMarcar("2026-10-29", HOJE)).toBe(false);
    expect(podeMarcar("2026-02-30", "2026-03-01")).toBe(false);
    expect(podeMarcar("lixo", HOJE)).toBe(false);
  });

  it("lerPedido aceita o pedido do botão e do app", () => {
    expect(lerPedido({ data: HOJE, refeicao: "Almoço", resposta: "comi" }))
      .toEqual({ data: HOJE, refeicao: "Almoço", resposta: "comi", itemId: null });
    expect(lerPedido({ data: HOJE, refeicao: " Café da manhã ", resposta: "comi", itemId: "i3" }))
      .toEqual({ data: HOJE, refeicao: "Café da manhã", resposta: "comi", itemId: "i3" });
    expect(lerPedido({ data: HOJE, refeicao: "Almoço", resposta: "desfazer", itemId: null }))
      .toEqual({ data: HOJE, refeicao: "Almoço", resposta: "desfazer", itemId: null });
  });

  it("lerPedido recusa o que não é pedido", () => {
    for (const corpo of [
      null,
      "texto",
      { data: HOJE, refeicao: "Almoço", resposta: "talvez" },
      { data: "2026-02-30", refeicao: "Almoço", resposta: "comi" },
      { data: "28/10/2026", refeicao: "Almoço", resposta: "comi" },
      { data: HOJE, refeicao: "   ", resposta: "comi" },
      { data: HOJE, refeicao: "x".repeat(201), resposta: "comi" },
      { data: HOJE, refeicao: "Almoço", resposta: "comi", itemId: 5 },
    ]) {
      expect(lerPedido(corpo)).toBeNull();
    }
  });

  it("dataDaDieta: passada vale; futura, inválida e vazia são hoje", () => {
    expect(dataDaDieta("2026-10-20", HOJE)).toBe("2026-10-20");
    expect(dataDaDieta(HOJE, HOJE)).toBe(HOJE);
    for (const p of ["2026-10-29", "2026-02-30", null, "", "lixo"]) expect(dataDaDieta(p, HOJE)).toBe(HOJE);
  });
});
