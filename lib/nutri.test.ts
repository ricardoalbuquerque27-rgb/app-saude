import { describe, it, expect } from "vitest";
import {
  montarResumos,
  montarLinhaDoTempo,
  filaDeTriagem,
  mediasDaSemana,
  compararComMeta,
  textoVariacaoPeso,
  notaMedia,
  notaDasMedias,
  ultimoDesvioPorCampo,
  textoDaMeta,
  textoDoDesvio,
  separarDesvios,
  textoDoDesvioDoPlano,
  type DadosResumo,
  type DadosAtividade,
  type DailySeries,
  type ItemMeta,
} from "./nutri";

/** 2026-10-08 é uma quinta. A janela de 7 dias vai de 02 (sexta) a 08. */
const HOJE = "2026-10-08";
const A = "pac-a";
const B = "pac-b";

// Segunda = 0 no plano, como no resto do app.
const SEG = 0;
const QUA = 2;
const SEX = 4;

function dados(parcial: Partial<DadosResumo> = {}): DadosResumo {
  return {
    meals: [],
    workouts: [],
    logs: [],
    body: [],
    exams: [],
    treatments: [],
    plan: [],
    checks: [],
    desvios: [],
    ...parcial,
  };
}

function resumo(parcial: Partial<DadosResumo>, id = A) {
  return montarResumos(dados(parcial), [id], { [id]: "Ana" }, HOJE)[0];
}

/** Um paciente com um alerta de cada tipo, na ordem da escala. */
function cenarioDeAlertas(): Partial<DadosResumo> {
  return {
    treatments: [{ user_id: A, next_dose_date: "2026-10-01" }],
    desvios: [{ patient_id: A }],
    workouts: [{ user_id: A, date: "2026-10-05" }],
    exams: [{ user_id: A, status: "alterado" }],
    plan: [
      { id: "p-seg", user_id: A, day_of_week: SEG, sport: "Musculação" },
      { id: "p-ter", user_id: A, day_of_week: 1, sport: "Corrida" },
      { id: "p-qua", user_id: A, day_of_week: QUA, sport: "Corrida" },
    ],
    checks: [{ user_id: A, plan_id: "p-seg", date: "2026-10-05", status: "skipped" }],
  };
}

describe("montarResumos — registros", () => {
  it("conta cada dia uma vez, venha de qual fonte vier", () => {
    // Refeição e treino no mesmo dia são UM dia com registro, não dois.
    const r = resumo({
      meals: [{ user_id: A, date: "2026-10-08", calories: 400, protein_g: 20 }],
      workouts: [{ user_id: A, date: "2026-10-08" }],
      logs: [{ user_id: A, date: "2026-10-07", water_ml: 500 }],
      body: [{ user_id: A, date: "2026-10-05", weight_kg: 80 }],
    });
    expect(r.daysLogged7).toBe(3);
    expect(r.lastActivity).toBe("2026-10-08");
  });

  it("a janela de 7 dias não pega o oitavo dia nem data futura", () => {
    // Foi aqui que o painel mostrou "8 de 7 dias": a conta à mão com -7 e
    // sem teto. 01/10 é o oitavo dia; 09/10 é amanhã.
    const r = resumo({
      meals: [
        { user_id: A, date: "2026-10-01", calories: 0, protein_g: 0 },
        { user_id: A, date: "2026-10-02", calories: 0, protein_g: 0 },
        { user_id: A, date: "2026-10-09", calories: 0, protein_g: 0 },
      ],
    });
    expect(r.daysLogged7).toBe(1);
  });

  it("soma calorias, proteína e água só de hoje", () => {
    const r = resumo({
      meals: [
        { user_id: A, date: HOJE, calories: 500, protein_g: "30.5" },
        { user_id: A, date: HOJE, calories: 300, protein_g: 20 },
        { user_id: A, date: "2026-10-07", calories: 1000, protein_g: 80 },
      ],
      logs: [
        { user_id: A, date: HOJE, water_ml: 1500 },
        { user_id: A, date: "2026-10-07", water_ml: 2000 },
      ],
    });
    expect(r.caloriesToday).toBe(800);
    expect(r.proteinToday).toBe(50.5);
    expect(r.waterToday).toBe(1500);
  });

  it("os dados de um paciente não vazam para o outro", () => {
    // As consultas trazem todos os pacientes juntos (.in(user_id, ids)).
    const [a, b] = montarResumos(
      dados({
        meals: [{ user_id: A, date: HOJE, calories: 700, protein_g: 40 }],
        workouts: [{ user_id: A, date: HOJE }],
        plan: [{ id: "p-seg", user_id: A, day_of_week: SEG, sport: "Musculação" }],
        treatments: [{ user_id: A, next_dose_date: "2026-10-01" }],
        exams: [{ user_id: A, status: "alterado" }],
        desvios: [{ patient_id: A }],
      }),
      [A, B],
      {},
      HOJE
    );
    expect(a.caloriesToday).toBe(700);
    expect(a.workouts7).toBe(1);
    expect(a.planPrevistas7).toBe(1);
    expect(b.caloriesToday).toBe(0);
    expect(b.workouts7).toBe(0);
    expect(b.lastActivity).toBeNull();
    expect(b.planPrevistas7).toBe(0);
    expect(b.doseOverdue).toBe(false);
    expect(b.alteredExams).toBe(0);
    expect(b.desvios).toBe(0);
  });

  it("sem nome cadastrado, chama de Paciente", () => {
    const [r] = montarResumos(dados(), [A], {}, HOJE);
    expect(r.name).toBe("Paciente");
  });
});

