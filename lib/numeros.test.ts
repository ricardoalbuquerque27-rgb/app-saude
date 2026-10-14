import { describe, it, expect } from "vitest";
import { comSinal, comUnidade, numeroBR } from "./numeros";

describe("numeroBR", () => {
  it("vírgula decimal, no máximo uma casa, sem zero sobrando", () => {
    expect(numeroBR(70.3)).toBe("70,3");
    expect(numeroBR(66)).toBe("66");
    expect(numeroBR(70.25)).toBe("70,3");
    expect(numeroBR(0.4)).toBe("0,4");
  });

  it("com mais casas quando pedido (os exames têm 3) e sem separador de milhar", () => {
    expect(numeroBR(5.123, 3)).toBe("5,123");
    expect(numeroBR(6500, 3)).toBe("6500");
  });
});

describe("comSinal", () => {
  it("+ e o menos de verdade (U+2212); zero sem sinal", () => {
    expect(comSinal(1.2)).toBe("+1,2");
    expect(comSinal(-4.3)).toBe("−4,3");
    expect(comSinal(0)).toBe("0");
    expect(comSinal(-13, 3)).toBe("−13");
  });
});

describe("comUnidade", () => {
  it("o % junto do número, as outras unidades com espaço", () => {
    // O título do % de gordura dizia "30,4%" e a dica do mesmo gráfico "30,4 %".
    expect(comUnidade(30.4, "%")).toBe("30,4%");
    expect(comUnidade(85, "cm")).toBe("85 cm");
    expect(comUnidade(70.3, "kg")).toBe("70,3 kg");
  });
});
