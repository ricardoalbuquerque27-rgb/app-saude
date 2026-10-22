import { describe, it, expect } from "vitest";
import { bancoEmMemoria } from "./bancoEmMemoria";
import {
  computeAdherence,
  estadosDaSemana,
  indexCompletions,
  mondayOf,
  setPlanCheck,
  weekDates,
  type Completion,
} from "./planCheckIn";

// Segunda = 0 no plano, como no resto do app.
const SEG = 0;
const QUA = 2;

/** 2026-10-05 é uma segunda-feira; 08 é a quinta da mesma semana. */
const SEMANA = [
  "2026-10-05", "2026-10-06", "2026-10-07",
  "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
];

function check(plan_id: string, date: string, status: string): Completion {
  return { id: `${plan_id}-${date}`, plan_id, date, status, workout_id: null };
}

describe("computeAdherence", () => {
  const plano = [
    { id: "p-seg", day_of_week: SEG },
    { id: "p-qua", day_of_week: QUA },
  ];

  it("não conta dias que ainda não chegaram", () => {
    // Na quinta, só segunda e quarta já venceram. Sem este corte, o
    // denominador incluiria a semana inteira e a adesão despencaria sem
    // que o paciente tivesse furado nada.
    const a = computeAdherence(plano, [], SEMANA, "2026-10-08");
    expect(a.previstas).toBe(2);
  });

  it("nunca passa de 100%", () => {
    // O painel chegou a exibir 114%. Confirmado só conta contra previsto,
    // então o teto é estrutural — e é isso que se está travando aqui.
    const todos = [
      check("p-seg", "2026-10-05", "done"),
      check("p-qua", "2026-10-07", "done"),
    ];
    const a = computeAdherence(plano, todos, SEMANA, "2026-10-08");
    expect(a.percentual).toBe(100);
    expect(a.confirmadas).toBeLessThanOrEqual(a.previstas);
  });

  it("separa quem faltou de quem não respondeu", () => {
    // A distinção é a razão de existir do check-in de três estados: furar
    // o treino e esquecer de marcar não são a mesma conversa.
    const a = computeAdherence(
      plano,
      [check("p-seg", "2026-10-05", "skipped")],
      SEMANA,
      "2026-10-08"
    );
    expect(a.previstas).toBe(2);
    expect(a.confirmadas).toBe(0);
    expect(a.faltas).toBe(1);
    expect(a.semResposta).toBe(1);
  });

  it("as três categorias sempre somam o previsto", () => {
    const a = computeAdherence(
      plano,
      [check("p-seg", "2026-10-05", "done")],
      SEMANA,
      "2026-10-08"
    );
    expect(a.confirmadas + a.faltas + a.semResposta).toBe(a.previstas);
  });

  it("devolve percentual nulo quando não há plano", () => {
    // Null, não zero: "nada previsto" não é "0% de adesão", e a tela
    // precisa poder esconder o indicador em vez de acusar o paciente.
    const a = computeAdherence([], [], SEMANA, "2026-10-08");
    expect(a.previstas).toBe(0);
    expect(a.percentual).toBeNull();
  });

  it("ignora check-in de outro dia que não o previsto", () => {
    const a = computeAdherence(
      plano,
      [check("p-seg", "2026-10-06", "done")], // terça, mas o plano é segunda
      SEMANA,
      "2026-10-08"
    );
    expect(a.confirmadas).toBe(0);
    expect(a.semResposta).toBe(2);
  });

  it("conta duas sessões no mesmo dia como duas", () => {
    const dois = [
      { id: "a", day_of_week: SEG },
      { id: "b", day_of_week: SEG },
    ];
    const a = computeAdherence(dois, [check("a", "2026-10-05", "done")], SEMANA, "2026-10-08");
    expect(a.previstas).toBe(2);
    expect(a.confirmadas).toBe(1);
  });
});

describe("indexCompletions", () => {
  it("descarta linha sem plano", () => {
    const orfa: Completion = {
      id: "x", plan_id: null, date: "2026-10-05", status: "done", workout_id: null,
    };
    expect(Object.keys(indexCompletions([orfa]))).toHaveLength(0);
  });
});