describe("montarResumos — peso", () => {
  it("a variação é a última medida menos a primeira, arredondada", () => {
    // 78.4 - 80 dá -1.5999999999999943 em ponto flutuante.
    const r = resumo({
      body: [
        { user_id: A, date: "2026-09-10", weight_kg: 80 },
        { user_id: A, date: "2026-10-07", weight_kg: "78.4" },
      ],
    });
    expect(r.weightLast).toBe(78.4);
    expect(r.weightDelta30).toBe(-1.6);
  });

  it("com uma medida só, não inventa variação", () => {
    const r = resumo({
      body: [{ user_id: A, date: "2026-10-07", weight_kg: 78 }],
    });
    expect(r.weightLast).toBe(78);
    expect(r.weightDelta30).toBeNull();
  });

  it("30 dias são 30: a medida do 31º dia e a de data futura ficam fora", () => {
    // A consulta pegava `>= hoje-30` (31 dias) e sem teto. Com 08/10 como
    // hoje, a janela vai de 09/09 a 08/10.
    const r = resumo({
      body: [
        { user_id: A, date: "2026-09-08", weight_kg: 85 },
        { user_id: A, date: "2026-09-09", weight_kg: 80 },
        { user_id: A, date: "2026-10-07", weight_kg: 78.4 },
        { user_id: A, date: "2026-10-09", weight_kg: 70 },
      ],
    });
    expect(r.weightLast).toBe(78.4);
    expect(r.weightDelta30).toBe(-1.6);
  });
});

describe("montarResumos — plano de treino", () => {
  const plano = [
    { id: "p-seg", user_id: A, day_of_week: SEG, sport: "Musculação" },
    { id: "p-qua", user_id: A, day_of_week: QUA, sport: "Corrida" },
    { id: "p-sex", user_id: A, day_of_week: SEX, sport: "Descanso" },
  ];

  it("descanso não conta como treino previsto", () => {
    // Na janela de 02 a 08 caem uma segunda (05), uma quarta (07) e uma
    // sexta (02). A sexta é descanso: cobrar confirmação dela gerava
    // "sem resposta" para quem fez exatamente o que foi prescrito.
    const r = resumo({ plan: plano });
    expect(r.planPrevistas7).toBe(2);
  });

  it("separa quem faltou de quem não respondeu", () => {
    const r = resumo({
      plan: plano,
      checks: [{ user_id: A, plan_id: "p-seg", date: "2026-10-05", status: "skipped" }],
    });
    expect(r.planFaltas7).toBe(1);
    expect(r.planConfirmadas7).toBe(0);
    expect(r.planSemResposta7).toBe(1);
    expect(r.alerts).toContain("Faltou a 1 treino (7d)");
    // Um só sem resposta ainda não é motivo de alerta.
    expect(r.alerts.some((a) => a.includes("sem confirmação"))).toBe(false);
  });

  it("avisa a partir de dois treinos sem confirmação", () => {
    const r = resumo({ plan: plano });
    expect(r.alerts).toContain("2 treinos sem confirmação (7d)");
  });

  it("confirmado não vira alerta", () => {
    const r = resumo({
      plan: plano,
      checks: [
        { user_id: A, plan_id: "p-seg", date: "2026-10-05", status: "done" },
        { user_id: A, plan_id: "p-qua", date: "2026-10-07", status: "done" },
      ],
    });
    expect(r.planConfirmadas7).toBe(2);
    expect(r.planSemResposta7).toBe(0);
    expect(r.alerts.some((a) => a.includes("treino"))).toBe(false);
  });
});

