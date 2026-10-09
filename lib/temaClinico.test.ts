import { describe, it, expect } from "vitest";
import { razaoContraste } from "./contraste";
import {
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
