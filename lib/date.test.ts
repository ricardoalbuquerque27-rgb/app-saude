import { describe, it, expect, vi, afterEach } from "vitest";
import {
  todayISO,
  addDaysISO,
  weekStartISO,
  formatDate,
  hojeLongo,
  diasNaJanela,
  naJanela,
  avancarDia,
  idadeEm,
} from "./date";

afterEach(() => vi.useRealTimers());

/** Congela o relógio num instante UTC exato. */
function agora(isoUtc: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoUtc));
}

describe("todayISO", () => {
  it("usa o fuso do Brasil, não o do servidor", () => {
    // 01:21 UTC de 9/out ainda é 22:21 de 8/out em São Paulo. A Vercel roda
    // em UTC: sem fixar o fuso, o app virava o dia três horas adiantado e
    // passava a contar "hoje" errado entre 21h e meia-noite.
    agora("2026-10-09T01:21:00Z");
    expect(todayISO()).toBe("2026-10-08");
  });

  it("vira o dia na meia-noite de Brasília, não na de Greenwich", () => {
    agora("2026-10-09T02:59:00Z"); // 23:59 do dia 8 em SP
    expect(todayISO()).toBe("2026-10-08");
    agora("2026-10-09T03:01:00Z"); // 00:01 do dia 9 em SP
    expect(todayISO()).toBe("2026-10-09");
  });
});

describe("hojeLongo", () => {
  it("formata no fuso do Brasil", () => {
    agora("2026-10-09T01:21:00Z");
    // Mesmo instante em que todayISO() diz 8 de outubro: a saudação da
    // Início precisa concordar com o resto da tela.
    expect(hojeLongo()).toContain("8 de outubro");
  });

  it("concorda com todayISO no mesmo instante", () => {
    agora("2026-10-09T01:21:00Z");
    const dia = Number(todayISO().split("-")[2]);
    expect(hojeLongo()).toContain(`${dia} de`);
  });
});

