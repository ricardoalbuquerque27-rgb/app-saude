import { describe, it, expect } from "vitest";
import { limitesDaJanela } from "./date";
import {
  inicioDoPeriodo,
  semanasDePeso,
  pontosDaConsulta,
  serieDeMedida,
  tituloDoPeso,
  temGraficoDePeso,
  escalaDoPeso,
  descricaoDoPeso,
  descricaoDaMedida,
  variacaoDaMedida,
  diasEntre,
  marcasDeMes,
  marcasDoEixo,
  pesoInicialDoPeriodo,
  progressoDaMeta,
  type LinhaDoCorpo,
  type SemanaDePeso,
  type PontoDeConsulta,
  type PontoDeMedida,
} from "./evolucao";

/** Uma pesagem de casa; `hora` em UTC, só para desempatar o dia. */
function casa(
  date: string,
  weight: number | string | null,
  hora = "12:00:00",
  extra: Partial<LinhaDoCorpo> = {}
): LinhaDoCorpo {
  return {
    date,
    weight_kg: weight,
    waist_cm: null,
    body_fat_pct: null,
    measured_by: null,
    created_at: `${date}T${hora}Z`,
    ...extra,
  };
}

/** Uma medida tirada na consulta (`measured_by` é o nutricionista). */
function consulta(
  date: string,
  campos: Partial<Pick<LinhaDoCorpo, "weight_kg" | "waist_cm" | "body_fat_pct">>,
  hora = "13:00:00"
): LinhaDoCorpo {
  return {
    date,
    weight_kg: null,
    waist_cm: null,
    body_fat_pct: null,
    ...campos,
    measured_by: "nutri-1",
    created_at: `${date}T${hora}Z`,
  };
}

function semana(
  inicio: string,
  fim: string,
  media: number | null,
  extra: Partial<SemanaDePeso> = {}
): SemanaDePeso {
  return {
    inicio,
    fim,
    media,
    dias: media == null ? 0 : 1,
    menor: media,
    maior: media,
    emCurso: false,
    ...extra,
  };
}

describe("inicioDoPeriodo", () => {
  const hoje = "2026-10-14";

  it("é o dia em que o paciente aceitou o convite", () => {
    expect(
      inicioDoPeriodo({ accepted_at: "2026-05-12T13:00:00Z", created_at: "2026-05-01T10:00:00Z" }, hoje)
    ).toBe("2026-05-12");
  });

  it("sem accepted_at, usa o created_at do vínculo", () => {
    expect(inicioDoPeriodo({ accepted_at: null, created_at: "2026-06-03T15:00:00Z" }, hoje)).toBe(
      "2026-06-03"
    );
  });

  it("conta o dia de São Paulo, não o de Greenwich", () => {
    // 01:30 UTC de 13/05 ainda é 22:30 de 12/05 em São Paulo. `slice(0, 10)`
    // daria o dia 13 e a primeira pesagem do paciente ficaria fora do período.
    expect(inicioDoPeriodo({ accepted_at: "2026-05-13T01:30:00Z", created_at: "2026-05-01T10:00:00Z" }, hoje)).toBe(
      "2026-05-12"
    );
  });

  it("nunca começa antes do teto de 12 meses", () => {
    const piso = limitesDaJanela(hoje, 365).desde;
    expect(inicioDoPeriodo({ accepted_at: "2025-01-10T12:00:00Z", created_at: "2025-01-01T12:00:00Z" }, hoje)).toBe(
      piso
    );
  });

  it("um acompanhamento que começou exatamente no piso fica no piso", () => {
    const piso = limitesDaJanela(hoje, 365).desde;
    expect(inicioDoPeriodo({ accepted_at: `${piso}T15:00:00Z`, created_at: `${piso}T15:00:00Z` }, hoje)).toBe(piso);
  });

  it("um vínculo que começa hoje começa hoje", () => {
    expect(inicioDoPeriodo({ accepted_at: "2026-10-14T15:00:00Z", created_at: "2026-10-14T15:00:00Z" }, hoje)).toBe(
      hoje
    );
  });

  it("um início no futuro não inverte o período: vale hoje", () => {
    expect(inicioDoPeriodo({ accepted_at: "2026-10-20T15:00:00Z", created_at: "2026-10-20T15:00:00Z" }, hoje)).toBe(
      hoje
    );
  });
});

describe("semanasDePeso — a semana vai de segunda a domingo", () => {
  const desde = "2026-09-01";
  const ate = "2027-01-10";

  function semanaDe(data: string) {
    const achadas = semanasDePeso([casa(data, 70)], desde, ate).filter((s) => s.media != null);
    expect(achadas).toHaveLength(1);
    return achadas[0].inicio;
  }

  it("o domingo fecha a semana de segunda", () => {
    expect(semanaDe("2026-10-18")).toBe("2026-10-12");
  });

  it("a segunda abre a semana seguinte", () => {
    expect(semanaDe("2026-10-19")).toBe("2026-10-19");
  });

  it("a virada do ano não quebra a semana: sexta 01/01/2027 é da semana de 28/12", () => {
    expect(semanaDe("2027-01-01")).toBe("2026-12-28");
  });

  it("a semana tem sete dias (domingo é o fim)", () => {
    const s = semanasDePeso([casa("2026-10-14", 70)], desde, ate).find((x) => x.media != null)!;
    expect(s.inicio).toBe("2026-10-12");
    expect(s.fim).toBe("2026-10-18");
  });
});