describe("montarResumos — alertas", () => {
  it("avisa a partir de três dias parado", () => {
    const tres = resumo({ workouts: [{ user_id: A, date: "2026-10-05" }] });
    expect(tres.alerts).toContain("3 dias sem registrar");

    const dois = resumo({ workouts: [{ user_id: A, date: "2026-10-06" }] });
    expect(dois.alerts.some((a) => a.includes("sem registrar"))).toBe(false);
  });

  it("sem registro nenhum, diz que nunca registrou", () => {
    expect(resumo({}).alerts).toContain("Nunca registrou nada");
  });

  it("quem parou há mais de 30 dias não vira 'nunca registrou'", () => {
    // As consultas só trazem 30 dias. Sem o último registro anterior, quem
    // abandonou há 45 dias aparecia como quem nunca começou — e são
    // conversas diferentes para o nutricionista.
    const r = resumo({ ultimoRegistro: { [A]: "2026-08-24" } });
    expect(r.lastActivity).toBe("2026-08-24");
    expect(r.alerts).toContain("45 dias sem registrar");
    expect(r.alerts).not.toContain("Nunca registrou nada");
  });

  it("registro com data futura não conta como o último", () => {
    // Sem teto, uma refeição lançada em 12/10 fazia o paciente aparecer
    // como "Registrou hoje" e escondia que ele está parado desde 03/10.
    const r = resumo({
      meals: [
        { user_id: A, date: "2026-10-03", calories: 0, protein_g: 0 },
        { user_id: A, date: "2026-10-12", calories: 0, protein_g: 0 },
      ],
    });
    expect(r.lastActivity).toBe("2026-10-03");
    expect(r.alerts).toContain("5 dias sem registrar");
  });

  it("dose de ontem está atrasada; dose de hoje não", () => {
    const ontem = resumo({
      treatments: [{ user_id: A, next_dose_date: "2026-10-07" }],
    });
    expect(ontem.doseOverdue).toBe(true);
    expect(ontem.alerts).toContain("Dose atrasada");

    const hoje = resumo({ treatments: [{ user_id: A, next_dose_date: HOJE }] });
    expect(hoje.doseOverdue).toBe(false);
    expect(hoje.nextDose).toBe(HOJE);
  });

  it("exames fora da referência, no singular e no plural", () => {
    const um = resumo({ exams: [{ user_id: A, status: "alterado" }] });
    expect(um.alerts).toContain("1 exame fora da referência");

    const dois = resumo({
      exams: [
        { user_id: A, status: "alterado" },
        { user_id: A, status: "atencao" },
      ],
    });
    expect(dois.alerts).toContain("2 exames fora da referência");
  });

  it("os alertas saem do mais grave para o menos grave", () => {
    // A Início e a lista de pacientes mostram só os dois primeiros. Têm de
    // ser os dois que mais pedem o nutricionista: dose atrasada, depois a
    // mudança na prescrição (a única que ele mesmo resolve). Exame vai por
    // último porque o alerta dura 180 dias e não some quando o exame é
    // refeito.
    const r = resumo(cenarioDeAlertas());
    expect(r.alerts).toEqual([
      "Dose atrasada",
      "1 mudança na sua prescrição",
      "3 dias sem registrar",
      "Faltou a 1 treino (7d)",
      "2 treinos sem confirmação (7d)",
      "1 exame fora da referência",
    ]);
  });
});

