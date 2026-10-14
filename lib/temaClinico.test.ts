import { describe, it, expect } from "vitest";
import { razaoContraste } from "./contraste";
import {
  NOMES_COR,
  TEMA_CLINICO,
  PARES_TEXTO,
  PARES_GRAFICO,
  cssDoTemaClinico,
} from "./temaClinico";

// Estes testes são o motivo de a paleta clínica existir como dado: trocar
// um hex que derrube o contraste quebra aqui, não na tela de um paciente.
describe("tema clínico", () => {
  it.each(["claro", "escuro"] as const)("texto passa 4,5:1 no tema %s", (t) => {
    for (const [f, b] of PARES_TEXTO)
      expect(
        razaoContraste(TEMA_CLINICO[t][f], TEMA_CLINICO[t][b]),
        `${f} sobre ${b}`
      ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["claro", "escuro"] as const)("gráfico passa 3:1 no tema %s", (t) => {
    for (const [f, b] of PARES_GRAFICO)
      expect(
        razaoContraste(TEMA_CLINICO[t][f], TEMA_CLINICO[t][b]),
        `${f} sobre ${b}`
      ).toBeGreaterThanOrEqual(3);
  });

  it("a lista de nomes e a tabela têm as mesmas cores", () => {
    // O Tailwind gera as classes clin-* de NOMES_COR e o CSS sai da tabela.
    // Cor só na tabela viraria variável sem classe; só na lista, classe
    // apontando para uma variável que não existe.
    expect([...NOMES_COR].sort()).toEqual(Object.keys(TEMA_CLINICO.claro).sort());
  });

  it("a borda de campo é um par de gráfico, para o teste de 3:1 valer para ela", () => {
    expect(PARES_GRAFICO).toContainEqual(["campo", "chao"]);
  });

  it("os pares que os gráficos da aba Corpo usam estão na lista de 3:1", () => {
    // A linha da média e o arco do anel (primaria), o ponto da consulta
    // (texto) e a meta (campo) sobre o fundo da página; a faixa do exame
    // (primaria sobre primaria-fundo). Sem estar na lista, trocar um hex que
    // derruba o contraste do gráfico não quebraria teste nenhum.
    for (const par of [
      ["primaria", "chao"],
      ["texto", "chao"],
      ["campo", "chao"],
      ["primaria", "primaria-fundo"],
    ])
      expect(PARES_GRAFICO).toContainEqual(par);
  });

  it.each(["claro", "escuro"] as const)(
    "a borda de campo passa 3:1 sobre o chão e é mais suave que o texto-2 no tema %s",
    (t) => {
      const campo = razaoContraste(TEMA_CLINICO[t].campo, TEMA_CLINICO[t].chao);
      const texto2 = razaoContraste(TEMA_CLINICO[t]["texto-2"], TEMA_CLINICO[t].chao);
      expect(campo).toBeGreaterThanOrEqual(3);
      expect(campo).toBeLessThan(texto2);
    }
  );

  it("toda cor existe nos dois temas", () => {
    expect(Object.keys(TEMA_CLINICO.escuro).sort()).toEqual(
      Object.keys(TEMA_CLINICO.claro).sort()
    );
  });

  it("o CSS define os dois temas", () => {
    const css = cssDoTemaClinico();
    expect(css).toContain(".tema-clinico{--clin-chao:#ffffff;");
    expect(css).toContain(".dark .tema-clinico{--clin-chao:#0c1210;");
  });

  it("com o tema na página, o fundo dela inteira é o chão do tema", () => {
    // Só a caixa do conteúdo tinha o chão; em volta dela ficava o fundo do
    // app (outra cor, com o brilho verde), e a página parecia uma caixa
    // solta com uma faixa vazia ao lado do menu.
    const css = cssDoTemaClinico();
    expect(css).toContain("body:has(.tema-clinico){background:#ffffff}");
    expect(css).toContain(".dark body:has(.tema-clinico){background:#0c1210}");
  });
});