describe("semanasDePeso — o período", () => {
  it("devolve uma semana por segunda-feira do período, em ordem, inclusive as vazias", () => {
    // De segunda 05/10 a quarta 14/10: duas semanas.
    const r = semanasDePeso([casa("2026-10-06", 70), casa("2026-10-14", 69)], "2026-10-05", "2026-10-14");
    expect(r.map((s) => s.inicio)).toEqual(["2026-10-05", "2026-10-12"]);
    // Do meio de uma semana ao meio de outra: três, com a vazia no meio.
    const r2 = semanasDePeso([casa("2026-09-30", 70), casa("2026-10-14", 69)], "2026-09-28", "2026-10-14");
    expect(r2.map((s) => s.inicio)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
  });

  it("uma semana sem pesagem no meio fica sem ponto (media nula, 0 dias), não é pulada nem inventada", () => {
    const r = semanasDePeso([casa("2026-09-30", 70), casa("2026-10-14", 69)], "2026-09-28", "2026-10-14");
    expect(r[1]).toMatchObject({ inicio: "2026-10-05", media: null, dias: 0, menor: null, maior: null });
  });

  it("a primeira semana começa no início do período e a última termina em `ate`", () => {
    // O período começa numa terça e termina numa quarta: a dica não deve
    // prometer dias antes do acompanhamento nem dias que ainda não vieram
    // (o aria-label diria "a 18/10" numa quarta, 14/10).
    const r = semanasDePeso([casa("2026-05-12", 74.4)], "2026-05-12", "2026-10-14");
    expect(r[0].inicio).toBe("2026-05-12");
    expect(r[0].fim).toBe("2026-05-17");
    expect(r[r.length - 1].inicio).toBe("2026-10-12");
    expect(r[r.length - 1].fim).toBe("2026-10-14");
  });

  it("só a semana de hoje vem com emCurso", () => {
    const r = semanasDePeso([casa("2026-10-06", 70)], "2026-10-05", "2026-10-14");
    expect(r.map((s) => s.emCurso)).toEqual([false, true]);
  });

  it("hoje no domingo: a semana ainda está em curso", () => {
    const r = semanasDePeso([], "2026-10-12", "2026-10-18");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ inicio: "2026-10-12", fim: "2026-10-18", emCurso: true });
  });

  it("pesagem com data futura ou anterior ao período fica fora", () => {
    // Sem teto, o registro lançado com data de amanhã entrava na média.
    const r = semanasDePeso(
      [casa("2026-10-04", 90), casa("2026-10-13", 70), casa("2026-10-15", 99)],
      "2026-10-05",
      "2026-10-14"
    );
    const pesos = r.filter((s) => s.media != null);
    expect(pesos).toHaveLength(1);
    expect(pesos[0]).toMatchObject({ media: 70, dias: 1 });
  });

  it("período invertido não devolve semana", () => {
    expect(semanasDePeso([casa("2026-10-13", 70)], "2026-10-14", "2026-10-13")).toEqual([]);
  });

  it("sem linhas, o período todo vem vazio", () => {
    const r = semanasDePeso([], "2026-10-05", "2026-10-14");
    expect(r).toHaveLength(2);
    expect(r.every((s) => s.media == null && s.dias === 0)).toBe(true);
  });
});