describe("montarResumos — tipo dos alertas", () => {
  it("cada alerta leva o tipo que o identifica, na mesma ordem de `alerts`", () => {
    const r = resumo(cenarioDeAlertas());
    expect(r.alertas.map((a) => a.tipo)).toEqual([
      "dose", "prescricao", "parado", "treino", "treino", "exame",
    ]);
    expect(r.alertas.map((a) => a.texto)).toEqual(r.alerts);
    expect(r.alertas.map((a) => a.nivel)).toEqual([1, 2, 3, 4, 4, 5]);
  });

  it("paciente sem dado nenhum tem só o alerta de nunca registrou", () => {
    expect(resumo({}).alertas).toEqual([
      { tipo: "parado", nivel: 3, texto: "Nunca registrou nada" },
    ]);
  });
});

describe("filaDeTriagem", () => {
  /** Monta os resumos pelo caminho real e devolve a fila como lista de ids. */
  function fila(parcial: Partial<DadosResumo>, nomes: Record<string, string> = {}) {
    const ids = ["a", "b"];
    const resumos = montarResumos(dados(parcial), ids, nomes, HOJE);
    return filaDeTriagem(resumos, HOJE).map((r) => r.id);
  }
  const parado = (user_id: string, date: string) => ({ user_id, date });
  const ativoHoje = (user_id: string) => ({ user_id, date: HOJE });

  it("só entra quem tem alerta", () => {
    expect(
      fila({
        workouts: [ativoHoje("a"), parado("b", "2026-10-05")],
      })
    ).toEqual(["b"]);
  });

  it("dose atrasada passa à frente de quem tem mais alertas", () => {
    // Era a ordem antiga: "exame fora + 3 dias parado" ficava acima de
    // "dose atrasada" só por ter dois alertas.
    expect(
      fila({
        workouts: [parado("a", "2026-10-05"), ativoHoje("b")],
        exams: [{ user_id: "a", status: "alterado" }],
        treatments: [{ user_id: "b", next_dose_date: "2026-10-01" }],
      })
    ).toEqual(["b", "a"]);
  });

  it("segue a escala: dose, prescrição, parado, faltas, exame", () => {
    // Um alerta por paciente, na ordem inversa da esperada.
    const ids = ["exame", "faltou", "parado", "desvio", "dose"];
    const hoje = (user_id: string) => ({ user_id, date: HOJE });
    const resumos = montarResumos(
      dados({
        workouts: [
          hoje("exame"), hoje("faltou"), parado("parado", "2026-10-05"),
          hoje("desvio"), hoje("dose"),
        ],
        exams: [{ user_id: "exame", status: "alterado" }],
        plan: [{ id: "p-seg", user_id: "faltou", day_of_week: SEG, sport: "Corrida" }],
        checks: [{ user_id: "faltou", plan_id: "p-seg", date: "2026-10-05", status: "skipped" }],
        desvios: [{ patient_id: "desvio" }],
        treatments: [{ user_id: "dose", next_dose_date: "2026-10-01" }],
      }),
      ids,
      {},
      HOJE
    );
    expect(filaDeTriagem(resumos, HOJE).map((r) => r.id)).toEqual([
      "dose", "desvio", "parado", "faltou", "exame",
    ]);
  });

  it("mesma gravidade: mais alertas antes de mais dias parado", () => {
    expect(
      fila({
        workouts: [parado("a", "2026-09-28"), parado("b", "2026-10-05")],
        exams: [{ user_id: "b", status: "alterado" }],
      })
    ).toEqual(["b", "a"]);
  });

  it("mesma gravidade e mesmos alertas: quem está parado há mais tempo", () => {
    expect(
      fila({
        workouts: [parado("a", "2026-10-05"), parado("b", "2026-09-28")],
      })
    ).toEqual(["b", "a"]);
  });

  it("nunca registrou fica depois de quem parou há 40 dias", () => {
    // "Nunca registrou" pode ser alguém convidado ontem; quem registrava e
    // parou há 40 dias é o abandono que o nutricionista ainda pode reverter.
    expect(fila({ ultimoRegistro: { b: "2026-08-29" } })).toEqual(["b", "a"]);
  });

  it("empate completo: ordem alfabética, para a fila não embaralhar", () => {
    expect(
      fila(
        { workouts: [parado("a", "2026-10-05"), parado("b", "2026-10-05")] },
        { a: "Bruno", b: "Ana" }
      )
    ).toEqual(["b", "a"]);
  });
});

