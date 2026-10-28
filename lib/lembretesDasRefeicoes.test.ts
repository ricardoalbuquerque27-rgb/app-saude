import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  FORMATO_DO_HORARIO,
  HORARIOS_SUGERIDOS,
  horarioValido,
  horariosDoPaciente,
  horariosParaGravar,
  idDaRefeicao,
  notificacaoDaRefeicao,
  situacaoDosLembretes,
  slugDaRefeicao,
  urlDaRefeicao,
} from "./lembretesDasRefeicoes";

describe("os horários", () => {
  it("os sugeridos e o formato são os da migração (refeicoes_devidas_em)", () => {
    const sql = readFileSync("supabase/migrations/20261027120000_lembretes_das_refeicoes.sql", "utf8");
    const pares = Object.fromEntries(
      [...sql.matchAll(/\('([^']+)',\s*'(\d\d:\d\d)'\)/g)].map((m) => [m[1], m[2]])
    );
    expect(pares).toEqual(HORARIOS_SUGERIDOS);
    expect(sql).toContain(`'${FORMATO_DO_HORARIO}'`);
  });

  it("os seis sugeridos", () => {
    expect(HORARIOS_SUGERIDOS).toEqual({
      "Café da manhã": "08:00",
      "Lanche da manhã": "10:00",
      Almoço: "12:30",
      "Lanche da tarde": "16:00",
      Jantar: "20:00",
      Ceia: "22:00",
    });
  });

  it("horarioValido: HH:MM de 00:00 a 23:59", () => {
    for (const h of ["00:00", "08:00", "12:30", "23:59"]) expect(horarioValido(h)).toBe(true);
    for (const h of ["24:00", "8:00", "12:60", "12:3", "", " 08:00", null, undefined, 800])
      expect(horarioValido(h)).toBe(false);
  });

  it("horariosDoPaciente: o salvo vence o sugerido, o inválido não, e só as refeições pedidas", () => {
    expect(
      horariosDoPaciente(["Almoço", "Jantar", "Pré-treino"], { Almoço: "13:00", Jantar: "25:99", Ceia: "23:00" })
    ).toEqual([
      { refeicao: "Almoço", horario: "13:00", sugerido: "12:30", mudado: true },
      { refeicao: "Jantar", horario: "20:00", sugerido: "20:00", mudado: false },
      { refeicao: "Pré-treino", horario: null, sugerido: null, mudado: false },
    ]);
  });

  it("horariosDoPaciente: salvo que não é objeto vale como nada salvo", () => {
    expect(horariosDoPaciente(["Almoço"], "lixo")).toEqual([
      { refeicao: "Almoço", horario: "12:30", sugerido: "12:30", mudado: false },
    ]);
    expect(horariosDoPaciente(["Almoço"], ["13:00"])).toEqual([
      { refeicao: "Almoço", horario: "12:30", sugerido: "12:30", mudado: false },
    ]);
  });

  it("horariosDoPaciente: refeição fora da lista com horário salvo", () => {
    expect(horariosDoPaciente(["Pré-treino"], { "Pré-treino": "17:00" })).toEqual([
      { refeicao: "Pré-treino", horario: "17:00", sugerido: null, mudado: true },
    ]);
  });

  it("horariosParaGravar guarda só o que difere do sugerido", () => {
    expect(horariosParaGravar({ Jantar: "21:00" }, "Almoço", "13:00")).toEqual({ Jantar: "21:00", Almoço: "13:00" });
    // Voltou ao sugerido, ou o campo foi limpo: sai da lista.
    expect(horariosParaGravar({ Almoço: "13:00" }, "Almoço", "12:30")).toEqual({});
    expect(horariosParaGravar({ Almoço: "13:00" }, "Almoço", "")).toEqual({});
    // O que não é horário (o valor novo e o lixo que já estava) não vai.
    expect(horariosParaGravar({ Almoço: "13:00", x: 5 }, "Jantar", "25:00")).toEqual({ Almoço: "13:00" });
    expect(horariosParaGravar(null, "Pré-treino", "17:00")).toEqual({ "Pré-treino": "17:00" });
  });
});

describe("o endereço da refeição", () => {
  it("slugDaRefeicao: minúsculas, sem acento e com hífen", () => {
    expect(slugDaRefeicao("Café da manhã")).toBe("cafe-da-manha");
    expect(slugDaRefeicao("Almoço")).toBe("almoco");
    expect(slugDaRefeicao("Pré-treino (academia)")).toBe("pre-treino-academia");
    expect(slugDaRefeicao("  Lanche  da tarde ")).toBe("lanche-da-tarde");
    expect(slugDaRefeicao("☕")).toBe("outra");
  });

  it("idDaRefeicao e urlDaRefeicao", () => {
    expect(idDaRefeicao("Café da manhã")).toBe("refeicao-cafe-da-manha");
    expect(urlDaRefeicao("2026-10-28", "Almoço")).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
  });
});

describe("notificacaoDaRefeicao", () => {
  it("título com a pergunta, os dois corpos, a tag, a url, os botões e a falha", () => {
    const n = notificacaoDaRefeicao({
      data: "2026-10-28",
      refeicao: "Almoço",
      itens: [{ description: "Arroz, feijão e frango" }],
    });
    expect(n.title).toBe("Almoço: você comeu?");
    expect(n.body).toBe("Arroz, feijão e frango");
    expect(n.bodySemBotoes).toBe("Toque para marcar. Arroz, feijão e frango");
    expect(n.tag).toBe("refeicao-2026-10-28-almoco");
    expect(n.url).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
    expect(n.actions).toEqual([
      { action: "comi", title: "Comi" },
      { action: "nao_comi", title: "Não comi" },
    ]);
    expect(n.refeicao).toEqual({ data: "2026-10-28", refeicao: "Almoço" });
    expect(n.falha).toBe("Não deu para marcar sua resposta (Almoço). Toque para abrir o app.");
  });

  it("o cardápio cortado em 110 numa palavra inteira, sem pontuação antes do …", () => {
    const longo =
      "Arroz integral, feijão, frango grelhado, salada de folhas verdes, tomate, cenoura ralada, azeite, limão e uma fruta";
    expect(longo.length).toBeGreaterThan(110);
    const n = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Almoço", itens: [{ description: longo }] });
    expect(n.body.length).toBeLessThanOrEqual(110);
    expect(n.body.endsWith("…")).toBe(true);
    const corpo = n.body.slice(0, -1);
    expect(longo.startsWith(corpo)).toBe(true);
    expect(corpo).not.toMatch(/[\s,;:.·-]$/);
    // Cortou numa palavra inteira: depois do que ficou vem espaço ou vírgula.
    expect(longo[corpo.length]).toMatch(/[\s,]/);
  });

  it("até 110 caracteres, fica como está", () => {
    const exato = "a".repeat(110);
    expect(notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Ceia", itens: [{ description: exato }] }).body).toBe(exato);
  });

  it("uma palavra só, maior que 110, é cortada no meio", () => {
    const n = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Ceia", itens: [{ description: "x".repeat(150) }] });
    expect(n.body).toBe("x".repeat(109) + "…");
  });

  it("ou mais 1 opção, ou mais N opções, e a quebra de linha vira espaço", () => {
    const um = notificacaoDaRefeicao({
      data: "2026-10-28",
      refeicao: "Café da manhã",
      itens: [{ description: "Ovos\n+ pão " }, { description: "Iogurte" }],
    });
    expect(um.body).toBe("Ovos + pão · ou mais 1 opção");
    expect(um.bodySemBotoes).toBe("Toque para marcar. Ovos + pão · ou mais 1 opção");
    expect(um.tag).toBe("refeicao-2026-10-28-cafe-da-manha");
    const tres = notificacaoDaRefeicao({
      data: "2026-10-28",
      refeicao: "Jantar",
      itens: [{ description: "a" }, { description: "b" }, { description: "c" }],
    });
    expect(tres.body).toBe("a · ou mais 2 opções");
  });
});

describe("situacaoDosLembretes", () => {
  const base = { pushConfigurado: true, falhou: false, temCardapio: true, ios: false, standalone: false, suportado: true };

  it("sem a chave pública, chegam em breve, antes de tudo", () => {
    expect(situacaoDosLembretes({ ...base, pushConfigurado: false, falhou: true })).toBe("em_breve");
  });
  it("leitura que falha vem antes do sem cardápio", () => {
    expect(situacaoDosLembretes({ ...base, falhou: true, temCardapio: false })).toBe("falhou");
  });
  it("sem cardápio", () => {
    expect(situacaoDosLembretes({ ...base, temCardapio: false })).toBe("sem_cardapio");
  });
  it("iPhone fora da Tela de Início, mesmo sem suporte", () => {
    expect(situacaoDosLembretes({ ...base, ios: true, suportado: false })).toBe("iphone_fora");
  });
  it("iPhone na Tela de Início", () => {
    expect(situacaoDosLembretes({ ...base, ios: true, standalone: true })).toBe("pronto");
  });
  it("navegador sem notificação", () => {
    expect(situacaoDosLembretes({ ...base, suportado: false })).toBe("sem_suporte");
  });
  it("pronto", () => {
    expect(situacaoDosLembretes(base)).toBe("pronto");
  });
});
