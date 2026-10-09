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
});