function atividade(parcial: Partial<DadosAtividade> = {}): DadosAtividade {
  return {
    meals: [],
    workouts: [],
    body: [],
    logs: [],
    exams: [],
    doses: [],
    effects: [],
    checkins: [],
    plan: [],
    ...parcial,
  };
}

describe("montarLinhaDoTempo", () => {
  it("rotula o check-in com o nome da sessão do plano", () => {
    const itens = montarLinhaDoTempo(
      atividade({
        plan: [
          { id: "p1", title: "Treino A", sport: "Musculação" },
          { id: "p2", title: null, sport: "Corrida" },
        ],
        checkins: [
          { date: "2026-10-07", created_at: "2026-10-07T20:00:00Z", status: "done", plan_id: "p1" },
          { date: "2026-10-06", created_at: "2026-10-06T20:00:00Z", status: "skipped", plan_id: "p2" },
          { date: "2026-10-05", created_at: "2026-10-05T20:00:00Z", status: "done", plan_id: "apagado" },
        ],
      }),
      HOJE
    );
    expect(itens.map((i) => i.title)).toEqual([
      "Confirmou o Treino A",
      "Avisou que não foi ao Corrida",
      "Confirmou o treino do plano",
    ]);
  });

  it("registro do dia vazio não vira item; água sai em litros", () => {
    const itens = montarLinhaDoTempo(
      atividade({
        logs: [
          { date: "2026-10-07", created_at: "2026-10-07T22:00:00Z", water_ml: 1750 },
          { date: "2026-10-06", created_at: "2026-10-06T22:00:00Z" },
        ],
      }),
      HOJE
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].detail).toBe("1.8 L de água");
  });

  it("registro retroativo fica no dia a que se refere", () => {
    // Lançar na quinta o almoço de terça é comum (o seletor de data deixa).
    // Ordenando só pela hora em que foi lançado, o almoço de terça subia
    // para o topo e a tela, que agrupa itens seguidos do mesmo dia, mostrava
    // "06/10" acima de "08/10" e o cabeçalho de um dia duas vezes.
    const itens = montarLinhaDoTempo(
      atividade({
        meals: [
          { date: "2026-10-06", created_at: "2026-10-08T15:00:00Z", description: "Almoço de terça" },
          { date: "2026-10-07", created_at: "2026-10-07T12:00:00Z", description: "Almoço de quarta" },
        ],
        workouts: [
          { date: "2026-10-08", created_at: "2026-10-08T11:00:00Z", name: "Corrida" },
        ],
      }),
      HOJE
    );
    expect(itens.map((i) => i.date)).toEqual([
      "2026-10-08",
      "2026-10-07",
      "2026-10-06",
    ]);
  });

  it("dentro do mesmo dia, o lançado por último vem primeiro", () => {
    const itens = montarLinhaDoTempo(
      atividade({
        meals: [
          { date: HOJE, created_at: "2026-10-08T11:00:00Z", description: "Café" },
          { date: HOJE, created_at: "2026-10-08T23:30:00Z", description: "Jantar" },
        ],
      }),
      HOJE
    );
    expect(itens.map((i) => i.title)).toEqual(["Jantar", "Café"]);
  });

  it("30 dias são 30: nem o 31º nem data futura", () => {
    // De 09/09 a 08/10 são 30 dias. 08/09 é o 31º; 09/10 é amanhã — e,
    // ordenado por data, um registro futuro iria parar no topo.
    const itens = montarLinhaDoTempo(
      atividade({
        workouts: [
          { date: "2026-10-09", created_at: "2026-10-01T10:00:00Z", name: "Futuro" },
          { date: "2026-09-09", created_at: "2026-09-09T10:00:00Z", name: "Primeiro dia" },
          { date: "2026-09-08", created_at: "2026-09-08T10:00:00Z", name: "Fora" },
        ],
      }),
      HOJE,
      30
    );
    expect(itens.map((i) => i.title)).toEqual(["Primeiro dia"]);
  });

  it("o limite corta os mais antigos", () => {
    const itens = montarLinhaDoTempo(
      atividade({
        workouts: ["2026-10-05", "2026-10-08", "2026-10-06"].map((date) => ({
          date,
          created_at: date + "T10:00:00Z",
          name: date,
        })),
      }),
      HOJE,
      30,
      2
    );
    expect(itens.map((i) => i.date)).toEqual(["2026-10-08", "2026-10-06"]);
  });
});