describe("semanasDePeso — a média", () => {
  const desde = "2026-10-05";
  const ate = "2026-10-18";

  it("um valor por dia: a pesagem mais recente do dia, e não as três", () => {
    // Dia 12: 70,0 às 07h (10h UTC), 71,0 às 20h, 72,0 às 12h. Vale a das 20h.
    // Dia 13: 69,0. Média da semana = (71 + 69) / 2 = 70, em 2 dias.
    const r = semanasDePeso(
      [
        casa("2026-10-12", 70.0, "10:00:00"),
        casa("2026-10-12", 71.0, "23:00:00"),
        casa("2026-10-12", 72.0, "15:00:00"),
        casa("2026-10-13", 69.0, "10:00:00"),
      ],
      desde,
      ate
    );
    expect(r[1]).toMatchObject({ inicio: "2026-10-12", media: 70, dias: 2, menor: 69, maior: 71 });
  });

  it("não depende da ordem em que as linhas chegam", () => {
    const linhas = [
      casa("2026-10-12", 71.0, "23:00:00"),
      casa("2026-10-13", 69.0, "10:00:00"),
      casa("2026-10-12", 70.0, "10:00:00"),
      casa("2026-10-12", 72.0, "15:00:00"),
    ];
    expect(semanasDePeso(linhas, desde, ate)[1]).toMatchObject({ media: 70, dias: 2 });
    expect(semanasDePeso([...linhas].reverse(), desde, ate)[1]).toMatchObject({ media: 70, dias: 2 });
  });

  it("a medida da consulta não entra na média", () => {
    const r = semanasDePeso(
      [casa("2026-10-12", 70), consulta("2026-10-13", { weight_kg: 60 }), casa("2026-10-14", 72)],
      desde,
      ate
    );
    expect(r[1]).toMatchObject({ media: 71, dias: 2, menor: 70, maior: 72 });
  });

  it("no dia com as duas, a de casa conta na média (a da consulta é ponto à parte)", () => {
    const r = semanasDePeso(
      [casa("2026-10-12", 70, "10:00:00"), consulta("2026-10-12", { weight_kg: 64 }, "09:00:00")],
      desde,
      ate
    );
    expect(r[1]).toMatchObject({ media: 70, dias: 1 });
  });

  it("peso que chega do banco como texto conta como número", () => {
    // O numeric do PostgREST volta como string: "70.3" virava concatenação.
    const r = semanasDePeso([casa("2026-10-12", "70.3"), casa("2026-10-13", "70.5")], desde, ate);
    expect(r[1]).toMatchObject({ media: 70.4, menor: 70.3, maior: 70.5 });
  });

  it("peso nulo ou vazio fica fora, não vira zero", () => {
    const r = semanasDePeso(
      [casa("2026-10-12", null), casa("2026-10-13", ""), casa("2026-10-14", "  "), casa("2026-10-15", 70)],
      desde,
      ate
    );
    expect(r[1]).toMatchObject({ media: 70, dias: 1, menor: 70, maior: 70 });
  });

  it("linha da casa só com cintura (sem peso) não faz dia", () => {
    const r = semanasDePeso([casa("2026-10-12", null, "12:00:00", { waist_cm: 85 })], desde, ate);
    expect(r[1]).toMatchObject({ media: null, dias: 0 });
  });

  it("a média sai com 1 casa decimal, sem resto de ponto flutuante", () => {
    // (70,1 + 70,3 + 70,2 + 70,2) / 4 dá 70.19999999999999 no JavaScript.
    const r = semanasDePeso(
      [casa("2026-10-12", 70.1), casa("2026-10-13", 70.3), casa("2026-10-14", 70.2), casa("2026-10-15", 70.2)],
      desde,
      ate
    );
    expect(r[1].media).toBe(70.2);
  });
});

describe("pontosDaConsulta", () => {
  it("só as medidas da consulta que têm o campo, na ordem das datas", () => {
    const linhas = [
      consulta("2026-10-13", { weight_kg: 70.3 }),
      casa("2026-08-01", 72),
      consulta("2026-05-12", { weight_kg: 74.6 }),
      consulta("2026-07-01", { waist_cm: 90 }),
    ];
    expect(pontosDaConsulta(linhas, "weight_kg")).toEqual([
      { data: "2026-05-12", valor: 74.6 },
      { data: "2026-10-13", valor: 70.3 },
    ]);
    expect(pontosDaConsulta(linhas, "waist_cm")).toEqual([{ data: "2026-07-01", valor: 90 }]);
  });

  it("valor em texto vira número; vazio e nulo ficam fora", () => {
    const linhas = [
      consulta("2026-05-12", { weight_kg: "74.6" }),
      consulta("2026-06-12", { weight_kg: "" }),
      consulta("2026-07-12", { weight_kg: null }),
    ];
    expect(pontosDaConsulta(linhas, "weight_kg")).toEqual([{ data: "2026-05-12", valor: 74.6 }]);
  });

  it("sem medida da consulta, lista vazia", () => {
    expect(pontosDaConsulta([casa("2026-10-12", 70)], "weight_kg")).toEqual([]);
  });
});

describe("serieDeMedida", () => {
  it("um ponto por linha com valor, de casa e da consulta, e daConsulta pelo measured_by", () => {
    const linhas = [
      consulta("2026-10-13", { waist_cm: 85 }),
      casa("2026-08-01", 72, "12:00:00", { waist_cm: 90 }),
      casa("2026-09-01", 71),
      consulta("2026-05-12", { waist_cm: 92 }),
    ];
    expect(serieDeMedida(linhas, "waist_cm")).toEqual<PontoDeMedida[]>([
      { data: "2026-05-12", valor: 92, daConsulta: true },
      { data: "2026-08-01", valor: 90, daConsulta: false },
      { data: "2026-10-13", valor: 85, daConsulta: true },
    ]);
  });

  it("no mesmo dia, a de casa e a da consulta aparecem as duas", () => {
    const linhas = [
      consulta("2026-10-13", { body_fat_pct: 24.8 }, "13:00:00"),
      casa("2026-10-13", 70, "10:00:00", { body_fat_pct: "25.1" }),
    ];
    const r = serieDeMedida(linhas, "body_fat_pct");
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.valor)).toEqual([25.1, 24.8]);
    expect(r.map((p) => p.daConsulta)).toEqual([false, true]);
  });

  it("valor nulo ou vazio fica fora", () => {
    const linhas = [casa("2026-10-12", 70, "12:00:00", { waist_cm: "" }), casa("2026-10-13", 70)];
    expect(serieDeMedida(linhas, "waist_cm")).toEqual([]);
  });
});

