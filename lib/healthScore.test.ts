import { describe, it, expect } from "vitest";
import { computeHealthScore, type ScoreInput } from "./healthScore";

/** Dia sem nenhum registro: tudo nulo ou zero, com a meta de água padrão. */
const DIA_VAZIO: ScoreInput = {
  sleepHours: null,
  trainedToday: false,
  workoutsWeek: 0,
  mealsLoggedToday: 0,
  proteinToday: 0,
  proteinGoal: null,
  caloriesToday: 0,
  calorieGoal: null,
  waterToday: 0,
  waterGoal: 2500,
  mood: null,
  energy: null,
};

/** Dia com um pouco de cada coisa registrada. */
const DIA_PARCIAL: ScoreInput = {
  sleepHours: 7,
  trainedToday: false,
  workoutsWeek: 1,
  mealsLoggedToday: 2,
  proteinToday: 60,
  proteinGoal: 110,
  caloriesToday: 900,
  calorieGoal: 1800,
  waterToday: 1200,
  waterGoal: 2500,
  mood: "bem",
  energy: null,
};

const valores = (i: ScoreInput) =>
  Object.fromEntries(computeHealthScore(i).pillars.map((p) => [p.key, p.value]));

// Caracterização: estes valores foram fixados ANTES de mexer em
// healthScore.ts (o módulo não tinha teste), para provar que marcar o pilar
// "sem registro" e tirar os emojis das dicas não muda nenhuma conta.
describe("computeHealthScore: o que a conta dá hoje", () => {
  it("dia vazio", () => {
    const r = computeHealthScore(DIA_VAZIO);
    expect(r.score).toBe(35);
    expect(r.label).toBe("Pode melhorar");
    expect(valores(DIA_VAZIO)).toEqual({ sono: 60, movimento: 15, nutricao: 40, bemestar: 24 });
  });

  it("dia com registros parciais", () => {
    const r = computeHealthScore(DIA_PARCIAL);
    expect(r.score).toBe(73);
    expect(r.label).toBe("Bom");
    expect(valores(DIA_PARCIAL)).toEqual({ sono: 100, movimento: 40, nutricao: 82, bemestar: 69 });
  });
});

// Spec "Início (paciente)", item 5, "O pilar sem registro diz que é padrão":
// sono sem horas conta 60, nutrição sem refeição conta 40 e o bem-estar
// vazio conta 24, e a tela precisa dizer que isso não é medida.
describe("computeHealthScore: pilar sem registro", () => {
  const pilares = (i: ScoreInput) =>
    Object.fromEntries(computeHealthScore(i).pillars.map((p) => [p.key, p]));

  it("dia vazio: sono, nutrição e bem-estar sem registro; movimento nunca", () => {
    const p = pilares(DIA_VAZIO);
    expect(p.sono.semRegistro).toBe(true);
    expect(p.nutricao.semRegistro).toBe(true);
    expect(p.bemestar.semRegistro).toBe(true);
    // Zero treino na semana é dado, não ausência dele.
    expect(p.movimento.semRegistro).toBe(false);
    // 60% de água zero, mais 40% de 60 de humor padrão.
    expect(p.bemestar.value).toBe(24);
  });

  it("dia com registros: nenhum dos quatro pilares é sem registro", () => {
    const p = pilares(DIA_PARCIAL);
    expect(Object.values(p).map((x) => x.semRegistro)).toEqual([false, false, false, false]);
  });

  it("movimento não é sem registro nem com treino zerado, nem com treino", () => {
    expect(pilares({ ...DIA_VAZIO, workoutsWeek: 0 }).movimento.semRegistro).toBe(false);
    expect(pilares({ ...DIA_VAZIO, workoutsWeek: 3, trainedToday: true }).movimento.semRegistro).toBe(
      false
    );
  });

  it("sono: qualquer horas informadas, até zero, é registro", () => {
    expect(pilares({ ...DIA_VAZIO, sleepHours: 0 }).sono.semRegistro).toBe(false);
    expect(pilares({ ...DIA_VAZIO, sleepHours: 6.5 }).sono.semRegistro).toBe(false);
  });

  it("nutrição: uma refeição já basta", () => {
    expect(pilares({ ...DIA_VAZIO, mealsLoggedToday: 1 }).nutricao.semRegistro).toBe(false);
  });

  it("bem-estar: basta água, humor ou energia", () => {
    expect(pilares({ ...DIA_VAZIO, waterToday: 250 }).bemestar.semRegistro).toBe(false);
    expect(pilares({ ...DIA_VAZIO, mood: "neutro" }).bemestar.semRegistro).toBe(false);
    expect(pilares({ ...DIA_VAZIO, energy: 3 }).bemestar.semRegistro).toBe(false);
  });
});