/** Um dia da série do detalhe do paciente, só com o que a média usa. */
function dia(date: string, calories: number, protein: number, water: number): DailySeries {
  return { date, calories, protein, water, sleep: null, workouts: 0, weight: null };
}

describe("mediasDaSemana", () => {
  it("média só dos dias com registro daquele item", () => {
    const m = mediasDaSemana(
      [dia("2026-10-08", 2000, 90, 2000), dia("2026-10-07", 0, 0, 0), dia("2026-10-06", 1801, 80, 0)],
      HOJE
    );
    expect(m.calorias).toEqual({ valor: 1901, dias: 2 }); // 1900,5 arredonda
    expect(m.proteina).toEqual({ valor: 85, dias: 2 });
    expect(m.agua).toEqual({ valor: 2000, dias: 1 });
  });
  it("o oitavo dia e o futuro ficam fora", () => {
    const m = mediasDaSemana(
      [dia("2026-10-01", 3000, 200, 3000), dia("2026-10-09", 3000, 200, 3000), dia("2026-10-02", 1500, 60, 1500)],
      HOJE
    );
    expect(m.calorias).toEqual({ valor: 1500, dias: 1 });
  });
  it("sem registro, valor nulo", () => {
    expect(mediasDaSemana([], HOJE).agua).toEqual({ valor: null, dias: 0 });
  });
});

describe("compararComMeta", () => {
  it.each([
    ["calorias", 2050, 1800, { delta: 14, status: "atencao" }],
    ["calorias", 1980, 1800, { delta: 10, status: "ok" }],
    ["calorias", 1600, 1800, { delta: -11, status: "atencao" }],
    ["proteina", 92, 110, { delta: -16, status: "atencao" }],
    ["proteina", 130, 110, { delta: 18, status: "ok" }],
    ["agua", 1900, 2500, { delta: -24, status: "atencao" }],
    ["agua", 2300, 2500, { delta: -8, status: "ok" }],
    ["calorias", 2000, null, { delta: null, status: "sem-meta" }],
    ["calorias", null, 1800, { delta: null, status: "sem-dado" }],
  ])("compararComMeta(%s, %s, %s)", (item, real, meta, esperado) => {
    expect(compararComMeta(item as ItemMeta, real, meta)).toEqual(esperado);
  });
  it("meta zero conta como sem meta", () => {
    expect(compararComMeta("calorias", 2000, 0)).toEqual({ delta: null, status: "sem-meta" });
  });
});

describe("textoVariacaoPeso", () => {
  it("sinal de menos de verdade, vírgula e uma casa", () => {
    // "−" (U+2212), como o Δ da tabela: o hífen é mais curto que o "+" e
    // desalinha a coluna.
    expect(textoVariacaoPeso(-1.4)).toBe("−1,4 kg");
    expect(textoVariacaoPeso(0.6)).toBe("+0,6 kg");
    expect(textoVariacaoPeso(2)).toBe("+2,0 kg");
  });
  it("zero não leva sinal, nem o zero negativo da subtração", () => {
    expect(textoVariacaoPeso(0)).toBe("0,0 kg");
    expect(textoVariacaoPeso(-0)).toBe("0,0 kg");
    expect(textoVariacaoPeso(-0.04)).toBe("0,0 kg");
  });
  it("sem variação medida, traço", () => {
    expect(textoVariacaoPeso(null)).toBe("—");
    expect(textoVariacaoPeso(Number.NaN)).toBe("—");
  });
});

