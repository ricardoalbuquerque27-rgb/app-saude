import { describe, it, expect } from "vitest";
import { razaoContraste } from "./contraste";
import { NOMES_COR, TEMA_CLINICO } from "./temaClinico";
import {
  NOMES_COR_APP,
  TEMA_APP,
  PARES_TEXTO_APP,
  PARES_GRAFICO_APP,
  VIZINHOS_MACRO,
  cssDoTemaApp,
} from "./temaApp";

// Mesma ideia de lib/temaClinico.test.ts: a paleta do app é dado, e trocar um
// hex que derrube o contraste quebra aqui, não na tela de um paciente.
describe("tema do app", () => {
  it.each(["claro", "escuro"] as const)("texto passa 4,5:1 no tema %s", (t) => {
    for (const [f, b] of PARES_TEXTO_APP)
      expect(
        razaoContraste(TEMA_APP[t][f], TEMA_APP[t][b]),
        `${f} sobre ${b}`
      ).toBeGreaterThanOrEqual(4.5);
  });

  it("os pares de texto são exatamente os da spec", () => {
    // Há texto direto no chão (a data, o "Bom dia", o título de seção fora do
    // cartão): por isso texto, texto-2 e primaria entram sobre `pagina` e
    // sobre `cartao`. O slate-500 que o app usa hoje dá 4,43:1 sobre a página
    // clara e não entraria aqui.
    const esperados = [
      ["texto", "cartao"],
      ["texto", "pagina"],
      ["texto-2", "cartao"],
      ["texto-2", "pagina"],
      ["primaria", "cartao"],
      ["primaria", "pagina"],
      ["sobre-primaria", "primaria"],
      ["primaria", "primaria-fundo"],
      ["texto-2", "primaria-fundo"],
      ["atencao", "atencao-fundo"],
      ["texto", "atencao-fundo"],
      ["atencao-texto-2", "atencao-fundo"],
      ["atencao", "cartao"],
      ["perigo", "perigo-fundo"],
      ["perigo", "cartao"],
    ];
    const chave = (p: readonly string[]) => p.join(" sobre ");
    expect(PARES_TEXTO_APP.map(chave).sort()).toEqual(esperados.map(chave).sort());
  });

  it.each(["claro", "escuro"] as const)("gráfico passa 3:1 no tema %s", (t) => {
    for (const [f, b] of PARES_GRAFICO_APP)
      expect(
        razaoContraste(TEMA_APP[t][f], TEMA_APP[t][b]),
        `${f} sobre ${b}`
      ).toBeGreaterThanOrEqual(3);
  });

  it("os pares de gráfico são o anel sobre o trilho e a borda de campo", () => {
    const chave = (p: readonly string[]) => p.join(" sobre ");
    expect(PARES_GRAFICO_APP.map(chave).sort()).toEqual(
      [
        ["primaria", "linha"],
        ["campo", "cartao"],
        ["campo", "pagina"],
      ]
        .map(chave)
        .sort()
    );
  });

  it.each(["claro", "escuro"] as const)(
    "os macros vizinhos se distinguem (2:1) no tema %s",
    (t) => {
      // Só entre vizinhos, e só 2:1. Contra o fundo os tons claros NÃO passam
      // 3:1 (#b9dbc6 dá 1,5:1 sobre branco), e isso é aceito de propósito: a
      // barra é redundante, porque a legenda ao lado dá o nome e os gramas de
      // cada macro em texto. A barra só precisa mostrar onde um macro acaba e
      // o outro começa.
      for (const [a, b] of VIZINHOS_MACRO)
        expect(
          razaoContraste(TEMA_APP[t][a], TEMA_APP[t][b]),
          `${a} com ${b}`
        ).toBeGreaterThanOrEqual(2);
    }
  );

  it("os vizinhos dos macros são proteína com carbo e carbo com gordura", () => {
    expect(VIZINHOS_MACRO).toEqual([
      ["macro-proteina", "macro-carbo"],
      ["macro-carbo", "macro-gordura"],
    ]);
  });

  it("os papéis comuns são os do clínico", () => {
    // "A mesma principal do lado do nutricionista" tem de ser garantida pelo
    // código: duas listas de hex que concordam por enquanto divergem no
    // primeiro ajuste de cor de um dos lados.
    const comuns = NOMES_COR.filter((n) => n !== "chao");
    expect(comuns).toContain("texto");
    expect(comuns).toContain("perigo-fundo");
    for (const t of ["claro", "escuro"] as const) {
      for (const n of comuns)
        expect(TEMA_APP[t][n], `${n} no tema ${t}`).toBe(TEMA_CLINICO[t][n]);
      expect(TEMA_APP[t].cartao).toBe(TEMA_CLINICO[t].chao);
    }
  });

  it("página e macros com os valores da spec", () => {
    expect(TEMA_APP.claro.pagina).toBe("#f6f7f6");
    expect(TEMA_APP.escuro.pagina).toBe("#070b09");
    expect(TEMA_APP.claro["macro-proteina"]).toBe("#0e5d34");
    expect(TEMA_APP.claro["macro-carbo"]).toBe("#5c9a76");
    expect(TEMA_APP.claro["macro-gordura"]).toBe("#b9dbc6");
    expect(TEMA_APP.escuro["macro-proteina"]).toBe("#3fd27b");
    expect(TEMA_APP.escuro["macro-carbo"]).toBe("#2a8a55");
    expect(TEMA_APP.escuro["macro-gordura"]).toBe("#1d5538");
  });

  it("a lista de nomes e a tabela têm as mesmas cores", () => {
    // O Tailwind gera as classes app-* de NOMES_COR_APP e o CSS sai da
    // tabela. Cor só na tabela viraria variável sem classe; só na lista,
    // classe apontando para uma variável que não existe.
    expect([...NOMES_COR_APP].sort()).toEqual(Object.keys(TEMA_APP.claro).sort());
  });

  it("toda cor existe nos dois temas", () => {
    expect(Object.keys(TEMA_APP.escuro).sort()).toEqual(
      Object.keys(TEMA_APP.claro).sort()
    );
  });

  it("todo par citado usa nomes que existem na tabela", () => {
    // Um nome com erro de digitação num par daria razaoContraste(undefined, …)
    // e o teste de contraste quebraria com NaN em vez de apontar o par.
    for (const [a, b] of [...PARES_TEXTO_APP, ...PARES_GRAFICO_APP, ...VIZINHOS_MACRO]) {
      expect(NOMES_COR_APP, a).toContain(a);
      expect(NOMES_COR_APP, b).toContain(b);
    }
  });

  it("o CSS define os dois temas, em :root e .dark", () => {
    const css = cssDoTemaApp();
    expect(css.startsWith(":root{--app-pagina:#f6f7f6;")).toBe(true);
    expect(css).toContain(".dark{--app-pagina:#070b09;");
  });

  it("o CSS leva toda cor da tabela, nos dois blocos", () => {
    const css = cssDoTemaApp();
    for (const t of ["claro", "escuro"] as const) {
      const bloco = t === "claro" ? css.split(".dark{")[0] : css.split(".dark{")[1];
      for (const n of NOMES_COR_APP)
        expect(bloco, `--app-${n} no tema ${t}`).toContain(
          `--app-${n}:${TEMA_APP[t][n]};`
        );
    }
  });
});