describe("tituloDoPeso", () => {
  const tres = [
    semana("2026-05-12", "2026-05-17", 74.4),
    semana("2026-05-18", "2026-05-24", 72.0),
    semana("2026-10-12", "2026-10-14", 70.1, { emCurso: true }),
  ];

  it("com média semanal: a última semana contra a primeira", () => {
    expect(tituloDoPeso(tres, [])).toEqual({
      rotulo: "média da semana",
      valor: 70.1,
      variacao: -4.3,
      desde: "2026-05-12",
    });
  });

  it("semana sem média não conta: `desde` é o início da primeira que tem", () => {
    const r = tituloDoPeso(
      [semana("2026-05-04", "2026-05-10", null), ...tres, semana("2026-10-19", "2026-10-25", null)],
      []
    );
    expect(r).toMatchObject({ valor: 70.1, variacao: -4.3, desde: "2026-05-12" });
  });

  it("a variação não carrega resto de ponto flutuante", () => {
    // 70,1 - 74,4 dá -4.300000000000011.
    expect(tituloDoPeso(tres, [])!.variacao).toBe(-4.3);
  });

  it("com uma semana só, não há contra o que comparar: variação nula", () => {
    expect(tituloDoPeso([semana("2026-10-12", "2026-10-14", 70.1)], [])).toEqual({
      rotulo: "média da semana",
      valor: 70.1,
      variacao: null,
      desde: "2026-10-12",
    });
  });

  it("com média semanal, a semana vence a consulta no título", () => {
    const consultas: PontoDeConsulta[] = [{ data: "2026-10-13", valor: 60 }];
    expect(tituloDoPeso(tres, consultas)!.rotulo).toBe("média da semana");
  });

  it("sem pesagem de casa: a última medida da consulta contra a primeira", () => {
    const consultas: PontoDeConsulta[] = [
      { data: "2026-05-12", valor: 74.6 },
      { data: "2026-10-13", valor: 70.3 },
    ];
    expect(tituloDoPeso([semana("2026-10-12", "2026-10-14", null)], consultas)).toEqual({
      rotulo: "última medida",
      valor: 70.3,
      variacao: -4.3,
      desde: "2026-05-12",
    });
  });

  it("uma só medida da consulta: o valor sem variação", () => {
    expect(tituloDoPeso([], [{ data: "2026-10-13", valor: 70.3 }])).toEqual({
      rotulo: "última medida",
      valor: 70.3,
      variacao: null,
      desde: "2026-10-13",
    });
  });

  it("nada para mostrar: nulo", () => {
    expect(tituloDoPeso([], [])).toBeNull();
    expect(tituloDoPeso([semana("2026-10-12", "2026-10-14", null)], [])).toBeNull();
  });
});

describe("temGraficoDePeso", () => {
  const ponto = (data: string): PontoDeConsulta => ({ data, valor: 70 });

  it("uma semana e uma consulta ainda não dão tendência", () => {
    expect(temGraficoDePeso([semana("2026-10-12", "2026-10-14", 70)], [ponto("2026-10-13")])).toBe(false);
  });

  it("duas semanas com média bastam", () => {
    expect(
      temGraficoDePeso([semana("2026-10-05", "2026-10-11", 71), semana("2026-10-12", "2026-10-14", 70)], [])
    ).toBe(true);
  });

  it("semana sem média não conta como semana", () => {
    expect(
      temGraficoDePeso([semana("2026-10-05", "2026-10-11", null), semana("2026-10-12", "2026-10-14", 70)], [])
    ).toBe(false);
  });

  it("duas consultas, sem pesagem de casa, bastam", () => {
    expect(temGraficoDePeso([], [ponto("2026-05-12"), ponto("2026-10-13")])).toBe(true);
  });

  it("sem nada, não", () => {
    expect(temGraficoDePeso([], [])).toBe(false);
  });
});