describe("notaMedia", () => {
  it("diz quantos dias entraram na média, no singular e no plural", () => {
    expect(notaMedia(5)).toBe("média de 5 dias com registro");
    expect(notaMedia(1)).toBe("média de 1 dia com registro");
  });
  it("sem dia com registro, não fala em média", () => {
    expect(notaMedia(0)).toBe("sem registro nos últimos 7 dias");
  });
});

describe("notaDasMedias", () => {
  const m = (c: number, p: number, a: number) => ({
    calorias: { valor: c ? 1 : null, dias: c },
    proteina: { valor: p ? 1 : null, dias: p },
    agua: { valor: a ? 1 : null, dias: a },
  });
  it("mesmo número de dias nos três itens: uma frase só", () => {
    expect(notaDasMedias(m(5, 5, 5))).toBe("Real: média de 5 dias com registro.");
  });
  it("números diferentes: diz o de cada item", () => {
    expect(notaDasMedias(m(5, 5, 6))).toBe(
      "Real: média dos dias com registro nos últimos 7 dias — calorias em 5, proteína em 5, água em 6."
    );
  });
  it("nenhum registro nos três: sem média", () => {
    expect(notaDasMedias(m(0, 0, 0))).toBe("Sem registro nos últimos 7 dias.");
  });
});

