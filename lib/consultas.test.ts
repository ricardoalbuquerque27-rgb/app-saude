import { afterEach, describe, expect, it } from "vitest";
import {
  alertasDeConsulta,
  andar,
  choques,
  dataDaUrl,
  emFaixas,
  diasDaSemana,
  duracaoPadrao,
  ehPendencia,
  estadoDaConsulta,
  fimDa,
  gradeDoMes,
  horaEmSaoPaulo,
  instanteEmSaoPaulo,
  noDiaDoMes,
  periodoDaVista,
  proximaConsulta,
  resumoDaConsulta,
  rotuloDaConsulta,
  rotuloDoDia,
  situacao,
  sugestaoDeRetorno,
  tipoSugerido,
  tituloDoPeriodo,
  ultimaRealizada,
  vistaDaUrl,
  type Consulta,
} from "./consultas";

function consulta(c: Partial<Consulta> = {}): Consulta {
  return {
    id: c.id ?? "c1",
    patient_id: "p1",
    nutritionist_id: "n1",
    // 14:00 em São Paulo (UTC−3) = 17:00 UTC
    starts_at: "2026-10-20T17:00:00Z",
    duration_min: 60,
    kind: "retorno",
    mode: "presencial",
    status: "agendada",
    patient_message: null,
    reschedule_requested_at: null,
    cancelled_by: null,
    ...c,
  };
}

const TZ_ORIGINAL = process.env.TZ;
afterEach(() => {
  process.env.TZ = TZ_ORIGINAL;
});

describe("instanteEmSaoPaulo", () => {
  it("converte data e hora de São Paulo no instante UTC", () => {
    expect(instanteEmSaoPaulo("2026-10-20", "14:00")).toBe("2026-10-20T17:00:00.000Z");
  });

  it("22h em São Paulo é 01h UTC do dia seguinte", () => {
    expect(instanteEmSaoPaulo("2026-10-20", "22:30")).toBe("2026-10-21T01:30:00.000Z");
  });

  it("não depende do fuso de quem roda (a Vercel roda em UTC)", () => {
    process.env.TZ = "UTC";
    expect(instanteEmSaoPaulo("2026-10-20", "14:00")).toBe("2026-10-20T17:00:00.000Z");
    process.env.TZ = "Asia/Tokyo";
    expect(instanteEmSaoPaulo("2026-10-20", "14:00")).toBe("2026-10-20T17:00:00.000Z");
  });

  it("usa o deslocamento do dia, não um −03:00 fixo (horário de verão de 2018)", () => {
    // Em 2018-12-10 São Paulo estava em UTC−2.
    expect(instanteEmSaoPaulo("2018-12-10", "14:00")).toBe("2018-12-10T16:00:00.000Z");
  });

  it("recusa data ou hora malformada", () => {
    expect(() => instanteEmSaoPaulo("20/10/2026", "14:00")).toThrow();
    expect(() => instanteEmSaoPaulo("2026-10-20", "25:00")).toThrow();
    expect(() => instanteEmSaoPaulo("2026-02-30", "10:00")).toThrow();
  });
});

describe("horaEmSaoPaulo", () => {
  it("devolve HH:MM no fuso de São Paulo mesmo com o processo em UTC", () => {
    process.env.TZ = "UTC";
    expect(horaEmSaoPaulo("2026-10-21T01:30:00Z")).toBe("22:30");
    expect(horaEmSaoPaulo("2026-10-20T12:05:00Z")).toBe("09:05");
  });
});