describe("escalaDoPeso", () => {
  it("arredonda para o kg inteiro abaixo e acima, com 0,5 kg de folga", () => {
    expect(escalaDoPeso([70.1, 74.6], null)).toEqual({ min: 69, max: 76, metaNaEscala: false, metaAcima: false });
  });

  it("uma meta perto dos dados entra na escala e a estende", () => {
    expect(escalaDoPeso([70.1, 74.6], 66)).toEqual({ min: 65, max: 76, metaNaEscala: true, metaAcima: false });
  });

  it("uma meta longe, abaixo, fica fora e a escala não a considera", () => {
    // Com a meta 30 kg abaixo, a escala achataria a linha do peso numa faixa fina.
    expect(escalaDoPeso([98, 101], 70)).toEqual({ min: 97, max: 102, metaNaEscala: false, metaAcima: false });
  });

  it("uma meta longe, acima (quem quer ganhar peso), fica fora e metaAcima é verdadeiro", () => {
    expect(escalaDoPeso([50, 52], 60)).toEqual({ min: 49, max: 53, metaNaEscala: false, metaAcima: true });
  });

  it("a meta a exatamente 5 kg do menor ou do maior ainda entra", () => {
    expect(escalaDoPeso([71, 74], 66).metaNaEscala).toBe(true);
    expect(escalaDoPeso([71, 74], 79).metaNaEscala).toBe(true);
    expect(escalaDoPeso([71, 74], 65.9).metaNaEscala).toBe(false);
    expect(escalaDoPeso([71, 74], 79.1).metaNaEscala).toBe(false);
  });

  it("os 5 kg valem com casa decimal sem erro de ponto flutuante", () => {
    // 70,1 - 5 tem de ser 65,1 para a meta 65,1 entrar.
    expect(escalaDoPeso([70.1, 74.6], 65.1).metaNaEscala).toBe(true);
  });

  it("uma meta dentro da faixa dos dados entra sem mexer na escala", () => {
    expect(escalaDoPeso([70.1, 74.6], 72)).toEqual({ min: 69, max: 76, metaNaEscala: true, metaAcima: false });
  });

  it("uma meta acima que entra estende o topo", () => {
    expect(escalaDoPeso([50, 52], 55)).toEqual({ min: 49, max: 56, metaNaEscala: true, metaAcima: true });
  });

  it("valores inteiros também ganham a folga de 0,5 kg: 50 e 52 viram 49 e 53", () => {
    expect(escalaDoPeso([50, 52], null)).toMatchObject({ min: 49, max: 53 });
  });

  it("sem valores, devolve uma escala finita (o gráfico nem aparece)", () => {
    const r = escalaDoPeso([], 70);
    expect(Number.isFinite(r.min)).toBe(true);
    expect(Number.isFinite(r.max)).toBe(true);
    expect(r.max).toBeGreaterThan(r.min);
  });
});

describe("descricaoDoPeso", () => {
  // As semanas cobrem de 12/05 (o início do acompanhamento) a 13/10 (hoje).
  const semanas = [
    semana("2026-05-12", "2026-05-17", 74.4),
    semana("2026-05-18", "2026-05-24", null),
    semana("2026-10-12", "2026-10-13", 70.1, { emCurso: true }),
  ];
  const seis: PontoDeConsulta[] = [
    { data: "2026-05-12", valor: 74.6 },
    { data: "2026-06-10", valor: 73.2 },
    { data: "2026-07-08", valor: 72.5 },
    { data: "2026-08-05", valor: 71.9 },
    { data: "2026-09-09", valor: 71.0 },
    { data: "2026-10-13", valor: 70.3 },
  ];

  it("a frase do aria-label: período, semana, consultas e meta", () => {
    expect(descricaoDoPeso(semanas, seis, 66)).toBe(
      "Peso de 12/05 a 13/10: média da semana caiu de 74,4 para 70,1 kg; seis consultas, a última com 70,3 kg; meta 66 kg."
    );
  });

  it("quando sobe, diz que subiu", () => {
    const sobe = [semana("2026-05-12", "2026-05-17", 50), semana("2026-10-12", "2026-10-13", 52.5)];
    expect(descricaoDoPeso(sobe, [], null)).toBe("Peso de 12/05 a 13/10: média da semana subiu de 50 para 52,5 kg.");
  });

  it("quando não muda, diz que ficou", () => {
    const igual = [semana("2026-05-12", "2026-05-17", 70), semana("2026-10-12", "2026-10-13", 70)];
    expect(descricaoDoPeso(igual, [], null)).toBe("Peso de 12/05 a 13/10: média da semana ficou em 70 kg.");
  });

  it("sem meta, a frase não fala em meta", () => {
    expect(descricaoDoPeso(semanas, seis, null)).not.toContain("meta");
  });

  it("só consultas (sem pesagem de casa): o período vem das datas das consultas", () => {
    expect(descricaoDoPeso([], seis.slice(0, 2), 66)).toBe(
      "Peso de 12/05 a 10/06: duas consultas, a última com 73,2 kg; meta 66 kg."
    );
  });

  it("uma consulta só, no mesmo dia: não diz 'de 13/10 a 13/10'", () => {
    expect(descricaoDoPeso([], [seis[5]], null)).toBe("Peso em 13/10: uma consulta, com 70,3 kg.");
  });

  it("uma semana só: o valor, sem 'caiu' nem 'subiu'", () => {
    expect(descricaoDoPeso([semana("2026-10-12", "2026-10-13", 70.1)], [], null)).toBe(
      "Peso de 12/10 a 13/10: média da semana de 70,1 kg."
    );
  });

  it("passa de dez consultas: o número em algarismos", () => {
    const doze: PontoDeConsulta[] = Array.from({ length: 12 }, (_, i) => ({
      data: `2026-01-${10 + i}`,
      valor: 70,
    }));
    expect(descricaoDoPeso([], doze, null)).toContain("12 consultas");
  });

  it("um período que atravessa o ano leva o ano nas duas pontas", () => {
    // "Peso de 15/10 a 14/10" não diz nada a quem só ouve o leitor de tela.
    const longo = [semana("2025-10-15", "2025-10-19", 80), semana("2026-10-12", "2026-10-14", 75)];
    expect(descricaoDoPeso(longo, [], null)).toBe(
      "Peso de 15/10/2025 a 14/10/2026: média da semana caiu de 80 para 75 kg."
    );
  });

  it("sem nenhuma medida, diz isso (e a meta, se houver)", () => {
    expect(descricaoDoPeso([], [], null)).toBe("Peso: sem medidas no período.");
    expect(descricaoDoPeso([semana("2026-10-12", "2026-10-13", null)], [], 66)).toBe(
      "Peso: sem medidas no período; meta 66 kg."
    );
  });
});