describe("addDaysISO", () => {
  it("atravessa o fim do mês", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("atravessa o fim do ano", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("acerta o ano bissexto", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("uma janela de 7 dias termina 6 dias atrás", () => {
    // O erro que apareceu duas vezes no painel do nutricionista: com -7 e
    // comparação >=, a janela abrange OITO dias e a adesão passava de 100%.
    const dias = [];
    for (let i = 6; i >= 0; i--) dias.push(addDaysISO("2026-10-08", -i));
    expect(dias).toHaveLength(7);
    expect(dias[0]).toBe("2026-10-02");
    expect(dias[6]).toBe("2026-10-08");
  });
});

describe("weekStartISO", () => {
  it("devolve a segunda-feira da semana", () => {
    expect(weekStartISO("2026-10-08")).toBe("2026-10-05"); // quinta -> segunda
    expect(weekStartISO("2026-10-05")).toBe("2026-10-05"); // segunda -> ela mesma
    expect(weekStartISO("2026-10-11")).toBe("2026-10-05"); // domingo -> segunda anterior
  });
});

describe("formatDate", () => {
  it("converte ISO para DD/MM/AAAA", () => {
    expect(formatDate("2026-10-08")).toBe("08/10/2026");
  });

  it("devolve a entrada intacta quando não é uma data", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("sem-data")).toBe("sem-data");
  });
});

describe("diasNaJanela", () => {
  // Esta função ainda não existe. O teste vem primeiro: ele descreve o
  // comportamento que os dois bugs do painel violaram.
  const hoje = "2026-10-08";

  it("conta 7 dias, não 8", () => {
    const todos = [
      "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08",
    ];
    // De 02 a 08 são sete. O dia 01 fica de fora.
    expect(diasNaJanela(todos, hoje, 7)).toBe(7);
  });

  it("ignora datas no futuro", () => {
    // Os seletores de data da Dieta e dos Hábitos deixam escolher um dia à
    // frente. Sem teto, um registro de amanhã fazia o painel dizer
    // "8 de 7 dias".
    const comFuturo = ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-20"];
    expect(diasNaJanela(comFuturo, hoje, 7)).toBe(2);
  });

  it("não conta o mesmo dia duas vezes", () => {
    const repetidas = ["2026-10-08", "2026-10-08", "2026-10-07"];
    expect(diasNaJanela(repetidas, hoje, 7)).toBe(2);
  });

  it("nunca passa do tamanho da janela", () => {
    const muitas = Array.from({ length: 40 }, (_, i) => addDaysISO(hoje, -i));
    expect(diasNaJanela(muitas, hoje, 7)).toBe(7);
    expect(diasNaJanela(muitas, hoje, 30)).toBe(30);
  });

  it("devolve zero quando não há nada", () => {
    expect(diasNaJanela([], hoje, 7)).toBe(0);
  });
});

describe("naJanela", () => {
  const hoje = "2026-10-08";
  it("inclui hoje e o primeiro dia da janela", () => {
    expect(naJanela("2026-10-08", hoje, 7)).toBe(true);
    expect(naJanela("2026-10-02", hoje, 7)).toBe(true);
  });
  it("exclui o dia anterior à janela e qualquer futuro", () => {
    expect(naJanela("2026-10-01", hoje, 7)).toBe(false);
    expect(naJanela("2026-10-09", hoje, 7)).toBe(false);
  });
});

describe("avancarDia", () => {
  // Ainda não existe. Nasce para resolver duas coisas de uma vez:
  //
  //   1. A seta "›" da Dieta usava toISOString(), que converte para UTC —
  //      a leste de Greenwich a meia-noite local cai no dia ANTERIOR e a
  //      seta anda errado.
  //   2. Nada impedia navegar para o futuro. Registro com data futura foi a
  //      causa de quatro correções de "teto" espalhadas pelo app; o certo é
  //      não deixar criar.
  const hoje = "2026-10-08";

  it("anda para frente e para trás", () => {
    expect(avancarDia("2026-10-08", 1, "2026-12-31")).toBe("2026-10-09");
    expect(avancarDia("2026-10-08", -1, hoje)).toBe("2026-10-07");
  });

  it("atravessa o fim do mês sem pedir ajuda ao fuso", () => {
    expect(avancarDia("2026-01-31", 1, "2026-12-31")).toBe("2026-02-01");
    expect(avancarDia("2026-03-01", -1, hoje)).toBe("2026-02-28");
  });

  it("não passa do máximo", () => {
    expect(avancarDia(hoje, 1, hoje)).toBe(hoje);
    expect(avancarDia("2026-10-07", 5, hoje)).toBe(hoje);
  });

  it("não limita para trás", () => {
    expect(avancarDia("2026-10-08", -30, hoje)).toBe("2026-09-08");
  });

  it("sem máximo, anda livre", () => {
    expect(avancarDia("2026-10-08", 10)).toBe("2026-10-18");
  });

  it("puxa de volta uma data que já estava no futuro", () => {
    // Já existe dado gravado à frente: navegar dali não deve seguir em
    // frente, deve voltar para o limite.
    expect(avancarDia("2026-12-25", 1, hoje)).toBe(hoje);
  });
});

describe("idadeEm", () => {
  it("conta os anos completos até hoje", () => {
    expect(idadeEm("1991-06-12", "2026-10-09")).toBe(35);
  });

  it("antes do aniversário do ano, ainda não fez", () => {
    // A conta antiga dividia milissegundos por 365,25 dias e errava em um
    // ano perto do aniversário.
    expect(idadeEm("1991-10-10", "2026-10-09")).toBe(34);
    expect(idadeEm("1991-10-09", "2026-10-09")).toBe(35);
  });

  it("nascido em 29/02 faz aniversário em 01/03 no ano que não é bissexto", () => {
    expect(idadeEm("2000-02-29", "2026-02-28")).toBe(25);
    expect(idadeEm("2000-03-01", "2026-03-01")).toBe(26);
    expect(idadeEm("2000-02-29", "2026-03-01")).toBe(26);
  });

  it("sem data, data inválida ou fora do plausível, não inventa idade", () => {
    expect(idadeEm(null, "2026-10-09")).toBeNull();
    expect(idadeEm(undefined, "2026-10-09")).toBeNull();
    expect(idadeEm("", "2026-10-09")).toBeNull();
    expect(idadeEm("12/06/1991", "2026-10-09")).toBeNull();
    expect(idadeEm("2027-01-01", "2026-10-09")).toBeNull();
    expect(idadeEm("1880-01-01", "2026-10-09")).toBeNull();
  });
});