describe("situacao", () => {
  const agora = Date.parse("2026-10-20T16:00:00Z"); // 13:00 em SP

  it("pedido é pedido, mesmo com o horário pedido já passado", () => {
    expect(situacao(consulta({ status: "pedido" }), agora)).toBe("pedido");
    expect(
      situacao(consulta({ status: "pedido", starts_at: "2026-10-19T12:00:00Z" }), agora)
    ).toBe("pedido");
  });

  it("agendada futura é agendada", () => {
    expect(situacao(consulta(), agora)).toBe("agendada");
  });

  it("agendada com pedido de remarcação é remarcar", () => {
    expect(
      situacao(consulta({ reschedule_requested_at: "2026-10-19T10:00:00Z" }), agora)
    ).toBe("remarcar");
  });

  it("sem desfecho começa no minuto em que a consulta ACABA, não quando começa", () => {
    const c = consulta(); // 17:00–18:00 UTC
    expect(situacao(c, Date.parse("2026-10-20T17:30:00Z"))).toBe("agendada");
    expect(situacao(c, Date.parse("2026-10-20T17:59:59Z"))).toBe("agendada");
    expect(situacao(c, Date.parse("2026-10-20T18:00:00Z"))).toBe("sem-desfecho");
  });

  it("o horário que passou vence o pedido de remarcação: a consulta precisa de desfecho", () => {
    const c = consulta({ reschedule_requested_at: "2026-10-19T10:00:00Z" });
    expect(situacao(c, Date.parse("2026-10-21T00:00:00Z"))).toBe("sem-desfecho");
  });

  it("fechadas ficam como foram fechadas", () => {
    expect(situacao(consulta({ status: "realizada" }), agora)).toBe("realizada");
    expect(situacao(consulta({ status: "faltou" }), agora)).toBe("faltou");
    expect(situacao(consulta({ status: "cancelada", cancelled_by: "nutri" }), agora)).toBe(
      "cancelada"
    );
  });

  it("aceita o agora como texto ISO", () => {
    expect(situacao(consulta(), "2026-10-20T19:00:00Z")).toBe("sem-desfecho");
  });
});

describe("ehPendencia e fimDa", () => {
  const agora = Date.parse("2026-10-21T12:00:00Z");
  it("pedido, remarcação e sem desfecho são pendência; o resto não", () => {
    expect(ehPendencia(consulta({ status: "pedido" }), agora)).toBe(true);
    expect(ehPendencia(consulta(), agora)).toBe(true); // passou: sem desfecho
    expect(ehPendencia(consulta({ starts_at: "2026-10-25T17:00:00Z" }), agora)).toBe(false);
    expect(
      ehPendencia(
        consulta({ starts_at: "2026-10-25T17:00:00Z", reschedule_requested_at: agora.toString() }),
        agora
      )
    ).toBe(true);
    expect(ehPendencia(consulta({ status: "realizada" }), agora)).toBe(false);
  });

  it("fim é início mais a duração", () => {
    expect(fimDa(consulta({ duration_min: 45 }))).toBe(Date.parse("2026-10-20T17:45:00Z"));
  });
});