describe("descricaoDaMedida", () => {
  const ponto = (data: string, valor: number, daConsulta = true): PontoDeMedida => ({ data, valor, daConsulta });

  it("conta as medidas e diz de onde para onde", () => {
    const seis = [92, 91, 90, 88.5, 87, 85].map((v, i) => ponto(`2026-${String(i + 5).padStart(2, "0")}-10`, v));
    expect(descricaoDaMedida("Cintura", "cm", seis)).toBe("Cintura medida 6 vezes, de 92 para 85 cm.");
  });

  it("usa vírgula nos decimais", () => {
    expect(descricaoDaMedida("Gordura corporal", "%", [ponto("2026-05-10", 28.4), ponto("2026-10-10", 24.8)])).toBe(
      "Gordura corporal medida 2 vezes, de 28,4 para 24,8 %."
    );
  });

  it("uma medida só", () => {
    expect(descricaoDaMedida("Cintura", "cm", [ponto("2026-05-10", 92)])).toBe("Cintura medida 1 vez, 92 cm.");
  });

  it("sem mudança entre a primeira e a última", () => {
    expect(descricaoDaMedida("Cintura", "cm", [ponto("2026-05-10", 90), ponto("2026-10-10", 90)])).toBe(
      "Cintura medida 2 vezes, a primeira e a última com 90 cm."
    );
  });

  it("sem medida, diz isso", () => {
    expect(descricaoDaMedida("Cintura", "cm", [])).toBe("Cintura sem medidas.");
  });
});

describe("variacaoDaMedida", () => {
  const ponto = (data: string, valor: number, daConsulta = true): PontoDeMedida => ({ data, valor, daConsulta });

  it("o último menos o primeiro", () => {
    expect(
      variacaoDaMedida([ponto("2026-05-12", 92), ponto("2026-08-01", 90, false), ponto("2026-10-13", 85)])
    ).toBe(-7);
  });

  it("sobe quando a medida sobe", () => {
    expect(variacaoDaMedida([ponto("2026-05-12", 80), ponto("2026-10-13", 82.5)])).toBe(2.5);
  });

  it("uma casa decimal: 30,4 - 34,0 não sai -3,5999999999999943", () => {
    // Subtraído no componente, o título mostraria o resto de ponto flutuante.
    expect(30.4 - 34.0).not.toBe(-3.6);
    expect(variacaoDaMedida([ponto("2026-05-12", 34.0), ponto("2026-10-13", 30.4)])).toBe(-3.6);
  });

  it("sem mudança é 0, e não -0", () => {
    // toBe usa Object.is: -0 reprovaria. O "0" do título não pode sair "-0".
    expect(variacaoDaMedida([ponto("2026-05-12", 90), ponto("2026-10-13", 90)])).toBe(0);
    expect(variacaoDaMedida([ponto("2026-05-12", 90.04), ponto("2026-10-13", 90)])).toBe(0);
  });

  it("com menos de dois pontos não há variação", () => {
    expect(variacaoDaMedida([])).toBeNull();
    expect(variacaoDaMedida([ponto("2026-05-12", 92)])).toBeNull();
  });

  it("é a do último ponto contra o primeiro, e não a do menor contra o maior", () => {
    const pontos = [ponto("2026-05-12", 92), ponto("2026-07-01", 96, false), ponto("2026-08-01", 84), ponto("2026-10-13", 88)];
    expect(variacaoDaMedida(pontos)).toBe(-4);
  });
});