// Os emojis das dicas saem (spec, item 5): a Início não tem emoji, como o 👋
// da saudação saiu.
describe("computeHealthScore: dicas sem emoji", () => {
  const ENTRADAS: [string, ScoreInput][] = [
    ["dia vazio", DIA_VAZIO],
    ["dia parcial", DIA_PARCIAL],
    // "Que tal treinar hoje?" só sai sem treino hoje e com pouco treino na semana.
    ["pouco treino", { ...DIA_PARCIAL, workoutsWeek: 1, trainedToday: false }],
    // "Meta de proteína batida" só sai com a meta cumprida.
    ["proteína batida", { ...DIA_PARCIAL, proteinToday: 120 }],
    ["treinou hoje, sem meta de proteína", { ...DIA_PARCIAL, trainedToday: true, proteinGoal: null }],
    [
      "dia puxado",
      {
        ...DIA_VAZIO,
        sleepHours: 4,
        mealsLoggedToday: 1,
        waterToday: 2500,
        mood: "mal",
        energy: 1,
      },
    ],
  ];

  // `new RegExp` e não o literal /\p{Extended_Pictographic}/u: o tsconfig mira
  // es5, e o tsc recusa a flag `u` em literal (o Node a aceita).
  const EMOJI = new RegExp("\\p{Extended_Pictographic}", "u");

  it("a expressão pega os emojis que saíram (senão o teste abaixo passaria à toa)", () => {
    expect(EMOJI.test("Que tal treinar hoje? 🌱")).toBe(true);
    expect(EMOJI.test("Meta de proteína batida! 💪")).toBe(true);
    expect(EMOJI.test("Meta de proteína batida.")).toBe(false);
  });

  it.each(ENTRADAS)("%s", (_nome, entrada) => {
    const r = computeHealthScore(entrada);
    for (const p of r.pillars) expect(p.tip).not.toMatch(EMOJI);
    expect(r.topTip).not.toMatch(EMOJI);
  });

  it("os dois textos que tinham emoji seguem dizendo o mesmo", () => {
    const treinar = computeHealthScore(DIA_VAZIO).pillars.find((p) => p.key === "movimento");
    expect(treinar?.tip).toBe("Que tal treinar hoje?");
    const proteina = computeHealthScore({ ...DIA_PARCIAL, proteinToday: 120 }).pillars.find(
      (p) => p.key === "nutricao"
    );
    expect(proteina?.tip).toBe("Meta de proteína batida.");
  });
});

// A Início esconde a dica principal quando a sugestão de proteína aparece e o
// pilar mais fraco é a Nutrição. Ela achava esse pilar comparando o texto da
// dica (`p.tip === topTip`); agora a conta diz qual pilar a dica é.
describe("computeHealthScore: topPilar", () => {
  it("é o pilar mais fraco, o mesmo de onde sai a topTip", () => {
    for (const entrada of [DIA_VAZIO, DIA_PARCIAL, { ...DIA_PARCIAL, proteinToday: 120 }]) {
      const r = computeHealthScore(entrada);
      const menor = Math.min(...r.pillars.map((p) => p.value));
      const pilar = r.pillars.find((p) => p.key === r.topPilar);
      expect(pilar?.value).toBe(menor);
      expect(pilar?.tip).toBe(r.topTip);
    }
  });

  it("dia vazio: o movimento (15) é o mais fraco", () => {
    expect(computeHealthScore(DIA_VAZIO).topPilar).toBe("movimento");
  });

  it("sem refeição, com o resto em dia: a nutrição", () => {
    expect(
      computeHealthScore({ ...DIA_PARCIAL, mealsLoggedToday: 0, workoutsWeek: 4, waterToday: 2500 }).topPilar
    ).toBe("nutricao");
  });

  it("empate: vale o primeiro na ordem dos pilares, como a topTip", () => {
    // Sono sem registro (60) e bem-estar 60 (água 1500 de 2500 = 60%, humor
    // neutro 60); movimento e nutrição em 100.
    const r = computeHealthScore({
      ...DIA_VAZIO, sleepHours: null, workoutsWeek: 4, mealsLoggedToday: 3, proteinGoal: null,
      waterToday: 1500, mood: "neutro",
    });
    expect(r.pillars.find((p) => p.key === "sono")?.value).toBe(60);
    expect(r.pillars.find((p) => p.key === "bemestar")?.value).toBe(60);
    expect(r.topPilar).toBe("sono");
  });
});