describe("choques", () => {
  const lista = [
    consulta({ id: "a", starts_at: "2026-10-20T17:00:00Z", duration_min: 60 }), // 14–15h
    consulta({ id: "b", starts_at: "2026-10-20T19:00:00Z", duration_min: 30 }), // 16–16:30
    consulta({ id: "c", starts_at: "2026-10-20T17:30:00Z", status: "cancelada", cancelled_by: "paciente" }),
    consulta({ id: "d", starts_at: "2026-10-20T17:30:00Z", status: "pedido" }),
  ];

  it("acha a agendada que se sobrepõe", () => {
    expect(choques(lista, "2026-10-20T17:30:00Z", 60).map((c) => c.id)).toEqual(["a"]);
  });

  it("encostar no fim não é choque", () => {
    expect(choques(lista, "2026-10-20T18:00:00Z", 60)).toEqual([]);
    expect(choques(lista, "2026-10-20T16:00:00Z", 60)).toEqual([]);
  });

  it("cobre duas de uma vez", () => {
    expect(choques(lista, "2026-10-20T17:45:00Z", 120).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ignora cancelada, pedido e a própria consulta que está sendo remarcada", () => {
    expect(choques(lista, "2026-10-20T17:00:00Z", 60, "a")).toEqual([]);
  });
});

describe("semana e mês", () => {
  it("a semana vai de segunda a domingo", () => {
    expect(diasDaSemana("2026-10-15")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(diasDaSemana("2026-10-18")[0]).toBe("2026-10-12");
  });

  it("a grade do mês começa na segunda e termina no domingo, marcando os dias de fora", () => {
    const g = gradeDoMes("2026-10-13");
    expect(g[0]).toEqual({ data: "2026-09-28", doMes: false });
    expect(g[3]).toEqual({ data: "2026-10-01", doMes: true });
    expect(g[g.length - 1]).toEqual({ data: "2026-11-01", doMes: false });
    expect(g.length % 7).toBe(0);
    expect(g.filter((d) => d.doMes).length).toBe(31);
  });

  it("fevereiro que começa na segunda tem só quatro semanas", () => {
    // 2027-02-01 é segunda-feira.
    const g = gradeDoMes("2027-02-10");
    expect(g.length).toBe(28);
    expect(g[0].data).toBe("2027-02-01");
  });
});

describe("periodoDaVista e andar", () => {
  it("dia, semana e mês dão as bordas certas", () => {
    expect(periodoDaVista("dia", "2026-10-13")).toEqual({ desde: "2026-10-13", ate: "2026-10-13" });
    expect(periodoDaVista("semana", "2026-10-13")).toEqual({ desde: "2026-10-12", ate: "2026-10-18" });
    expect(periodoDaVista("mes", "2026-10-13")).toEqual({ desde: "2026-09-28", ate: "2026-11-01" });
  });

  it("anda um dia, uma semana ou um mês", () => {
    expect(andar("dia", "2026-10-31", 1)).toBe("2026-11-01");
    expect(andar("semana", "2026-10-13", -1)).toBe("2026-10-06");
    expect(andar("mes", "2026-10-31", 1)).toBe("2026-11-01");
    expect(andar("mes", "2026-01-15", -1)).toBe("2025-12-01");
  });
});

describe("vistaDaUrl e dataDaUrl", () => {
  it("a vista do endereço vence a do cookie; sem nenhuma, Dia", () => {
    expect(vistaDaUrl("semana", "mes")).toBe("semana");
    expect(vistaDaUrl(undefined, "mes")).toBe("mes");
    expect(vistaDaUrl(undefined, undefined)).toBe("dia");
    expect(vistaDaUrl("lista", "xyz")).toBe("dia");
    expect(vistaDaUrl(["mes", "dia"], undefined)).toBe("mes");
  });

  it("data inválida ou impossível cai em hoje", () => {
    expect(dataDaUrl("2026-10-20", "2026-10-13")).toBe("2026-10-20");
    expect(dataDaUrl("2026-02-30", "2026-10-13")).toBe("2026-10-13");
    expect(dataDaUrl("ontem", "2026-10-13")).toBe("2026-10-13");
    expect(dataDaUrl(undefined, "2026-10-13")).toBe("2026-10-13");
  });
});

describe("textos", () => {
  it("rótulo da consulta no fuso de São Paulo", () => {
    process.env.TZ = "UTC";
    expect(rotuloDaConsulta(consulta())).toBe("ter., 20/10 às 14:00");
    // 23:30 de segunda em SP é terça em UTC: o dia é o de SP.
    expect(rotuloDaConsulta(consulta({ starts_at: "2026-10-20T02:30:00Z" }))).toBe(
      "seg., 19/10 às 23:30"
    );
  });

  it("rótulo do dia da Dieta: \"Hoje, sex. 9/10\" ou \"qua. 7/10\", sem zero à esquerda", () => {
    expect(rotuloDoDia("2026-10-09", "2026-10-09")).toBe("Hoje, sex. 9/10");
    expect(rotuloDoDia("2026-10-07", "2026-10-09")).toBe("qua. 7/10");
    // Dia e mês de dois dígitos ficam como estão.
    expect(rotuloDoDia("2026-12-25", "2026-12-31")).toBe("sex. 25/12");
    // 1º de janeiro: o dia da semana vem da data, não do ano anterior.
    expect(rotuloDoDia("2027-01-01", "2027-01-05")).toBe("sex. 1/1");
  });

  it("rótulo do dia: o dia da semana vem da data, não do fuso de quem roda", () => {
    // A leste de Greenwich (UTC+14) o meio-dia local de 2026-10-09 já é 10
    // em UTC; um `new Date(iso)` lido em hora local erraria o dia da semana.
    process.env.TZ = "Pacific/Kiritimati";
    expect(rotuloDoDia("2026-10-09", "2026-10-09")).toBe("Hoje, sex. 9/10");
    process.env.TZ = "Pacific/Pago_Pago";
    expect(rotuloDoDia("2026-10-09", "2026-10-09")).toBe("Hoje, sex. 9/10");
  });

  it("resumo da consulta: tipo com maiúscula, modalidade e duração", () => {
    expect(resumoDaConsulta(consulta({ duration_min: 45 }))).toBe("Retorno · presencial · 45 min");
    expect(resumoDaConsulta(consulta({ kind: "primeira", mode: "online", duration_min: 60 }))).toBe(
      "1ª consulta · online · 60 min"
    );
  });

  it("título de cada vista", () => {
    expect(tituloDoPeriodo("dia", "2026-10-13", "2026-10-13")).toBe("Ter., 13 de out. · hoje");
    expect(tituloDoPeriodo("dia", "2026-10-14", "2026-10-13")).toBe("Qua., 14 de out.");
    expect(tituloDoPeriodo("semana", "2026-10-13", "2026-10-13")).toBe("12 a 18 de out.");
    expect(tituloDoPeriodo("semana", "2026-10-01", "2026-10-13")).toBe("28 de set. a 4 de out.");
    expect(tituloDoPeriodo("semana", "2026-12-30", "2026-10-13")).toBe("28 de dez. de 2026 a 3 de jan. de 2027");
    expect(tituloDoPeriodo("mes", "2026-10-13", "2026-10-13")).toBe("Outubro de 2026");
  });
});

describe("próxima e última", () => {
  const agora = Date.parse("2026-10-20T17:30:00Z");
  const lista = [
    consulta({ id: "passada", starts_at: "2026-09-29T17:00:00Z", status: "realizada" }),
    consulta({ id: "faltou", starts_at: "2026-10-06T17:00:00Z", status: "faltou" }),
    consulta({ id: "agora", starts_at: "2026-10-20T17:00:00Z" }),
    consulta({ id: "depois", starts_at: "2026-11-20T17:00:00Z" }),
    consulta({ id: "cancelada", starts_at: "2026-10-25T17:00:00Z", status: "cancelada", cancelled_by: "paciente" }),
  ];

  it("a próxima é a agendada que ainda não acabou, a mais cedo", () => {
    expect(proximaConsulta(lista, agora)?.id).toBe("agora");
    expect(proximaConsulta(lista, Date.parse("2026-10-20T18:00:00Z"))?.id).toBe("depois");
    expect(proximaConsulta([], agora)).toBeNull();
  });

  it("a última realizada ignora faltas e o futuro", () => {
    expect(ultimaRealizada(lista, agora)?.id).toBe("passada");
    expect(ultimaRealizada([lista[1]], agora)).toBeNull();
  });

  it("tipo sugerido é retorno se já houve consulta realizada", () => {
    expect(tipoSugerido(lista)).toBe("retorno");
    expect(tipoSugerido([lista[1]])).toBe("primeira");
    expect(duracaoPadrao("primeira")).toBe(60);
    expect(duracaoPadrao("retorno")).toBe(45);
  });

  it("o retorno é sugerido 30 dias depois, no mesmo horário de São Paulo", () => {
    expect(sugestaoDeRetorno(consulta({ starts_at: "2026-10-20T02:30:00Z" }))).toEqual({
      data: "2026-11-18",
      hora: "23:30",
    });
  });
});

describe("estadoDaConsulta", () => {
  // 20/10 às 14:30 em São Paulo (17:30 UTC): a consulta de 17:00 UTC (60 min) está em andamento.
  const agora = Date.parse("2026-10-20T17:30:00Z");

  it("a agendada que já terminou fica fora", () => {
    const terminou = consulta({ id: "terminou", starts_at: "2026-10-20T15:00:00Z", duration_min: 60 });
    expect(estadoDaConsulta([terminou], agora)).toEqual({
      proxima: null,
      pedido: null,
      canceladaPeloNutri: null,
    });
  });

  it("a que está acontecendo ainda é a próxima", () => {
    const andando = consulta({ id: "andando" }); // 17:00 UTC, 60 min
    expect(estadoDaConsulta([andando], agora).proxima?.id).toBe("andando");
  });

  it("entre duas agendadas futuras vale a mais cedo, qualquer que seja a ordem da lista", () => {
    const cedo = consulta({ id: "cedo", starts_at: "2026-10-22T17:00:00Z" });
    const tarde = consulta({ id: "tarde", starts_at: "2026-10-29T17:00:00Z" });
    expect(estadoDaConsulta([tarde, cedo], agora).proxima?.id).toBe("cedo");
    expect(estadoDaConsulta([cedo, tarde], agora).proxima?.id).toBe("cedo");
  });

  it("aceita o agora como texto ISO, como a página o manda", () => {
    const futura = consulta({ id: "futura", starts_at: "2026-10-22T17:00:00Z" });
    expect(estadoDaConsulta([futura], "2026-10-20T17:30:00.000Z").proxima?.id).toBe("futura");
  });

  it("o pedido e a agendada aparecem juntos", () => {
    const marcada = consulta({ id: "marcada", starts_at: "2026-10-22T17:00:00Z" });
    const pedida = consulta({ id: "pedida", starts_at: "2026-10-24T17:00:00Z", status: "pedido" });
    const e = estadoDaConsulta([marcada, pedida], agora);
    expect(e.proxima?.id).toBe("marcada");
    expect(e.pedido?.id).toBe("pedida");
  });

  it("com dois pedidos, vale o primeiro da lista", () => {
    const a = consulta({ id: "a", status: "pedido", starts_at: "2026-10-24T17:00:00Z" });
    const b = consulta({ id: "b", status: "pedido", starts_at: "2026-10-23T17:00:00Z" });
    expect(estadoDaConsulta([a, b], agora).pedido?.id).toBe("a");
  });

  it("cancelada pelo paciente não conta", () => {
    const sua = consulta({
      status: "cancelada",
      cancelled_by: "paciente",
      starts_at: "2026-10-18T17:00:00Z",
    });
    expect(estadoDaConsulta([sua], agora).canceladaPeloNutri).toBeNull();
  });

  it("cancelada pelo nutri há 8 dias não conta, e há 6 dias conta", () => {
    const antiga = consulta({
      id: "antiga",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-12T17:30:00Z", // 8 dias antes de agora
    });
    const recente = consulta({
      id: "recente",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-14T17:30:00Z", // 6 dias antes de agora
    });
    expect(estadoDaConsulta([antiga], agora).canceladaPeloNutri).toBeNull();
    expect(estadoDaConsulta([recente], agora).canceladaPeloNutri?.id).toBe("recente");
  });

  it("a janela de 7 dias é aberta: cancelada que começou há 7 dias exatos não conta", () => {
    const limite = consulta({
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-13T17:30:00Z",
    });
    expect(estadoDaConsulta([limite], agora).canceladaPeloNutri).toBeNull();
  });

  it("a cancelada que ainda ia acontecer conta", () => {
    const futura = consulta({
      id: "futura",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-27T17:00:00Z",
    });
    expect(estadoDaConsulta([futura], agora).canceladaPeloNutri?.id).toBe("futura");
  });

  it("só vale a mais recente: uma realizada depois da cancelada a esconde", () => {
    const cancelada = consulta({
      id: "cancelada",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-15T17:00:00Z",
    });
    const realizada = consulta({
      id: "realizada",
      status: "realizada",
      starts_at: "2026-10-18T17:00:00Z",
    });
    expect(estadoDaConsulta([cancelada, realizada], agora).canceladaPeloNutri).toBeNull();
    // e a mesma cancelada, sozinha, aparece
    expect(estadoDaConsulta([cancelada], agora).canceladaPeloNutri?.id).toBe("cancelada");
  });

  it("com uma agendada futura, a cancelada não aparece", () => {
    const cancelada = consulta({
      id: "cancelada",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-18T17:00:00Z",
    });
    const marcada = consulta({ id: "marcada", starts_at: "2026-10-22T17:00:00Z" });
    const e = estadoDaConsulta([cancelada, marcada], agora);
    expect(e.proxima?.id).toBe("marcada");
    expect(e.canceladaPeloNutri).toBeNull();
  });

  it("com um pedido aberto, a cancelada também não aparece", () => {
    const cancelada = consulta({
      id: "cancelada",
      status: "cancelada",
      cancelled_by: "nutri",
      starts_at: "2026-10-18T17:00:00Z",
    });
    const pedida = consulta({ id: "pedida", status: "pedido", starts_at: "2026-10-24T17:00:00Z" });
    const e = estadoDaConsulta([cancelada, pedida], agora);
    expect(e.pedido?.id).toBe("pedida");
    expect(e.canceladaPeloNutri).toBeNull();
  });

  it("sem consulta nenhuma, nada", () => {
    expect(estadoDaConsulta([], agora)).toEqual({
      proxima: null,
      pedido: null,
      canceladaPeloNutri: null,
    });
  });
});

describe("alertasDeConsulta", () => {
  const agora = Date.parse("2026-10-20T12:00:00Z");

  it("sem pendência, sem alerta", () => {
    expect(alertasDeConsulta([consulta()], agora)).toEqual([]);
  });

  it("pedido e remarcação são nível 2; sem desfecho, nível 4", () => {
    const lista = [
      consulta({ id: "p", status: "pedido", starts_at: "2026-10-25T17:00:00Z" }),
      consulta({ id: "s", starts_at: "2026-10-09T13:30:00Z" }),
    ];
    expect(alertasDeConsulta(lista, agora)).toEqual([
      { tipo: "consulta", nivel: 2, texto: "Pediu uma consulta" },
      { tipo: "consulta", nivel: 4, texto: "Consulta de 09/10 sem desfecho" },
    ]);
  });

  it("pedido de remarcação tem texto próprio", () => {
    const lista = [
      consulta({ starts_at: "2026-10-25T17:00:00Z", reschedule_requested_at: "2026-10-19T12:00:00Z" }),
    ];
    expect(alertasDeConsulta(lista, agora)).toEqual([
      { tipo: "consulta", nivel: 2, texto: "Pediu para remarcar a consulta" },
    ]);
  });

  it("várias sem desfecho viram um alerta só, com a conta", () => {
    const lista = [
      consulta({ id: "x", starts_at: "2026-10-09T13:30:00Z" }),
      consulta({ id: "y", starts_at: "2026-10-12T13:30:00Z" }),
    ];
    expect(alertasDeConsulta(lista, agora)).toEqual([
      { tipo: "consulta", nivel: 4, texto: "2 consultas sem desfecho" },
    ]);
  });

  it("a data da sem desfecho é a de São Paulo", () => {
    process.env.TZ = "UTC";
    // 23:00 de 09/10 em SP = 02:00 UTC de 10/10
    const lista = [consulta({ starts_at: "2026-10-10T02:00:00Z" })];
    expect(alertasDeConsulta(lista, agora)[0].texto).toBe("Consulta de 09/10 sem desfecho");
  });
});

describe("emFaixas", () => {
  it("consultas que não se tocam ficam numa faixa só", () => {
    const r = emFaixas([
      consulta({ id: "a", starts_at: "2026-10-20T12:00:00Z", duration_min: 60 }),
      consulta({ id: "b", starts_at: "2026-10-20T13:00:00Z", duration_min: 60 }),
    ]);
    expect(r.map((x) => [x.consulta.id, x.faixa, x.faixas])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("sobrepostas dividem a largura, e o grupo inteiro usa o mesmo número de faixas", () => {
    const r = emFaixas([
      consulta({ id: "c", starts_at: "2026-10-20T12:30:00Z", duration_min: 60 }),
      consulta({ id: "a", starts_at: "2026-10-20T12:00:00Z", duration_min: 60 }),
      consulta({ id: "b", starts_at: "2026-10-20T13:00:00Z", duration_min: 30 }),
      consulta({ id: "d", starts_at: "2026-10-20T15:00:00Z", duration_min: 30 }),
    ]);
    expect(r.map((x) => [x.consulta.id, x.faixa, x.faixas])).toEqual([
      ["a", 0, 2],
      ["c", 1, 2],
      ["b", 0, 2],
      ["d", 0, 1],
    ]);
  });
});

describe("noDiaDoMes", () => {
  const AGORA = "2026-10-19T12:00:00Z";
  const as = (id: string, hora: string, c: Partial<Consulta> = {}) =>
    consulta({ id, starts_at: `2026-10-20T${hora}:00Z`, ...c });

  it("mostra as primeiras em ordem de hora e conta o resto", () => {
    const r = noDiaDoMes([as("c", "19:00"), as("a", "13:00"), as("b", "15:00")], AGORA);
    expect(r.mostrar.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r.resto).toBe(1);
    expect(r.pendenciaNoResto).toBe(false);
  });

  it("avisa quando a pendência ficou escondida no resto", () => {
    // Sem isso, um pedido às 18h num dia cheio sumiria do Mês.
    const r = noDiaDoMes(
      [as("a", "13:00"), as("b", "15:00"), as("c", "21:00", { status: "pedido" })],
      AGORA
    );
    expect(r.resto).toBe(1);
    expect(r.pendenciaNoResto).toBe(true);
  });

  it("com até o máximo, mostra todas e não há resto", () => {
    const r = noDiaDoMes([as("a", "13:00"), as("b", "15:00", { status: "pedido" })], AGORA);
    expect(r.mostrar).toHaveLength(2);
    expect(r.resto).toBe(0);
    expect(r.pendenciaNoResto).toBe(false);
  });
});