describe("diasEntre", () => {
  it("o mesmo dia é 0, e o seguinte é 1", () => {
    expect(diasEntre("2026-10-14", "2026-10-14")).toBe(0);
    expect(diasEntre("2026-10-14", "2026-10-15")).toBe(1);
  });

  it("atravessa mês, ano e 29 de fevereiro", () => {
    expect(diasEntre("2026-05-12", "2026-10-14")).toBe(155);
    expect(diasEntre("2026-12-30", "2027-01-02")).toBe(3);
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("não sofre com a virada do horário de verão: é conta de dia, não de hora", () => {
    // 2018-11-03 e 2018-02-17 são as viradas do horário de verão do Brasil; em
    // hora local, o dia de 23 ou 25 horas dava 0,96 ou 1,04 e o Math.round
    // escondia o erro só se alguém lembrasse dele.
    expect(diasEntre("2018-11-03", "2018-11-04")).toBe(1);
    expect(diasEntre("2018-02-17", "2018-02-18")).toBe(1);
    expect(diasEntre("2018-10-01", "2019-03-01")).toBe(151);
  });

  it("negativo quando o segundo dia vem antes", () => {
    expect(diasEntre("2026-10-14", "2026-10-10")).toBe(-4);
  });
});

describe("marcasDeMes", () => {
  it("o dia 1 de cada mês dentro do período, em dias desde o começo", () => {
    expect(marcasDeMes("2026-05-12", "2026-10-14")).toEqual([
      { dia: 20, rotulo: "jun" },
      { dia: 50, rotulo: "jul" },
      { dia: 81, rotulo: "ago" },
      { dia: 112, rotulo: "set" },
      { dia: 142, rotulo: "out" },
    ]);
  });

  it("o primeiro dia do período conta quando é dia 1, e o último também", () => {
    expect(marcasDeMes("2026-10-01", "2026-12-01")).toEqual([
      { dia: 0, rotulo: "out" },
      { dia: 31, rotulo: "nov" },
      { dia: 61, rotulo: "dez" },
    ]);
  });

  it("período dentro de um mês, sem dia 1, não tem marca", () => {
    expect(marcasDeMes("2026-10-02", "2026-10-14")).toEqual([]);
  });

  it("quando o período atravessa o ano, o janeiro leva o ano para não confundir", () => {
    const marcas = marcasDeMes("2026-11-10", "2027-02-10");
    expect(marcas.map((m) => m.rotulo)).toEqual(["dez", "jan/27", "fev"]);
    expect(marcas.map((m) => m.dia)).toEqual([21, 52, 83]);
  });

  it("início depois do fim não tem marca", () => {
    expect(marcasDeMes("2026-10-14", "2026-05-12")).toEqual([]);
  });
});

describe("marcasDoEixo", () => {
  it("inteiros de 2 em 2 para 5 marcas entre 65 e 75", () => {
    expect(marcasDoEixo(65, 75, 5)).toEqual([66, 68, 70, 72, 74]);
  });

  it("no celular, 3 marcas: de 5 em 5", () => {
    expect(marcasDoEixo(65, 75, 3)).toEqual([65, 70, 75]);
  });

  it("escala curta fica de 1 em 1", () => {
    expect(marcasDoEixo(69, 73, 5)).toEqual([69, 70, 71, 72, 73]);
  });

  it("nunca passa do número pedido, e dá pelo menos duas", () => {
    for (const [min, max] of [[60, 80], [69, 72], [100, 101], [40, 130]]) {
      for (const alvo of [3, 5]) {
        const m = marcasDoEixo(min, max, alvo);
        expect(m.length, `${min}-${max}/${alvo}`).toBeLessThanOrEqual(alvo);
        expect(m.length, `${min}-${max}/${alvo}`).toBeGreaterThanOrEqual(2);
        expect(m.every((v) => v >= min && v <= max)).toBe(true);
      }
    }
  });
});

describe("pesoInicialDoPeriodo", () => {
  it("é o peso do primeiro dia com peso; no dia com as duas, vale o da consulta", () => {
    const linhas = [
      casa("2026-05-20", 73.0),
      casa("2026-05-12", 74.9, "10:00:00"),
      consulta("2026-05-12", { weight_kg: 74.6 }, "13:00:00"),
    ];
    expect(pesoInicialDoPeriodo(linhas, "2026-05-12")).toEqual({ valor: 74.6, data: "2026-05-12" });
  });

  it("a consulta vence mesmo lançada antes da pesagem de casa do mesmo dia", () => {
    const linhas = [casa("2026-05-12", 74.9, "20:00:00"), consulta("2026-05-12", { weight_kg: 74.6 }, "08:00:00")];
    expect(pesoInicialDoPeriodo(linhas, "2026-05-12")!.valor).toBe(74.6);
  });

  it("sem consulta no dia, vale a pesagem de casa mais recente dele", () => {
    const linhas = [casa("2026-05-12", 75.4, "10:00:00"), casa("2026-05-12", 74.9, "22:00:00")];
    expect(pesoInicialDoPeriodo(linhas, "2026-05-12")).toEqual({ valor: 74.9, data: "2026-05-12" });
  });

  it("linhas anteriores a `desde` ficam fora", () => {
    const linhas = [casa("2026-05-10", 80.0), consulta("2026-05-11", { weight_kg: 79.0 }), casa("2026-05-14", 74.9)];
    expect(pesoInicialDoPeriodo(linhas, "2026-05-12")).toEqual({ valor: 74.9, data: "2026-05-14" });
  });

  it("o dia sem peso (só cintura) não é o primeiro dia com peso", () => {
    const linhas = [
      casa("2026-05-12", null, "12:00:00", { waist_cm: 92 }),
      consulta("2026-05-13", { waist_cm: 91 }),
      casa("2026-05-14", "73.5"),
    ];
    expect(pesoInicialDoPeriodo(linhas, "2026-05-12")).toEqual({ valor: 73.5, data: "2026-05-14" });
  });

  it("peso vazio não vira zero", () => {
    expect(pesoInicialDoPeriodo([casa("2026-05-12", ""), casa("2026-05-13", 74)], "2026-05-12")).toEqual({
      valor: 74,
      data: "2026-05-13",
    });
  });

  it("sem peso no período, nulo", () => {
    expect(pesoInicialDoPeriodo([], "2026-05-12")).toBeNull();
    expect(pesoInicialDoPeriodo([casa("2026-05-01", 80)], "2026-05-12")).toBeNull();
  });
});

describe("progressoDaMeta", () => {
  it("perder: quanto do caminho do peso inicial até a meta já foi feito", () => {
    expect(progressoDaMeta(74.6, 70.3, 66)).toEqual({ tipo: "progresso", fracao: 0.5, feito: 4.3, total: 8.6 });
  });

  it("ganhar: a mesma conta no outro sentido", () => {
    const r = progressoDaMeta(50, 52, 56);
    expect(r).toMatchObject({ tipo: "progresso", feito: 2, total: 6 });
    expect((r as { fracao: number }).fracao).toBeCloseTo(1 / 3, 2);
  });

  it("feito e total saem sem resto de ponto flutuante", () => {
    // 74,6 - 66 dá 8.599999999999994 e 74,6 - 70,3 dá 4.299999999999997.
    const r = progressoDaMeta(74.6, 70.3, 66) as { feito: number; total: number };
    expect(r.feito).toBe(4.3);
    expect(r.total).toBe(8.6);
  });

  it("sem mexer desde o peso inicial é progresso zero, não lado errado", () => {
    expect(progressoDaMeta(74.6, 74.6, 66)).toEqual({ tipo: "progresso", fracao: 0, feito: 0, total: 8.6 });
  });

  it("lado errado, querendo perder: mais pesado que o inicial, com a diferença para cima", () => {
    expect(progressoDaMeta(74.6, 75.8, 66)).toEqual({ tipo: "lado-errado", diferenca: 1.2 });
  });

  it("lado errado, querendo ganhar: mais leve que o inicial, com a diferença para baixo", () => {
    expect(progressoDaMeta(50, 49, 56)).toEqual({ tipo: "lado-errado", diferenca: -1 });
  });

  it("meta atingida: no peso da meta, sem 'passou'", () => {
    expect(progressoDaMeta(74.6, 66.0, 66)).toEqual({ tipo: "atingida", passou: null });
  });

  it("perto da meta mas ainda não nela (200 g) segue como progresso, não 'atingida'", () => {
    const r = progressoDaMeta(74.6, 66.2, 66);
    expect(r).toMatchObject({ tipo: "progresso", feito: 8.4, total: 8.6 });
    expect((r as { fracao: number }).fracao).toBeCloseTo(0.977, 3);
  });

  it("a menos de 0,05 kg da meta já é atingida", () => {
    expect(progressoDaMeta(74.6, 66.04, 66)).toEqual({ tipo: "atingida", passou: null });
    expect(progressoDaMeta(50, 55.97, 56)).toEqual({ tipo: "atingida", passou: null });
  });

  it("passou da meta em mais de 0,5 kg: diz quanto", () => {
    expect(progressoDaMeta(74.6, 65.2, 66)).toEqual({ tipo: "atingida", passou: 0.8 });
    expect(progressoDaMeta(50, 57, 56)).toEqual({ tipo: "atingida", passou: 1 });
  });

  it("passou de 0,5 kg para menos (ou exatamente 0,5): só 'meta atingida'", () => {
    expect(progressoDaMeta(74.6, 65.5, 66)).toEqual({ tipo: "atingida", passou: null });
    expect(progressoDaMeta(74.6, 65.6, 66)).toEqual({ tipo: "atingida", passou: null });
    expect(progressoDaMeta(50, 56.4, 56)).toEqual({ tipo: "atingida", passou: null });
  });

  it("0,5 kg passado com casa decimal não vira 'passou' por resto de ponto flutuante", () => {
    // 70,1 - 69,6 dá 0.5000000000000071.
    expect(progressoDaMeta(75, 69.6, 70.1)).toEqual({ tipo: "atingida", passou: null });
    expect(progressoDaMeta(75, 69.5, 70.1)).toEqual({ tipo: "atingida", passou: 0.6 });
  });

  it("sem anel: meta, peso inicial ou peso atual ausentes", () => {
    expect(progressoDaMeta(74.6, 70.3, null)).toBeNull();
    expect(progressoDaMeta(null, 70.3, 66)).toBeNull();
    expect(progressoDaMeta(74.6, null, 66)).toBeNull();
  });

  it("sem anel: meta igual ao peso inicial (não há caminho a percorrer)", () => {
    expect(progressoDaMeta(66, 66, 66)).toBeNull();
    expect(progressoDaMeta(66, 70, 66)).toBeNull();
    expect(progressoDaMeta(66.02, 70, 66)).toBeNull();
  });
});