describe("ultimoDesvioPorCampo", () => {
  const d = (id: string, field: string, created_at: string) => ({
    id,
    field,
    created_at,
  });
  it("de dois avisos do mesmo campo, fica o mais recente", () => {
    // Paciente que mudou 1800 → 2000 → 2200 tem dois avisos abertos. "Está
    // usando 2000" seria mentira: quem vale é o último.
    const r = ultimoDesvioPorCampo([
      d("velho", "daily_calorie_goal", "2026-10-01T10:00:00Z"),
      d("novo", "daily_calorie_goal", "2026-10-05T10:00:00Z"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["novo"]);
  });
  it("campos diferentes ficam todos, do mais recente para o mais antigo", () => {
    const r = ultimoDesvioPorCampo([
      d("agua", "daily_water_goal_ml", "2026-10-02T10:00:00Z"),
      d("kcal", "daily_calorie_goal", "2026-10-06T10:00:00Z"),
      d("kcal-velho", "daily_calorie_goal", "2026-10-01T10:00:00Z"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["kcal", "agua"]);
  });
  it("sem aviso, lista vazia", () => {
    expect(ultimoDesvioPorCampo([])).toEqual([]);
  });
});

describe("textoDaMeta", () => {
  it("cada meta na unidade em que a tela a mostra", () => {
    expect(textoDaMeta("daily_calorie_goal", 1800)).toBe("1.800 kcal");
    expect(textoDaMeta("protein_goal_g", 109.6)).toBe("110 g");
    // Água entra em ml e sai em litros, como na tabela real × meta.
    expect(textoDaMeta("daily_water_goal_ml", 2500)).toBe("2,5 L");
    expect(textoDaMeta("daily_water_goal_ml", 2000)).toBe("2,0 L");
    expect(textoDaMeta("weight_goal_kg", 62.5)).toBe("62,5 kg");
    expect(textoDaMeta("weight_goal_kg", 62)).toBe("62 kg");
  });
});

describe("textoDoDesvio", () => {
  const d = (field: string, current_value: string | null) => ({ field, current_value });
  it("diz o que o paciente está usando, na unidade da tabela", () => {
    expect(textoDoDesvio(d("daily_calorie_goal", "2200"), "F")).toBe(
      "ela está usando 2.200 kcal"
    );
    expect(textoDoDesvio(d("daily_water_goal_ml", "2500"), "M")).toBe(
      "ele está usando 2,5 L"
    );
  });
  it("sem sexo no perfil, não adivinha o pronome", () => {
    expect(textoDoDesvio(d("protein_goal_g", "95"), null)).toBe(
      "o paciente está usando 95 g"
    );
  });
  it("meta apagada pelo paciente", () => {
    expect(textoDoDesvio(d("weight_goal_kg", null), "F")).toBe("ela está sem meta");
    expect(textoDoDesvio(d("weight_goal_kg", ""), "F")).toBe("ela está sem meta");
  });
  it("valor que não é número sai como veio", () => {
    expect(textoDoDesvio(d("daily_calorie_goal", "muito"), "F")).toBe(
      "ela está usando muito"
    );
  });
});

describe("separarDesvios", () => {
  // Uma consulta só traz os avisos abertos do paciente; a Alimentação e a
  // fila olham os de META, o Treino e a fila os do PLANO. No banco, o gatilho
  // de metas grava `kind = 'meta'` com a coluna no `field`, e o do plano de
  // treino grava `kind = 'plano'` com o NOME DA SESSÃO no `field`.
  const d = (id: string, field: string, kind?: string) => ({
    id,
    field,
    ...(kind ? { kind } : {}),
    prescribed: null,
    current_value: null,
    created_at: "2026-10-05T10:00:00Z",
  });
  it("pelo kind: 'meta' de um lado, 'plano' do outro", () => {
    const r = separarDesvios([
      d("kcal", "daily_calorie_goal", "meta"),
      d("treino-b", "Treino B — Inferiores", "plano"),
      d("agua", "daily_water_goal_ml", "meta"),
    ]);
    expect(r.meta.map((x) => x.id)).toEqual(["kcal", "agua"]);
    expect(r.plano.map((x) => x.id)).toEqual(["treino-b"]);
  });
  it("o kind decide, mesmo com uma sessão que tenha nome de coluna de meta", () => {
    const r = separarDesvios([d("x", "daily_calorie_goal", "plano")]);
    expect(r.meta).toEqual([]);
    expect(r.plano.map((x) => x.id)).toEqual(["x"]);
  });
  it("sem kind, vale o campo: os quatro de meta de um lado, o resto do outro", () => {
    const r = separarDesvios([
      d("kcal", "daily_calorie_goal"),
      d("sessao", "Corrida leve"),
      d("prot", "protein_goal_g"),
      d("peso", "weight_goal_kg"),
    ]);
    expect(r.meta.map((x) => x.id)).toEqual(["kcal", "prot", "peso"]);
    expect(r.plano.map((x) => x.id)).toEqual(["sessao"]);
  });
  it("sem aviso, os dois lados vazios", () => {
    expect(separarDesvios([])).toEqual({ meta: [], plano: [] });
  });
});

describe("textoDoDesvioDoPlano", () => {
  // Como o gatilho grava: `field` e `prescribed` com o nome da sessão;
  // `current_value` é 'removido pelo paciente' quando ela sai do plano, ou o
  // nome novo quando ela muda.
  const d = (current_value: string | null, prescribed: string | null = "Treino B — Inferiores") => ({
    field: "Treino B — Inferiores",
    prescribed,
    current_value,
  });
  it("sessão que saiu do plano", () => {
    expect(textoDoDesvioDoPlano(d("removido pelo paciente"), "F")).toEqual({
      sessao: "Treino B — Inferiores",
      mudanca: "ela tirou do plano",
    });
  });
  it("sessão trocada por outra", () => {
    expect(textoDoDesvioDoPlano(d("Corrida"), "M")).toEqual({
      sessao: "Treino B — Inferiores",
      mudanca: "ele trocou por Corrida",
    });
  });
  it("mesmo nome depois da mudança (outro dia, por exemplo): não diz que trocou", () => {
    expect(textoDoDesvioDoPlano(d("Treino B — Inferiores"), null).mudanca).toBe(
      "o paciente mudou esta sessão"
    );
  });
  it("sem valor atual, uma frase neutra", () => {
    expect(textoDoDesvioDoPlano(d(null), "F").mudanca).toBe("ela mudou esta sessão");
    expect(textoDoDesvioDoPlano(d(""), "F").mudanca).toBe("ela mudou esta sessão");
  });
  it("sem o prescrito, o nome vem do campo", () => {
    expect(textoDoDesvioDoPlano(d("removido pelo paciente", null), "F").sessao).toBe(
      "Treino B — Inferiores"
    );
  });
});