describe("mondayOf / weekDates", () => {
  it("a semana começa na segunda e tem sete dias", () => {
    expect(mondayOf("2026-10-08")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // domingo
    const dias = weekDates("2026-10-08");
    expect(dias).toHaveLength(7);
    expect(dias[0]).toBe("2026-10-05");
    expect(dias[6]).toBe("2026-10-11");
  });
});

describe("estadosDaSemana", () => {
  const HOJE = "2026-10-08"; // quinta
  const plano = [
    { id: "a", day_of_week: SEG, sport: "Musculação" },
    { id: "b", day_of_week: QUA, sport: "Corrida" },
    { id: "c", day_of_week: 1, sport: "Corrida" }, // terça
    { id: "d", day_of_week: 3, sport: "Corrida" }, // quinta, hoje
    { id: "e", day_of_week: 5, sport: "Corrida" }, // sábado
    { id: "f", day_of_week: 6, sport: "Descanso" },
  ];
  const checkins = [
    check("a", "2026-10-05", "done"),
    check("b", "2026-10-07", "skipped"),
  ];

  it("dá um estado por dia, de segunda a domingo", () => {
    // Cada estado responde a uma pergunta diferente do nutri: "treinou?",
    // "disse que não foi?", "nem respondeu?", "ainda vai chegar?".
    const semana = estadosDaSemana(plano, checkins, HOJE);
    expect(semana).toHaveLength(7);
    expect(semana[0].data).toBe("2026-10-05");
    expect(semana[6].data).toBe("2026-10-11");
    expect(semana.map((d) => d.estado)).toEqual([
      "feito", "sem-resposta", "falta", "hoje", "livre", "previsto", "descanso",
    ]);
  });

  it("hoje já respondido vira feito ou falta, não fica como hoje", () => {
    const feito = estadosDaSemana(plano, [check("d", HOJE, "done")], HOJE);
    expect(feito[3].estado).toBe("feito");
    const falta = estadosDaSemana(plano, [check("d", HOJE, "skipped")], HOJE);
    expect(falta[3].estado).toBe("falta");
  });

  it("num dia com duas sessões vale o pior estado", () => {
    // Furar uma das duas não pode ser escondido pela outra que foi feita.
    const dois = [
      { id: "x", day_of_week: SEG, sport: "Musculação" },
      { id: "y", day_of_week: SEG, sport: "Corrida" },
    ];
    const dia = (cs: Completion[]) => estadosDaSemana(dois, cs, HOJE)[0].estado;
    expect(dia([check("x", "2026-10-05", "done"), check("y", "2026-10-05", "skipped")])).toBe("falta");
    expect(dia([check("x", "2026-10-05", "done")])).toBe("sem-resposta");
    expect(dia([check("x", "2026-10-05", "skipped")])).toBe("falta");
    expect(dia([check("x", "2026-10-05", "done"), check("y", "2026-10-05", "done")])).toBe("feito");
  });

  it("check-in de dia futuro não muda o previsto", () => {
    // Registro com data futura não é treino feito; a mesma classe de erro
    // que já inflou a adesão para 114%.
    const semana = estadosDaSemana(plano, [check("e", "2026-10-10", "done")], HOJE);
    expect(semana[5].estado).toBe("previsto");
  });

  it("dia com descanso e treino conta como treino", () => {
    const misto = [
      { id: "r", day_of_week: SEG, sport: "Descanso ativo" },
      { id: "t", day_of_week: SEG, sport: "Musculação" },
    ];
    expect(estadosDaSemana(misto, [], HOJE)[0].estado).toBe("sem-resposta");
  });

  it("sem plano, a semana toda é livre", () => {
    const semana = estadosDaSemana([], [], HOJE);
    expect(semana.every((d) => d.estado === "livre")).toBe(true);
  });
});

describe("setPlanCheck: o treino que sai junto com a resposta", () => {
  const UID = "pac-a";
  const DIA = "2026-10-12";
  const sessao = { id: "p-seg", sport: "Musculação", title: "Treino A", day_of_week: 0 };
  const feito = (workoutId: string): Completion => ({
    id: "c-1", plan_id: "p-seg", date: DIA, status: "done", workout_id: workoutId,
  });
  const tabelas = (notas: string) => ({
    workouts: [{ id: "w-1", user_id: UID, date: DIA, name: "Treino A", notes: notas }],
    exercises: [{ id: "e-1", workout_id: "w-1", name: "Supino" }],
    plan_completions: [{ ...feito("w-1"), user_id: UID }],
  });

  it('desfazer o "Feito" de um treino ao vivo apaga a resposta e não o treino', async () => {
    // O "Feito" de uma sessão ao vivo aponta para o treino dela, com as
    // séries. Desfazer apagava esse treino como se fosse o que o "Fui" cria.
    const t: Record<string, any[]> = tabelas("Sessão ao vivo");
    const r = await setPlanCheck(bancoEmMemoria(t), UID, sessao, DIA, null, feito("w-1"));
    expect(r).toEqual({ error: null });
    expect(t.plan_completions).toEqual([]);
    expect(t.workouts.map((w) => w.id)).toEqual(["w-1"]);
  });

  it('trocar o "Feito" de um treino ao vivo por "não fui" mantém o treino', async () => {
    const t: Record<string, any[]> = tabelas("Sessão ao vivo");
    await setPlanCheck(bancoEmMemoria(t), UID, sessao, DIA, "skipped", feito("w-1"));
    expect(t.plan_completions).toHaveLength(1);
    expect(t.plan_completions[0]).toMatchObject({ status: "skipped", workout_id: null });
    expect(t.workouts.map((w) => w.id)).toEqual(["w-1"]);
  });

  it('desfazer o "Fui" apaga o treino que ele criou', async () => {
    const t: Record<string, any[]> = tabelas("Confirmado pelo plano semanal");
    await setPlanCheck(bancoEmMemoria(t), UID, sessao, DIA, null, feito("w-1"));
    expect(t.plan_completions).toEqual([]);
    expect(t.workouts).toEqual([]);
  });

  it('o "Fui" que falha não deixa no Histórico o treino que ele criou', async () => {
    // O treino é criado antes da resposta; com a resposta falhando, ele ficava
    // no Histórico e o dia seguia sem resposta.
    const t: Record<string, any[]> = { workouts: [], plan_completions: [] };
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "plan_completions" && c.op === "upsert" });
    const r = await setPlanCheck(banco, UID, sessao, DIA, "done", null);
    expect(r.error).toBeTruthy();
    expect(t.workouts).toEqual([]);
    expect(t.plan_completions).toEqual([]);
  });

  it("desfazer o treino que a Gaia concluiu também o apaga", async () => {
    const t: Record<string, any[]> = tabelas("Concluído pelo plano semanal");
    await setPlanCheck(bancoEmMemoria(t), UID, sessao, DIA, null, feito("w-1"));
    expect(t.workouts).toEqual([]);
  });
});
